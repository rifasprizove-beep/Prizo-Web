"use client";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { ensureAndReserveRandomTickets, ensureSession } from "@/lib/rpc";
import type { RafflePaymentInfo, RafflePaymentMethod } from "@/lib/data/paymentConfig";
import { listTickets, releaseTickets, reserveTickets } from "@/lib/data/tickets";
import { getSessionId } from "@/lib/session";
import { CheckoutForm } from "./CheckoutForm";
import { FreeParticipationForm } from "./FreeParticipationForm";

export function RaffleQuickBuy({ raffleId, currency: _currency, totalTickets, unitPriceCents, minTicketPurchase = 1, paymentInfo, paymentMethods, isFree = false, disabledAll = false, bootCycle = 0, onBootReady }: { raffleId: string; currency: string; totalTickets: number; unitPriceCents: number; minTicketPurchase?: number; paymentInfo?: RafflePaymentInfo; paymentMethods?: RafflePaymentMethod[]; isFree?: boolean; disabledAll?: boolean; bootCycle?: number; onBootReady?: () => void }) {
  const sessionId = getSessionId();
  const debugReservations = process.env.NEXT_PUBLIC_DEBUG_RESERVATIONS === '1';
  // Obtener la rifa desde el backend o props (aquí asumimos que paymentInfo tiene la rifa o agregar prop si es necesario)
  // Por simplicidad, intentamos obtener el mínimo desde paymentInfo.raffle.min_ticket_purchase o default 1
  // minTicketPurchase viene como prop; si la rifa pagada exige mínimo mayor, usarlo.
  const [qty, setQty] = useState<number>(minTicketPurchase);
  const [availableTickets, setAvailableTickets] = useState<number>(totalTickets);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [reserved, setReserved] = useState<any[]>([]);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  const storageKey = `prizo_reservation_${raffleId}`;
  const [rehydrated, setRehydrated] = useState(false);
  const [restoreIds, setRestoreIds] = useState<string[] | null>(null);
  // Nota: antes se guardaban/rehidrataban números de tickets, pero ya no se muestran en UI.
  const [restoreDeadline, setRestoreDeadline] = useState<number | null>(null);
  const [restoring, setRestoring] = useState<boolean>(false);

  

  const MAX_PER_PURCHASE = 1000;
  const inc = (n = 1) => {
    if (disabledAll) return;
    setQty((q) => {
      // Propuesta: aplicar límite máximo y disponibilidad
      let next = Math.min(Math.max(minTicketPurchase, q + n), availableTickets, MAX_PER_PURCHASE);
      // Evitar dejar remanente menor al mínimo
      if (!isFree) {
        const remainder = availableTickets - next;
        if (remainder > 0 && remainder < minTicketPurchase) {
          // Si no podemos llegar al total, reduce para que el resto sea 0 o >= min
          const candidate = availableTickets - minTicketPurchase;
          // candidate puede ser mayor que MAX_PER_PURCHASE
          next = Math.min(Math.max(minTicketPurchase, candidate), MAX_PER_PURCHASE);
        }
      }
      return next;
    });
  };
  const dec = () => { if (disabledAll) return; setQty((q) => Math.max(minTicketPurchase, q - 1)); };
  const handleQtyChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = Number(e.target.value || minTicketPurchase);
    let val = Math.max(minTicketPurchase, Math.min(raw, availableTickets, MAX_PER_PURCHASE));
    if (!isFree) {
      const remainder = availableTickets - val;
      if (remainder > 0 && remainder < minTicketPurchase) {
        const candidate = availableTickets - minTicketPurchase;
        val = Math.min(Math.max(minTicketPurchase, candidate), MAX_PER_PURCHASE);
      }
    }
    setQty(val);
  };
  // Actualizar el número de tickets disponibles al montar y cuando cambie la rifa
  useEffect(() => {
    (async () => {
      try {
        if (isFree) return; // rifas gratis no dependen de tickets
        const all = await listTickets(raffleId);
        const available = (all ?? []).filter((t: any) => t.status === 'available').length;
        setAvailableTickets(available);
        // Si la cantidad seleccionada se sale del rango, ajusta respetando el mínimo configurado
        setQty((q) => {
          if (available <= 0) return minTicketPurchase;
          return Math.max(minTicketPurchase, Math.min(q, available));
        });
      } catch {}
    })();
  }, [raffleId, reserved.length, isFree]);

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
        if (isFree) {
          // En rifas gratis no rehidratamos reservas ni guardamos nada
          setReserved([]);
          setRestoreIds(null);
          setRestoring(false);
          return;
        }
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
    })().finally(() => { try { onBootReady?.(); } catch {} });
  }, [raffleId, sessionId, isFree, storageKey, bootCycle]);

  // Persistir IDs y deadline mínimo en localStorage cuando cambia la reserva
  useEffect(() => {
    try {
      if (isFree) return; // no persistimos nada para rifas gratis
      if (reserved?.length) {
        const ids = reserved.map((t: any) => t.id);
        const times = reserved
          .map((t: any) => (t.reserved_until ? new Date(t.reserved_until).getTime() : 0))
          .filter((ts: number) => ts > 0);
        const deadline = times.length ? Math.min(...times) : 0;
        const nums = reserved
          .map((t: any) => (t.ticket_number != null ? String(t.ticket_number) : null))
          .filter((n: string | null): n is string => typeof n === 'string');
        localStorage.setItem(storageKey, JSON.stringify({ ids, nums, deadline }));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {}
  }, [reserved, storageKey, isFree]);

  const handleContinue = async () => {
    if (disabledAll) return; // bloqueado (ej. rifa sorteada)
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      // En rifas gratis, no hay tickets ni reservas: mostrar directamente el formulario
      if (isFree) {
        const count = Math.max(1, qty);
        setReserved(Array.from({ length: count }, () => ({ __virtual: true })) as any[]);
        return;
      }
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
      // No es necesario invocar ensureSession aquí: la RPC ya lo hace.

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
          // Mensaje de reserva parcial omitido por requerimiento
          // if ((newReserved?.length ?? 0) < manualIds.length) {
          //   setInfo(`Solo pudimos reservar ${newReserved.length} de ${manualIds.length} seleccionados.`);
          // }
        } catch (e: any) {
          if (debugReservations) console.error('reserveTickets(manualIds) failed:', e);
          const msg = e?.message || String(e);
          setError(`Error al reservar (selección manual): ${msg}`);
        }
      } else {
        // Flujo directo: reservar en lotes para soportar cantidades grandes
        try {
          // Aplicar reglas: máximo 1000 y evitar resto < mínimo
          let desired = Math.max(minTicketPurchase, Math.min(qty, availableTickets, MAX_PER_PURCHASE));
          const remainder = availableTickets - desired;
          if (remainder > 0 && remainder < minTicketPurchase) {
            const candidate = availableTickets - minTicketPurchase;
            desired = Math.min(Math.max(minTicketPurchase, candidate), MAX_PER_PURCHASE);
          }
          const CHUNK = 1000;
          let remaining = desired;
          let aggregated: any[] = [];
          while (remaining > 0) {
            const take = Math.min(CHUNK, remaining);
            const res = await ensureAndReserveRandomTickets({ p_raffle_id: raffleId, p_total: totalTickets, p_session_id: sessionId, p_quantity: take, p_minutes: 10 });
            const arr = Array.isArray(res) ? res : [];
            aggregated = aggregated.concat(arr);
            remaining -= take;
            if (arr.length < take) break; // backend no devolvió suficientes
          }
          newReserved = aggregated.slice(0, desired);
          // Mensaje de reserva parcial omitido por requerimiento
          // if (newReserved.length < desired) {
          //   setInfo(`Solo pudimos reservar ${newReserved.length} de ${desired} solicitados.`);
          // }
        } catch (e: any) {
          if (debugReservations) console.error('ensureAndReserveRandomTickets failed:', e);
          const msg = e?.message || String(e);
          setError(`Error al reservar: ${msg}`);
        }
      }

      if (!newReserved.length) {
        // Ajuste: mensaje simplificado (se quita la parte de permisos a solicitud del usuario)
        setError((prev) => prev ?? "No se pudieron reservar tickets. Puede que no haya disponibilidad suficiente.");
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
  setQty(minTicketPurchase);
      setInfo(null);
      setError(null);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const ids = reserved.map((t) => (t as any).id).filter((id: any) => typeof id === 'string' && id.length > 0);
      if (!isFree && ids.length) await releaseTickets(ids, sessionId);
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
          const picked = Array.isArray(res) ? res : [];
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
  const urgent = !isExpired && timeLeftMs <= 60_000; // último minuto
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

  // Fallback programado: si por alguna razón el efecto de expiración no logra liberar (ej. tab oculta, race), agenda liberación al deadline
  useEffect(() => {
    if (isFree) return;
    if (!reserved.length) return;
    if (!deadline) return;
    const ms = Math.max(0, deadline - Date.now() + 1500); // 1.5s después del deadline
    const id = setTimeout(async () => {
      // Si ya se liberó o no hay reserva, salir
      if (!reserved.length || autoReleased) return;
      const expiredNow = Date.now() >= deadline;
      if (!expiredNow) return;
      try {
        const ids = reserved.map((t: any) => t.id).filter((id: any) => typeof id === 'string' && id.length);
        if (ids.length) {
          try { await releaseTickets(ids, sessionId); } catch {}
        }
        setReserved([]);
        setInfo(null);
        try {
          localStorage.removeItem(storageKey);
          localStorage.removeItem(`prizo_manual_${raffleId}`);
        } catch {}
      } catch {}
    }, ms);
    return () => clearTimeout(id);
  }, [deadline, reserved.length, autoReleased, isFree]);

  // Si vuelve a haber reservas nuevas, permitir nuevamente el auto-release en futuras expiraciones
  useEffect(() => {
    if (reserved.length) setAutoReleased(false);
  }, [reserved.length]);

  const reservedCount = reserved.length || (restoring && restoreIds ? restoreIds.length : 0);

  return (
    <div className="rounded-2xl border border-brand-500/20 p-3 sm:p-4 pb-20 bg-surface-800 text-white">
  {!isFree && <h2 className="text-lg md:text-xl font-extrabold tracking-wide uppercase text-center">¿Cuántos tickets quieres?</h2>}

      {error && (
        <div className="mt-3 p-2 text-sm rounded border bg-red-50 text-red-700">{error}</div>
      )}
      {info && (
        <div className="mt-3 p-2 text-sm rounded border bg-blue-50 text-blue-700">{info}</div>
      )}

      {!reserved.length && !restoring ? (
        <div className="mt-4 max-w-md mx-auto">
          {!isFree ? (
            <>
              <div className="mt-2 flex justify-center">
                <div className="inline-flex items-center overflow-hidden rounded-2xl bg-white text-black shadow-md ring-1 ring-brand-500/20">
                  <button
                    type="button"
                    className="px-5 h-12 sm:h-14 text-2xl font-bold hover:bg-brand-100 active:scale-95 transition disabled:opacity-60"
                    aria-label="Disminuir cantidad"
                    onClick={dec}
                    disabled={busy || disabledAll}
                  >−</button>
                  <input
                    className="w-20 sm:w-24 h-12 sm:h-14 text-center text-2xl sm:text-3xl font-semibold bg-transparent focus:outline-none no-number-spin"
                    type="number"
                    min={minTicketPurchase}
                    max={availableTickets}
                    value={qty}
                    onChange={handleQtyChange}
                    aria-label="Cantidad de tickets"
                    disabled={disabledAll}
                  />
                  <button
                    type="button"
                    className="px-5 h-12 sm:h-14 text-2xl font-bold hover:bg-brand-100 active:scale-95 transition disabled:opacity-60"
                    aria-label="Aumentar cantidad"
                    onClick={() => inc(1)}
                    disabled={busy || disabledAll}
                  >+</button>
                </div>
              </div>
              {minTicketPurchase === 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  {[2,5,10].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className="rounded-full px-3 py-2 text-sm sm:text-base bg-white/95 text-black ring-1 ring-brand-500/30 hover:bg-brand-100 transition disabled:opacity-60"
                      onClick={() => inc(n)}
                      disabled={busy || disabledAll}
                    >+{n}</button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="mt-2 flex items-center justify-center">
              <button
                type="button"
                className="btn-neon w-full sm:w-auto disabled:opacity-60"
                onClick={async () => { setQty(minTicketPurchase); await handleContinue(); }}
                disabled={disabledAll || busy || (!isFree && availableTickets <= 0)}
              >
                {busy && (
                  <span className="inline-block w-4 h-4 mr-2 border-2 border-white/70 border-t-transparent rounded-full align-[-2px] animate-spin" />
                )}
                Participar
              </button>
            </div>
          )}

          <p className="mt-4 text-center text-sm text-gray-300">
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

          {!isFree && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <button type="button" className="btn-neon w-full sm:w-auto disabled:opacity-60 flex items-center justify-center gap-2" onClick={handleContinue} disabled={busy}>
                {busy && <span className="inline-block w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />}
                Continuar
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-4 max-w-xl mx-auto">
          {!isFree && (
            <>
              <div className={`sticky top-2 z-20 text-base md:text-xl font-extrabold tracking-wide text-center p-3 rounded-lg border-2 shadow ${isExpired ? 'bg-red-600/10 border-red-500 text-red-600' : urgent ? 'bg-red-600/20 border-red-500 text-red-200 animate-pulse' : 'bg-brand-500/20 border-brand-500 text-brand-200'}`}>
                {isExpired ? (
                  <span>La reserva expiró. Vuelve a seleccionar tus tickets.</span>
                ) : (
                  <span>
                    ⏳ Reserva activa: <span className="font-black tabular-nums">{mm}:{ss}</span> restantes
                  </span>
                )}
              </div>
              {!isExpired && (rehydrated || restoring) && (
                <div className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded p-2">
                  {restoring ? 'Restaurando reserva basada en tu última sesión. Si estás sin conexión, verás datos temporales hasta reconectar.' : 'Reserva recuperada de tu sesión anterior.'}
                </div>
              )}
            </>
          )}
          {/* Resumen removido por redundante */}

          {/* Listado de números reservados oculto por requerimiento */}

          {/* Texto de tasa referencial removido por redundante */}

          {/* Instrucciones de pago ahora se muestran dentro del formulario (CheckoutForm) según el método seleccionado */}

          {isFree ? (
            <FreeParticipationForm
              raffleId={raffleId}
              sessionId={sessionId}
              disabled={disabledAll}
              quantity={reservedCount}
              onCreated={() => {
                try {
                  localStorage.removeItem(storageKey);
                  localStorage.removeItem(`prizo_manual_${raffleId}`);
                } catch {}
                setReserved([]);
                setQty(minTicketPurchase);
                setInfo('Participación registrada.');
              }}
            />
          ) : (
            <>
            <CheckoutForm
              raffleId={raffleId}
              sessionId={sessionId}
              currency={'VES'}
              disabled={isExpired}
              quantity={reservedCount}
              unitPriceCents={unitPriceCents}
              methodLabel={paymentInfo ? (paymentInfo.method_label ?? 'Pago') : 'Pago'}
              paymentMethods={paymentMethods}
              onCreated={() => {
                try {
                  // Limpiar estado local y cerrar temporizador sin liberar en la BD
                  localStorage.removeItem(storageKey);
                  localStorage.removeItem(`prizo_manual_${raffleId}`);
                } catch {}
                setReserved([]);
                setQty(minTicketPurchase);
                setInfo('Pago enviado. Tus tickets quedan reservados sin temporizador hasta que el administrador apruebe o rechace. Puedes comprar más si deseas.');
              }}
            />
            </>
          )}

          {!isFree && (
            <div className="flex items-center justify-end">
              <button
                type="button"
                className="text-base px-4 py-2 rounded-lg border-2 border-red-500 text-red-200 hover:bg-red-600 hover:text-white transition-colors shadow-sm tap-safe"
                onClick={() => setShowCancelConfirm(true)}
                disabled={busy}
              >Liberar y cerrar</button>
            </div>
          )}
        </div>
      )}

      {/* Modal de confirmación para cancelar y liberar reservas */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCancelConfirm(false)} />
          <div className="relative z-10 w-[95%] max-w-md rounded-xl bg-white p-5 shadow-xl text-black text-center">
            <h3 className="text-lg font-semibold">¿Cancelar y liberar tus tickets?</h3>
            <p className="mt-2 text-sm text-gray-600">Si cancelas ahora, perderás los tickets reservados y volverán a estar disponibles para otros usuarios.</p>
            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-lg border text-black"
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
