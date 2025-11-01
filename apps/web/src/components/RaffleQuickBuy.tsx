"use client";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { ensureSession, ensureAndReserveRandomTickets } from "@/lib/rpc";
import type { RafflePaymentInfo } from "@/lib/data/paymentConfig";
import { listTickets, releaseTickets, reserveTickets } from "@/lib/data/tickets";
import { getSessionId } from "@/lib/session";
import { CheckoutForm } from "./CheckoutForm";
import { FreeParticipationForm } from "./FreeParticipationForm";
import { centsToUsd, getUsdVesRate, round2 } from "@/lib/data/rate";

export function RaffleQuickBuy({ raffleId, currency, totalTickets, unitPriceCents, paymentInfo, isFree = false }: { raffleId: string; currency: string; totalTickets: number; unitPriceCents: number; paymentInfo?: RafflePaymentInfo; isFree?: boolean }) {
  const sessionId = getSessionId();
  const debugReservations = process.env.NEXT_PUBLIC_DEBUG_RESERVATIONS === '1';
  const [qty, setQty] = useState<number>(1);
  const [availableTickets, setAvailableTickets] = useState<number>(totalTickets);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [reserved, setReserved] = useState<any[]>([]);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [rateInfo, setRateInfo] = useState<{ rate: number; source?: string } | null>(null);
  const storageKey = `prizo_reservation_${raffleId}`;
  const [rehydrated, setRehydrated] = useState(false);
  const [restoreIds, setRestoreIds] = useState<string[] | null>(null);
  // Nota: antes se guardaban/rehidrataban números de tickets, pero ya no se muestran en UI.
  const [restoreDeadline, setRestoreDeadline] = useState<number | null>(null);
  const [restoring, setRestoring] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      const info = await getUsdVesRate();
      if (info?.rate) setRateInfo({ rate: info.rate, source: info.source });
    })();
  }, []);

  const inc = (n = 1) => setQty((q) => Math.min(Math.max(1, q + n), availableTickets));
  const dec = () => setQty((q) => Math.max(1, q - 1));
  const handleQtyChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = Math.max(1, Math.min(Number(e.target.value || 1), availableTickets));
    setQty(val);
  };
  // Actualizar el número de tickets disponibles al montar y cuando cambie la rifa
  useEffect(() => {
    (async () => {
      try {
        const all = await listTickets(raffleId);
        const available = (all ?? []).filter((t: any) => t.status === 'available').length;
        setAvailableTickets(available);
        // Si la cantidad seleccionada es mayor a la disponible, ajusta manteniendo mínimo en 1
        setQty((q) => {
          if (available <= 0) return 1;
          return Math.min(q, available);
        });
      } catch {}
    })();
  }, [raffleId, reserved.length]);

  async function enforceExactReservation(chosenIds: string[]) {
    // Intenta hasta 5 veces liberar cualquier extra que haya quedado reservado por mi sesión, con backoff corto
    const delays = [150, 250, 400, 650, 1000];
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const fresh = await listTickets(raffleId);
        const mine = (fresh ?? []).filter((t: any) => t.reserved_by === sessionId && t.status === 'reserved');
        const keepSet = new Set(chosenIds);
        const extras = mine.filter((t: any) => !keepSet.has(t.id)).map((t: any) => t.id);
        if (!extras.length) {
          if (debugReservations) console.debug('[reservas] enforceExactReservation OK en intento', attempt + 1);
          return;
        }
        if (debugReservations) console.debug('[reservas] enforceExactReservation intento', attempt + 1, 'liberando extras:', extras.length);
        try { await releaseTickets(extras, sessionId); } catch (e) {
          if (debugReservations) console.debug('[reservas] release extras fallo:', e);
        }
        // pequeña espera para que el backend procese
        const wait = delays[Math.min(attempt, delays.length - 1)];
        await new Promise((r) => setTimeout(r, wait));
      } catch {}
    }
  }

  // Toma 'count' IDs aleatorios disponibles y trata de reservarlos, manteniendo también los ya deseados
  async function pickAndReserveAvailable(count: number, desiredSoFar: string[]): Promise<any[]> {
    if (count <= 0) return [];
    try {
      const all = await listTickets(raffleId);
      const avail = (all ?? []).filter((t: any) => t.status === 'available');
      if (!avail.length) return [];
      // Shuffle Fisher–Yates
      for (let i = avail.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [avail[i], avail[j]] = [avail[j], avail[i]];
      }
      const chosen = avail.slice(0, Math.min(count, avail.length));
      const chosenIds = chosen.map((t: any) => t.id);
      const desired = Array.from(new Set([...(desiredSoFar ?? []), ...chosenIds]));
      const res = await reserveTickets(desired, sessionId, 10);
      const picked = Array.isArray(res) ? res : [];
      // Liberar cualquier extra inesperado
      const extras = picked.filter((t: any) => !desired.includes(t.id)).map((t: any) => t.id);
      if (extras.length) { try { await releaseTickets(extras, sessionId); } catch {} }
      // Leer estado real y devolver los míos del conjunto deseado
      try {
        const fresh = await listTickets(raffleId);
        const mine = (fresh ?? []).filter((t: any) => t.reserved_by === sessionId && t.status === 'reserved' && desired.includes(t.id));
        return mine;
      } catch {
        // Fallback mínimo
        return picked.filter((t: any) => desired.includes(t.id));
      }
    } catch {
      return [];
    }
  }

  // Al montar: recuperar reservas activas desde localStorage y validar en BD
  useEffect(() => {
    (async () => {
      try {
  let idsFromStorage: string[] | null = null;
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed?.ids)) idsFromStorage = parsed.ids;
            // if (Array.isArray(parsed?.nums)) { /* números no usados en UI */ }
            if (parsed?.deadline) setRestoreDeadline(Number(parsed.deadline));
          }
        } catch {}

        const all = await listTickets(raffleId);
        let mine = (all ?? []).filter((t: any) => t.reserved_by === sessionId && t.status === 'reserved' && t.reserved_until);
        if (idsFromStorage && idsFromStorage.length) {
          // Preferir IDs guardados, validando que sigan siendo míos
          const byIds = mine.filter((t: any) => idsFromStorage!.includes(t.id));
          if (byIds.length) mine = byIds;
          if (byIds.length) setRehydrated(true);
        }
        if (mine.length) {
          setReserved(mine);
          setRestoreIds(null);
        } else if (idsFromStorage && idsFromStorage.length) {
          // No hay reservas activas, pero hay ids guardados: activar modo restauración automática
          setRestoreIds(idsFromStorage);
          // setRestoreNums(numsFromStorage ?? null);
          setRestoring(true);
        }
      } catch (e) {
        console.warn('Could not load existing reservations:', e);
      }
    })();
  }, [raffleId, sessionId]);

  // Persistir IDs y deadline mínimo en localStorage cuando cambia la reserva
  useEffect(() => {
    try {
      if (reserved?.length) {
        const ids = reserved.map((t: any) => t.id);
        const times = reserved
          .map((t: any) => (t.reserved_until ? new Date(t.reserved_until).getTime() : 0))
          .filter((ts: number) => ts > 0);
        const deadline = times.length ? Math.min(...times) : 0;
        const nums = reserved
          .map((t: any) => (typeof t.ticket_number === 'number' ? t.ticket_number : null))
          .filter((n: number | null): n is number => typeof n === 'number');
        localStorage.setItem(storageKey, JSON.stringify({ ids, nums, deadline }));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {}
  }, [reserved, storageKey]);

  const handleContinue = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      let newReserved: any[] = [];
      // Determinar si hay selección manual previa (no liberamos en ese caso)
      let manualIds: string[] = [];
      try {
        const raw = localStorage.getItem(`prizo_manual_${raffleId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed?.ids)) manualIds = parsed.ids as string[];
        }
      } catch {}

      // Asegurar que la sesión exista en la BD para no romper el FK
      try { await ensureSession(sessionId); } catch (e) { console.warn('ensureSession failed (continuing):', e); }

      if (manualIds.length) {
        // NO liberar reservas previas: el usuario ya escogió exactamente esos IDs
        try {
          const res = await reserveTickets(manualIds, sessionId, 10);
          const arr = Array.isArray(res) ? res : [];
          // Quédate solo con los IDs seleccionados
          newReserved = arr.filter((t: any) => manualIds.includes(t.id));
          // Liberar cualquier extra (defensa)
          const extras = arr.filter((t: any) => !manualIds.includes(t.id)).map((t: any) => t.id);
          if (extras.length) { try { await releaseTickets(extras, sessionId); } catch {} }
          // Enforcement: asegurarse con snapshot en BD
          try {
            const fresh = await listTickets(raffleId);
            const mine = (fresh ?? []).filter((t: any) => t.reserved_by === sessionId && t.status === 'reserved' && manualIds.includes(t.id));
            newReserved = mine;
          } catch {}
          if ((newReserved?.length ?? 0) < manualIds.length) {
            setInfo(`Solo pudimos reservar ${newReserved.length} de ${manualIds.length} seleccionados.`);
          }
        } catch (e: any) {
          if (debugReservations) console.error('reserveTickets(manualIds) failed:', e);
          const msg = e?.message || String(e);
          setError(`Error al reservar (selección manual): ${msg}`);
        }
      } else {
        // 0) No hay selección manual: si ya tengo reservas activas (p. ej., desde la vista manual), NO liberar; usa esas
        try {
          const current = await listTickets(raffleId);
          const mine = (current ?? []).filter((t: any) => t.reserved_by === sessionId && t.status === 'reserved');
          if (mine.length) {
            newReserved = mine;
          }
        } catch {}

        if (!newReserved.length) {
          // 0.1) Empezar limpio liberando reservas previas si las hubiera
          try {
            const current = await listTickets(raffleId);
            const mineIds = (current ?? [])
              .filter((t: any) => t.reserved_by === sessionId && t.status === 'reserved')
              .map((t: any) => t.id);
            if (mineIds.length) {
              await releaseTickets(mineIds, sessionId);
            }
          } catch (e) {
            console.warn('Could not pre-release existing reservations:', e);
          }
        }
        // 1) Si después de lo anterior sigo sin reservas, reservar EXACTAMENTE qty usando RPC aleatorio
        if (!newReserved.length) {
          try {
            const res = await ensureAndReserveRandomTickets({ p_raffle_id: raffleId, p_total: totalTickets, p_session_id: sessionId, p_quantity: qty, p_minutes: 10 });
            let arr = Array.isArray(res) ? res : [];
            // Blindaje: si la RPC devolvió más de lo pedido, libera el excedente
            if (arr.length > qty) {
              const extras = arr.slice(qty).map((t: any) => t.id);
              try { if (extras.length) await releaseTickets(extras, sessionId); } catch {}
              arr = arr.slice(0, qty);
            }
            // Blindaje extra: asegurar en BD que solo queden exactamente esos IDs
            const pickedIds = arr.map((t: any) => t.id);
            if (pickedIds.length) {
              try { await enforceExactReservation(pickedIds); } catch {}
              try {
                const fresh = await listTickets(raffleId);
                const mine = (fresh ?? []).filter((t: any) => t.reserved_by === sessionId && t.status === 'reserved' && pickedIds.includes(t.id));
                newReserved = mine;
              } catch {}
            } else {
              newReserved = arr;
            }

            // Si aún faltan, intentar completar con picks locales (hasta 3 intentos rápidos)
            let attempts = 0;
            while ((newReserved?.length ?? 0) < qty && attempts < 3) {
              attempts++;
              const missing = qty - (newReserved?.length ?? 0);
              const desiredSoFar = (newReserved ?? []).map((t: any) => t.id);
              const extra = await pickAndReserveAvailable(missing, desiredSoFar);
              const next = [...new Set([...(newReserved ?? []), ...extra])];
              // normalizar por id
              const map = new Map<string, any>();
              next.forEach((t: any) => map.set(t.id, t));
              newReserved = Array.from(map.values()).slice(0, qty);
              try { await enforceExactReservation(newReserved.map((t: any) => t.id)); } catch {}
            }

            if ((newReserved?.length ?? 0) < qty) {
              setInfo(`Solo pudimos reservar ${newReserved.length} de ${qty} solicitados.`);
            }
          } catch (e: any) {
            if (debugReservations) console.error('ensureAndReserveRandomTickets failed:', e);
            const msg = e?.message || String(e);
            setError(`Error al reservar: ${msg}`);
          }
        }
      }

      if (!newReserved.length) {
        setError((prev) => prev ?? "No se pudieron reservar tickets. Puede que no haya disponibilidad suficiente o que tu usuario no tenga permiso para ejecutar la reserva.");
      } else {
        setReserved(newReserved);
      }
    } catch (e: any) {
      setError(e?.message ?? "No se pudieron reservar tickets");
    } finally {
      setBusy(false);
    }
  };

  const handleClose = async () => {
    // Si no hay reservas, simplemente resetea el estado visual
    if (!reserved.length) {
      setQty(1);
      setInfo(null);
      setError(null);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const ids = reserved.map((t) => t.id);
      if (ids.length) await releaseTickets(ids, sessionId);
      setReserved([]);
    } catch (e: any) {
      setError(e?.message ?? "No se pudieron liberar los tickets");
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreIds || !restoreIds.length) return;
    const qty = restoreIds.length;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      try { await ensureSession(sessionId); } catch {}
      // Intentar reservar exactamente esos IDs
      const remainingMinutes = restoreDeadline ? Math.max(1, Math.ceil((restoreDeadline - Date.now()) / 60000)) : 10;
      let arr = await reserveTickets(restoreIds, sessionId, remainingMinutes);
      arr = Array.isArray(arr) ? arr : [];
      if (arr.length > qty) {
        const extras = arr.slice(qty).map((t: any) => t.id);
        try { if (extras.length) await releaseTickets(extras, sessionId); } catch {}
        arr = arr.slice(0, qty);
      }
      if (!arr.length) {
        // Si ninguno de esos IDs está disponible, intenta reservar aleatorios por la misma cantidad (selección local)
        try {
          let all: any[] = [];
          try { all = await listTickets(raffleId) as any[]; } catch {}
          const avail = (all ?? []).filter((t: any) => t.status === 'available');
          const shuffled = [...avail];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          const chosen = shuffled.slice(0, Math.min(qty, shuffled.length));
          const chosenIds = chosen.map((t: any) => t.id);
          const res = await reserveTickets(chosenIds, sessionId, 10);
          let picked = Array.isArray(res) ? res : [];
          const keep = picked.filter((t: any) => chosenIds.includes(t.id));
          const extras = picked.filter((t: any) => !chosenIds.includes(t.id)).map((t: any) => t.id);
          if (extras.length) { try { await releaseTickets(extras, sessionId); } catch {} }
          arr = keep.slice(0, qty);
        } catch {}
      }
      if (arr.length) {
        setReserved(arr);
        setRestoreIds(null);
  // setRestoreNums(null);
        setRehydrated(true);
        setRestoring(false);
      } else {
        setError('No fue posible restaurar la reserva. Intenta continuar nuevamente.');
      }
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo restaurar la reserva');
    } finally {
      setBusy(false);
    }
  };

  // Restauración automática si hay datos guardados; si está offline, se mantiene el modo "restoring"
  useEffect(() => {
    if (restoring && restoreIds && restoreIds.length && !reserved.length) {
      // Intento automático en background (sin bloquear UI de restauración)
      handleRestore().catch(() => {
        // si falla, permanecerá en modo restoring usando deadline almacenado
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoring]);

  // Timer basado en menor reserved_until
  const deadline = useMemo(() => {
    const times = (reserved ?? [])
      .map((t: any) => (t.reserved_until ? new Date(t.reserved_until).getTime() : 0))
      .filter((ts: number) => ts > 0);
    if (times.length) return Math.min(...times);
    if (restoring && restoreDeadline) return restoreDeadline;
    return 0;
  }, [reserved, restoring, restoreDeadline]);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const timeLeftMs = deadline ? Math.max(0, deadline - now) : 0;
  const isExpired = deadline === 0 || timeLeftMs <= 0;
  const mm = String(Math.floor(timeLeftMs / 60000)).padStart(2, "0");
  const ss = String(Math.floor((timeLeftMs % 60000) / 1000)).padStart(2, "0");

  // Auto-liberar reservas cuando expira el tiempo (solo rifas pagas)
  const [autoReleased, setAutoReleased] = useState(false);
  useEffect(() => {
    if (isFree) return; // no aplica para rifas gratuitas
    if (!isExpired) return;
    if (!reserved.length) return;
    if (autoReleased) return;
    let cancelled = false;
    (async () => {
      try {
        setAutoReleased(true);
        const ids = reserved.map((t: any) => t.id);
        if (ids.length) {
          try { await releaseTickets(ids, sessionId); } catch {}
        }
        if (!cancelled) {
          setReserved([]);
          setInfo('Tu reserva expiró y tus tickets fueron liberados automáticamente.');
          try {
            localStorage.removeItem(storageKey);
            localStorage.removeItem(`prizo_manual_${raffleId}`);
          } catch {}
        }
      } catch {}
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpired, reserved.length, isFree]);

  // Si vuelve a haber reservas nuevas, permitir nuevamente el auto-release en futuras expiraciones
  useEffect(() => {
    if (reserved.length) setAutoReleased(false);
  }, [reserved.length]);

  const reservedCount = reserved.length || (restoring && restoreIds ? restoreIds.length : 0);
  const unitUSD = centsToUsd(unitPriceCents);
  const rate = rateInfo?.rate ?? 0;
  const unitVES = rate ? round2(unitUSD * rate) : 0;
  const totalVES = round2(unitVES * (reservedCount || qty));

  return (
    <div className="rounded-2xl border p-4 bg-white">
      <h2 className="text-lg md:text-xl font-extrabold tracking-wide uppercase">¿Cuántos tickets quieres?</h2>

      {error && (
        <div className="mt-3 p-2 text-sm rounded border bg-red-50 text-red-700">{error}</div>
      )}
      {info && (
        <div className="mt-3 p-2 text-sm rounded border bg-blue-50 text-blue-700">{info}</div>
      )}

      {!reserved.length && !restoring ? (
        <div className="mt-4 max-w-md mx-auto">
          <div className="flex items-center justify-center gap-3">
            <button type="button" className="w-12 h-12 rounded-lg bg-pink-100 text-pink-700 text-2xl font-bold" onClick={dec} disabled={busy}>−</button>
            <input
              className="w-16 h-12 text-center text-2xl font-semibold rounded-lg border"
              type="number"
              min={1}
              max={availableTickets}
              value={qty}
              onChange={handleQtyChange}
            />
            <button type="button" className="w-12 h-12 rounded-lg bg-pink-100 text-pink-700 text-2xl font-bold" onClick={() => inc(1)} disabled={busy}>+</button>
          </div>

          <div className="mt-3 flex items-center justify-center gap-2">
            {[2,5,10].map((n) => (
              <button key={n} type="button" className="px-2 py-1 rounded-lg bg-pink-50 text-pink-700 text-sm border" onClick={() => inc(n)} disabled={busy}>
                +{n}
              </button>
            ))}
          </div>

          <p className="mt-4 text-center text-sm text-gray-700">
            {isFree ? (
              <>
                Al continuar, registraremos tu participación. Solo te pediremos tus datos. Es <b>GRATIS</b>, no debes pagar nada.
              </>
            ) : (
              <>
                Al continuar, reservaremos tus tickets por <b>10 minutos</b>. En el siguiente paso ingresarás tus datos y el comprobante.
              </>
            )}
          </p>

          {restoreIds && restoreIds.length > 0 && (
            <div className="mt-3 text-center text-xs text-gray-700">Detectamos una reserva previa. Restaurando…</div>
          )}

          <div className="mt-4 flex items-center justify-center gap-3">
            <button type="button" className="px-4 py-2 rounded-lg border" onClick={() => setShowCancelConfirm(true)} disabled={busy}>Cerrar</button>
            <button type="button" className="px-4 py-2 rounded-lg bg-pink-600 text-white disabled:opacity-60 flex items-center gap-2" onClick={handleContinue} disabled={busy}>
              {busy && <span className="inline-block w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />}
              Continuar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-4 max-w-xl mx-auto">
          {!isFree && (
            <>
              <div className={`text-sm p-2 rounded border ${isExpired ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                {isExpired ? (
                  <span>La reserva expiró. Vuelve a seleccionar tus tickets.</span>
                ) : (
                  <span>Reserva activa: {mm}:{ss} restantes.</span>
                )}
              </div>
              {!isExpired && (rehydrated || restoring) && (
                <div className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded p-2">
                  {restoring ? 'Restaurando reserva basada en tu última sesión. Si estás sin conexión, verás datos temporales hasta reconectar.' : 'Reserva recuperada de tu sesión anterior.'}
                </div>
              )}
            </>
          )}
          {/* Resumen con números */}
          <div className="text-sm grid sm:grid-cols-2 gap-3">
            <div className="p-3 rounded border bg-pink-50">
              <div className="text-xs text-pink-700">Cantidad</div>
              <div className="text-lg font-semibold text-pink-800">{reservedCount}</div>
            </div>
            <div className="p-3 rounded border bg-pink-50">
              <div className="text-xs text-pink-700">Total (Bs)</div>
              <div className="text-lg font-semibold text-pink-800">{isFree ? '0.00' : (rate ? totalVES.toFixed(2) : '—')}</div>
            </div>
          </div>

          {/* Listado de números reservados oculto por requerimiento */}

          {!isFree && rateInfo && (
            <p className="text-xs text-gray-600">Tasa BCV: {rateInfo.rate.toFixed(2)} Bs/USD</p>
          )}

          {/* Instrucciones de pago desde la rifa (con botones COPIAR) */}
          {!isFree && paymentInfo && (
            <div className="rounded-xl border p-3 bg-white">
              <div className="font-semibold mb-2">Pago Móvil / Transferencia</div>

              <div className="space-y-2 text-sm">
                {paymentInfo.bank && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="text-xs opacity-70">Banco</div>
                      <div className="font-semibold">{paymentInfo.bank}</div>
                    </div>
                    <button
                      type="button"
                      className="px-2 py-1 rounded bg-white border text-pink-700"
                      onClick={async () => { await navigator.clipboard.writeText(paymentInfo.bank!); setCopiedField('bank'); setTimeout(() => setCopiedField(null), 1500); }}
                    >{copiedField === 'bank' ? 'COPIADO' : 'COPIAR'}</button>
                  </div>
                )}

                {paymentInfo.phone && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="text-xs opacity-70">Teléfono</div>
                      <div className="font-semibold">{paymentInfo.phone}</div>
                    </div>
                    <button
                      type="button"
                      className="px-2 py-1 rounded bg-white border text-pink-700"
                      onClick={async () => { await navigator.clipboard.writeText(paymentInfo.phone!); setCopiedField('phone'); setTimeout(() => setCopiedField(null), 1500); }}
                    >{copiedField === 'phone' ? 'COPIADO' : 'COPIAR'}</button>
                  </div>
                )}

                {paymentInfo.id_number && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="text-xs opacity-70">Cédula/RIF</div>
                      <div className="font-semibold">{paymentInfo.id_number}</div>
                    </div>
                    <button
                      type="button"
                      className="px-2 py-1 rounded bg-white border text-pink-700"
                      onClick={async () => { await navigator.clipboard.writeText(paymentInfo.id_number!); setCopiedField('id_number'); setTimeout(() => setCopiedField(null), 1500); }}
                    >{copiedField === 'id_number' ? 'COPIADO' : 'COPIAR'}</button>
                  </div>
                )}

                {paymentInfo.holder && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="text-xs opacity-70">Titular</div>
                      <div className="font-semibold">{paymentInfo.holder}</div>
                    </div>
                    <button
                      type="button"
                      className="px-2 py-1 rounded bg-white border text-pink-700"
                      onClick={async () => { await navigator.clipboard.writeText(paymentInfo.holder!); setCopiedField('holder'); setTimeout(() => setCopiedField(null), 1500); }}
                    >{copiedField === 'holder' ? 'COPIADO' : 'COPIAR'}</button>
                  </div>
                )}

                {paymentInfo.type && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="text-xs opacity-70">Tipo</div>
                      <div className="font-semibold">{paymentInfo.type}</div>
                    </div>
                    <button
                      type="button"
                      className="px-2 py-1 rounded bg-white border text-pink-700"
                      onClick={async () => { await navigator.clipboard.writeText(paymentInfo.type!); setCopiedField('type'); setTimeout(() => setCopiedField(null), 1500); }}
                    >{copiedField === 'type' ? 'COPIADO' : 'COPIAR'}</button>
                  </div>
                )}

                <p className="mt-2 text-xs text-gray-700">Realiza el pago exacto en Bs. Adjunta el comprobante e indica la referencia.</p>

                {paymentInfo.active === false && (
                  <div className="mt-2 text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded p-2 flex items-center gap-2">
                    <span>Pago Móvil configurado —</span>
                    <b>Esta rifa no está activa</b>
                  </div>
                )}
              </div>
            </div>
          )}

          {isFree ? (
            <FreeParticipationForm
              raffleId={raffleId}
              sessionId={sessionId}
              disabled={false}
              quantity={reservedCount}
              onCreated={() => {
                try {
                  localStorage.removeItem(storageKey);
                  localStorage.removeItem(`prizo_manual_${raffleId}`);
                } catch {}
                setReserved([]);
                setQty(1);
                setInfo('Participación registrada. Tus tickets quedan reservados sin temporizador hasta la confirmación.');
              }}
            />
          ) : (
            <CheckoutForm
              raffleId={raffleId}
              sessionId={sessionId}
              currency={'VES'}
              disabled={isExpired}
              quantity={reservedCount}
              unitPriceCents={unitPriceCents}
              methodLabel={paymentInfo ? 'Pago Móvil' : 'Pago'}
              onCreated={() => {
                try {
                  // Limpiar estado local y cerrar temporizador sin liberar en la BD
                  localStorage.removeItem(storageKey);
                  localStorage.removeItem(`prizo_manual_${raffleId}`);
                } catch {}
                setReserved([]);
                setQty(1);
                setInfo('Pago enviado. Tus tickets quedan reservados sin temporizador hasta que el administrador apruebe o rechace. Puedes comprar más si deseas.');
              }}
            />
          )}

          <div className="flex items-center justify-end">
            <button type="button" className="text-sm px-3 py-1.5 rounded border" onClick={() => setShowCancelConfirm(true)} disabled={busy}>Liberar y cerrar</button>
          </div>
        </div>
      )}

      {/* Modal de confirmación para cancelar y liberar reservas */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCancelConfirm(false)} />
          <div className="relative z-10 w-[95%] max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold">¿Cancelar y liberar tus tickets?</h3>
            <p className="mt-2 text-sm text-gray-600">Si cancelas ahora, perderás los tickets reservados y volverán a estar disponibles para otros usuarios.</p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border"
                onClick={() => setShowCancelConfirm(false)}
                disabled={busy}
              >{isFree ? 'Seguir' : 'Seguir con la compra'}</button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-red-600 text-white disabled:opacity-60"
                onClick={async () => { await handleClose(); setShowCancelConfirm(false); }}
                disabled={busy}
              >Sí, cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
