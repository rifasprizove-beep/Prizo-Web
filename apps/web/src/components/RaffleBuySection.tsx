"use client";
import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listTickets, reserveTickets, releaseTickets } from '@/lib/data/tickets';
import { ensureSession } from '@/lib/rpc';
import { getSessionId } from '@/lib/session';
import { TicketLegend } from './TicketLegend';
import { TicketNumber } from './TicketNumber';
import { CheckoutForm } from './CheckoutForm';
import { FreeParticipationForm } from './FreeParticipationForm';
import type { RafflePaymentInfo } from '@/lib/data/paymentConfig';

export function RaffleBuySection({ raffleId, currency, unitPriceCents, paymentInfo, isFree = false }: { raffleId: string; currency: string; unitPriceCents: number; paymentInfo: RafflePaymentInfo | null; isFree?: boolean }) {
  const qc = useQueryClient();
  const sessionId = getSessionId();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const storageKey = `prizo_manual_${raffleId}`;
  const [restoring, setRestoring] = useState(false);
  const [rehydrated, setRehydrated] = useState(false);
  const [restoreIds, setRestoreIds] = useState<string[] | null>(null);
  // Nota: antes almacenábamos los números para mostrar, pero no se usan en UI.
  const [restoreDeadline, setRestoreDeadline] = useState<number | null>(null);

  const ticketsQ = useQuery({
    queryKey: ['tickets', raffleId],
    queryFn: () => listTickets(raffleId),
    refetchInterval: selectedIds.length ? 1500 : 5000,
  });

  const releaseM = useMutation({
    mutationFn: (ids: string[]) => releaseTickets(ids, sessionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tickets', raffleId] }),
    onError: (e: any) => setErrorMsg(e?.message ?? 'No se pudieron liberar los tickets'),
  });

  const gridStyle = useMemo(() => ({ gridTemplateColumns: `repeat(10, minmax(2.5rem, 1fr))` }), []);

  // Rehidratación inicial desde localStorage
  useEffect(() => {
    (async () => {
      try {
        let idsFromStorage: string[] | null = null;
  // let numsFromStorage: number[] | null = null;
        let deadlineFromStorage: number | null = null;
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed?.ids)) idsFromStorage = parsed.ids;
            // if (Array.isArray(parsed?.nums)) numsFromStorage = parsed.nums;
            if (parsed?.deadline) deadlineFromStorage = Number(parsed.deadline);
          }
        } catch {}

        if (!idsFromStorage || !idsFromStorage.length) return;

        // Verificar en BD si siguen reservados por mí
        let mineByIds: any[] = [];
        try {
          const all = await listTickets(raffleId);
          mineByIds = (all ?? []).filter((t: any) => idsFromStorage!.includes(t.id) && t.status === 'reserved' && t.reserved_by === sessionId);
        } catch {}

        if (mineByIds.length) {
          setSelectedIds(idsFromStorage);
          setRehydrated(true);
        } else {
          // Activar modo restauración automática
          setRestoreIds(idsFromStorage);
          // setRestoreNums(numsFromStorage ?? null);
          if (deadlineFromStorage) setRestoreDeadline(deadlineFromStorage);
          setRestoring(true);
        }
      } catch (e) {
        console.warn('manual restore load failed:', e);
      }
    })();
  }, [raffleId, sessionId, storageKey]);

  const handleClick = async (id: string, status: string) => {
    if (busy) return;
    setErrorMsg(null);
    const isSel = selectedIds.includes(id);
    try {
      setBusy(true);
      if (!isSel && status === 'available') {
        try { await ensureSession(sessionId); } catch {}
      }
      if (isSel) {
        await releaseM.mutateAsync([id]);
        setSelectedIds((prev) => prev.filter((x) => x !== id));
      } else if (status === 'available') {
        // Importante: reserve_tickets en el backend define el CONJUNTO exacto para la sesión,
        // por lo que debemos enviar todos los IDs seleccionados + el nuevo ID, no solo uno.
        const desired = Array.from(new Set([...selectedIds, id]));
        const res = await reserveTickets(desired, sessionId);
        const arr = Array.isArray(res) ? res : [];
        // Liberar cualquier ticket que el backend haya devuelto que no está en nuestro objetivo (defensa)
        const extras = arr.filter((t: any) => !desired.includes(t.id)).map((t: any) => t.id);
        if (extras.length) {
          try { await releaseTickets(extras, sessionId); } catch {}
        }
        // Importante: reserve_tickets solo retorna filas ACTUALIZADAS en esta llamada.
        // Para no perder selecciones previas, consultamos el estado real y quedamos con los IDs deseados reservados por mi sesión.
        try {
          const fresh = await listTickets(raffleId);
          const mine = (fresh ?? [])
            .filter((t: any) => t.reserved_by === sessionId && t.status === 'reserved' && desired.includes(t.id))
            .map((t: any) => t.id);
          if (mine.length) {
            setSelectedIds(mine);
          } else {
            setErrorMsg('No se pudo reservar el ticket. Intenta otro.');
          }
        } catch {
          // Fallback: mantener al menos los que el RPC devolvió correctamente dentro del objetivo
          const kept = arr.filter((t: any) => desired.includes(t.id)).map((t: any) => t.id);
          if (kept.length) setSelectedIds((prev) => Array.from(new Set([...prev, ...kept])));
          else setErrorMsg('No se pudo reservar el ticket. Intenta otro.');
        }
        qc.invalidateQueries({ queryKey: ['tickets', raffleId] });
      }
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Ocurrió un error al actualizar la selección');
    } finally {
      setBusy(false);
    }
  };

  // Persistir selección + deadline mínimo cuando cambian tickets seleccionados
  useEffect(() => {
    try {
      if (selectedIds.length) {
        const data = (ticketsQ.data ?? []).filter((t: any) => selectedIds.includes(t.id));
        const times = data
          .map((t: any) => (t.reserved_until ? new Date(t.reserved_until).getTime() : 0))
          .filter((ts: number) => ts > 0);
        const deadline = times.length ? Math.min(...times) : (restoreDeadline ?? 0);
        const nums = data
          .map((t: any) => (typeof t.ticket_number === 'number' ? t.ticket_number : null))
          .filter((n: number | null): n is number => typeof n === 'number');
        localStorage.setItem(storageKey, JSON.stringify({ ids: selectedIds, nums, deadline }));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, ticketsQ.data]);

  // Timer: calcula deadline con el menor reserved_until
  const reservedByMe = useMemo(() => {
    return (ticketsQ.data ?? []).filter(
      (t: any) => selectedIds.includes(t.id) && t.status === 'reserved' && t.reserved_by === sessionId && t.reserved_until
    );
  }, [ticketsQ.data, selectedIds, sessionId]);

  const deadline = useMemo(() => {
    const times = reservedByMe
      .map((t: any) => (t.reserved_until ? new Date(t.reserved_until).getTime() : 0))
      .filter((ts: number) => ts > 0);
    if (times.length) return Math.min(...times);
    if (restoring && restoreDeadline) return restoreDeadline;
    return 0;
  }, [reservedByMe, restoring, restoreDeadline]);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const timeLeftMs = deadline ? Math.max(0, deadline - now) : 0;
  const isExpired = deadline === 0 || timeLeftMs <= 0;
  const mm = String(Math.floor(timeLeftMs / 60000)).padStart(2, '0');
  const ss = String(Math.floor((timeLeftMs % 60000) / 1000)).padStart(2, '0');
  const countSelected = selectedIds.length || (restoring && restoreIds ? restoreIds.length : 0);

  // Auto-liberar selección cuando expira el tiempo (solo rifas pagas)
  const [autoReleased, setAutoReleased] = useState(false);
  useEffect(() => {
    if (isFree) return; // no aplica para rifas gratuitas
    if (!isExpired) return;
    if (!selectedIds.length) return;
    if (autoReleased) return;
    let cancelled = false;
    (async () => {
      try {
        setAutoReleased(true);
        try { await releaseM.mutateAsync(selectedIds); } catch {}
        if (!cancelled) {
          setSelectedIds([]);
          setShowCancelConfirm(false);
          setErrorMsg('Tu reserva expiró y tus tickets fueron liberados automáticamente.');
          try { localStorage.removeItem(storageKey); } catch {}
        }
      } catch {}
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpired, selectedIds.length, isFree]);

  // Si vuelve a haber selección nueva, permitir nuevamente el auto-release en futuras expiraciones
  useEffect(() => {
    if (selectedIds.length) setAutoReleased(false);
  }, [selectedIds.length]);

  // Restauración automática: intenta reservar de nuevo los IDs guardados usando minutos restantes
  useEffect(() => {
    (async () => {
      if (!(restoring && restoreIds && restoreIds.length) || selectedIds.length) return;
      try {
        setBusy(true);
        setErrorMsg(null);
        try { await ensureSession(sessionId); } catch {}
        const remainingMinutes = restoreDeadline ? Math.max(1, Math.ceil((restoreDeadline - Date.now()) / 60000)) : 10;
        const res = await reserveTickets(restoreIds, sessionId, remainingMinutes);
        const arr = Array.isArray(res) ? res : [];
        if (arr.length) {
          const kept = arr.map((t: any) => t.id);
          setSelectedIds(kept);
          setRehydrated(true);
          setRestoring(false);
          setRestoreIds(null);
          // setRestoreNums(null);
        }
      } catch (e: any) {
        // Si falla, seguir en modo restoring basado en storage
        console.warn('manual auto restore failed:', e?.message ?? e);
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoring, restoreIds, restoreDeadline]);

  return (
    <div className="space-y-6">
  {!isFree && <TicketLegend />}

      {errorMsg && (
        <div className="p-2 text-sm rounded border bg-red-50 text-red-700">{errorMsg}</div>
      )}

      {!isFree && ticketsQ.isLoading && !restoring ? (
        <div className="p-4">Cargando tickets…</div>
      ) : !isFree ? (
        <div className="grid gap-2" style={gridStyle as any}>
          {(ticketsQ.data ?? []).map((t: any) => (
            <TicketNumber
              key={t.id}
              t={t}
              isSelected={selectedIds.includes(t.id)}
              onClick={() => handleClick(t.id, t.status)}
            />
          ))}
        </div>
      ) : (
        <div className="max-w-xl mx-auto w-full">
          {!selectedIds.length && (
            <div className="flex items-center justify-center">
              <button
                type="button"
                className="px-6 py-3 rounded-lg bg-pink-600 text-white disabled:opacity-60"
                disabled={busy}
                onClick={async () => {
                  try {
                    setBusy(true);
                    setErrorMsg(null);
                    try { await ensureSession(sessionId); } catch {}
                    // Elegir un ticket disponible al azar y reservarlo
                    const all = await listTickets(raffleId);
                    const avail = (all ?? []).filter((t: any) => t.status === 'available');
                    if (!avail.length) {
                      setErrorMsg('No hay tickets disponibles en este momento.');
                      return;
                    }
                    const idx = Math.floor(Math.random() * avail.length);
                    const pick = avail[idx];
                    const res = await reserveTickets([pick.id], sessionId, 10);
                    const arr = Array.isArray(res) ? res : [];
                    const ok = arr.find((t: any) => t.id === pick.id);
                    if (ok) {
                      setSelectedIds([pick.id]);
                    } else {
                      setErrorMsg('No se pudo reservar el ticket. Intenta nuevamente.');
                    }
                  } catch (e: any) {
                    setErrorMsg(e?.message ?? 'No se pudo realizar la participación.');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy && (
                  <span className="inline-block w-4 h-4 mr-2 border-2 border-white/70 border-t-transparent rounded-full align-[-2px] animate-spin" />
                )}
                Participar
              </button>
            </div>
          )}
        </div>
      )}

      {(!!selectedIds.length || (restoring && restoreIds && restoreIds.length)) && (
        <div className="max-w-xl mx-auto w-full space-y-3">
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
                  {restoring ? 'Restaurando tu selección anterior…' : 'Selección recuperada de tu sesión anterior.'}
                </div>
              )}
            </>
          )}
          {/* Resumen y números */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="p-2 rounded border bg-gray-50">
              <div className="text-xs text-gray-600">Cantidad</div>
              <div className="font-semibold">{countSelected}</div>
            </div>
          </div>
          {/* Oculto: no mostrar los números seleccionados explícitamente */}

          {/* Instrucciones de pago: ocultas en rifas gratuitas */}
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
                {paymentInfo.active === false && (
                  <div className="mt-2 text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded p-2">
                    Pago Móvil configurado — <b>Esta rifa no está activa</b>
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
              quantity={countSelected}
              onCreated={() => {
                try { localStorage.removeItem(storageKey); } catch {}
                setSelectedIds([]);
              }}
            />
          ) : (
            <CheckoutForm
              raffleId={raffleId}
              sessionId={sessionId}
              currency={currency}
              disabled={isExpired}
              quantity={countSelected}
              unitPriceCents={unitPriceCents}
              methodLabel={paymentInfo ? 'Pago Móvil' : 'Pago'}
              onCreated={() => {}}
            />
          )}

          <div className="flex items-center justify-end">
            <button
              type="button"
              className="text-sm px-3 py-1.5 rounded border"
              onClick={() => setShowCancelConfirm(true)}
              disabled={busy}
            >Cancelar y liberar</button>
          </div>
        </div>
      )}

      {/* Modal confirmación de cancelación */}
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
              >Seguir con la compra</button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-red-600 text-white disabled:opacity-60"
                onClick={async () => {
                  try {
                    setBusy(true);
                    setErrorMsg(null);
                    const ids = [...selectedIds];
                    if (ids.length) {
                      await releaseM.mutateAsync(ids);
                    }
                    setSelectedIds([]);
                    try { localStorage.removeItem(storageKey); } catch {}
                  } catch (e: any) {
                    setErrorMsg(e?.message ?? 'No se pudieron liberar los tickets');
                  } finally {
                    setBusy(false);
                    setShowCancelConfirm(false);
                  }
                }}
                disabled={busy}
              >Sí, cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
