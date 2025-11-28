"use client";
import { useEffect, useState } from 'react';
import { verifyTicketsClient } from '@/lib/rpc';

type VerifyRow = {
  raffle_id: string;
  raffle_name: string;
  ticket_id: string;
  ticket_number: string; // cambiado a string
  ticket_status: 'available' | 'reserved' | 'sold' | 'void' | 'refunded';
  payment_id: string;
  payment_status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'underpaid' | 'overpaid' | 'ref_mismatch';
  created_at: string;
};

export default function VerifyPage() {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<VerifyRow[] | null>(null);
  const [selectedRaffle, setSelectedRaffle] = useState<string>('all');
  const [mode, setMode] = useState<'email' | 'cedula'>('email');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Placeholder dinámico
  const placeholder = mode === 'email'
    ? 'ej. micorreo@mail.com'
    : 'ej. V-12345678';

  // Emitir evento opcional para otros componentes
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('prizo:search-mode', { detail: mode }));
      }
    } catch {}
  }, [mode]);

  const handleCheck = async () => {
    setErr(null);
    setData(null);
    setPage(1);
    const term = q.trim();
    // Validaciones según modo
    if (!term) {
      setErr('Ingresa un valor para buscar.');
      return;
    }
    if (mode === 'email') {
      if (term.length < 5 || !term.includes('@')) {
        setErr('Ingresa un correo válido (debe contener @).');
        return;
      }
    } else {
      // Patrón básico para cédula: opcional prefijo V- o E- seguido de 5 a 10 dígitos
      const cedulaOk = /^(?:[VE]-)?\d{5,10}$/.test(term.toUpperCase());
      if (!cedulaOk) {
        setErr('Formato de cédula inválido. Usa V-12345678');
        return;
      }
    }
    setBusy(true);
    try {
      // Usar cliente con fallback: intenta API y si falla por CORS/timeout, usa Supabase RPC
      const result = await verifyTicketsClient(term, true);
      if (result === null) {
        throw new Error('No se pudo consultar (permiso o servicio no disponible).');
      }
      const rows: VerifyRow[] = result as VerifyRow[];
      setData(rows);
      // si hay exactamente una rifa en los resultados, seleccionarla por defecto
      const raffleIds = Array.from(new Set(rows.map(r => r.raffle_id)));
      if (raffleIds.length === 1) setSelectedRaffle(raffleIds[0]);
      if (!rows.length) setErr(`No hay registros con ese ${mode === 'email' ? 'correo' : 'cédula'}.`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'No se pudo consultar';
      setErr(message);
    } finally {
      setBusy(false);
    }
  };

  // Resetear a la primera página cuando cambian los filtros/datos
  useEffect(() => { setPage(1); }, [selectedRaffle]);
  useEffect(() => { setPage(1); }, [data?.length]);

  return (
    <main className="mt-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2 title-neon">
        Verificar tickets
      </h1>

      {/* Barra de búsqueda mejorada */}
      <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
        <label className="block space-y-2">
          {/* Toggle estilo CurrencyToggle */}
          <div
            className="relative inline-flex items-center rounded-full border border-brand-300 text-brand-200 bg-transparent px-1 py-1 shadow-glowSm select-none"
            role="group"
            aria-label="Modo de búsqueda"
          >
            <span
              className={`absolute top-1 bottom-1 rounded-full bg-brand-500 transition-all duration-300 ease-out ${
                mode === 'cedula' ? 'left-1/2 right-1' : 'left-1 right-1/2'
              }`}
              aria-hidden="true"
            />
            <button
              type="button"
              onClick={() => setMode('email')}
              aria-pressed={mode === 'email'}
              className={`relative z-10 px-4 py-1.5 text-xs font-semibold transition-colors ${
                mode === 'email' ? 'text-black' : 'text-brand-200 hover:text-white/90'
              }`}
            >Correo</button>
            <button
              type="button"
              onClick={() => setMode('cedula')}
              aria-pressed={mode === 'cedula'}
              className={`relative z-10 px-4 py-1.5 text-xs font-semibold transition-colors ${
                mode === 'cedula' ? 'text-black' : 'text-brand-200 hover:text-white/90'
              }`}
            >Cédula</button>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-white ring-1 ring-gray-300 focus-within:ring-2 focus-within:ring-brand-500 px-3 py-2 shadow-sm">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCheck(); }}
              className="w-full outline-none bg-transparent text-black placeholder:text-gray-500"
              placeholder={placeholder}
            />
          </div>
        </label>
        <button
          className="px-5 py-2.5 rounded-lg bg-black text-white flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-glowSm"
          onClick={handleCheck}
          disabled={busy}
          aria-label="Buscar"
        >
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path></svg>
              Buscando…
            </span>
          ) : (
            <>
              <span>Buscar</span>
            </>
          )}
        </button>
      </div>

      {err && (
        <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">{err}</div>
      )}
      {busy && (
        <div className="p-3 rounded-lg border bg-white text-black text-sm shadow-sm">Buscando…</div>
      )}
      {data && data.length > 0 && (
        <div className="space-y-4">
          {/* Filtrado por rifa (solo si hay más de una) */}
          {Array.from(new Set(data.map(d => d.raffle_id))).length > 1 && (
            <div className="space-y-1">
              <div className="text-sm font-medium text-white">Filtrar por rifa</div>
              <div className="flex items-center gap-2">
                <div className="flex items-center w-full max-w-xs rounded-lg bg-white ring-1 ring-gray-300 focus-within:ring-2 focus-within:ring-brand-500 px-3 py-2 shadow-sm">
                  <select
                    value={selectedRaffle}
                    onChange={(e) => setSelectedRaffle(e.target.value)}
                    className="w-full outline-none bg-transparent text-black text-sm"
                  >
                    <option value="all">Todas las rifas</option>
                    {Array.from(new Map(data.map(d => [d.raffle_id, d.raffle_name]))).map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Datos derivados: visibles por rifa y paginados */}
          {(() => {
            return null;
          })()}

          {(() => {
            const visibleRows = selectedRaffle === 'all' ? data : data.filter(r => r.raffle_id === selectedRaffle);
            const approvedCount = visibleRows.filter(r => r.payment_status === 'approved').length;
            const pendingCount = visibleRows.filter(r => r.payment_status === 'pending').length;
            // Mostrar banner SOLO si se eligió una rifa específica y hay pendientes pero ninguno aprobado
            if (selectedRaffle !== 'all' && pendingCount > 0 && approvedCount === 0) {
              return (
                <div className="p-3 rounded-lg border border-yellow-300 bg-yellow-50 text-yellow-800 text-sm">
                  Esta rifa tiene pagos pendientes de aprobación.
                </div>
              );
            }
            return null;
          })()}

          {/* Resumen */}
          <div className="rounded-xl border bg-white p-4 text-sm text-black flex flex-wrap items-center gap-3 shadow-sm">
            {(() => {
              const visibleRows = (selectedRaffle === 'all' ? data : data.filter(r => r.raffle_id === selectedRaffle)) as VerifyRow[];
              const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
              return (
                <>
                  <span className="font-semibold">Resultados: {visibleRows.length}</span>
                  <span className="inline-flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800">Aprobado: {visibleRows.filter(r => r.payment_status === 'approved').length}</span>
                    <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">En revisión: {visibleRows.filter(r => r.payment_status === 'pending').length}</span>
                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800">Rechazado: {visibleRows.filter(r => r.payment_status === 'rejected').length}</span>
                    <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800" title="Monto recibido menor al debido">Monto menor: {visibleRows.filter(r => r.payment_status === 'underpaid').length}</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800" title="Monto recibido mayor al debido">Monto mayor: {visibleRows.filter(r => r.payment_status === 'overpaid').length}</span>
                    <span className="px-2 py-0.5 rounded-full bg-fuchsia-100 text-fuchsia-800" title="La referencia no coincide o no se puede verificar">Ref. inválida: {visibleRows.filter(r => r.payment_status === 'ref_mismatch').length}</span>
                  </span>
                  {/* Indicador de página removido del resumen a pedido */}
                </>
              );
            })()}
          </div>

          {/* Controles de paginación */}
          {(() => {
            const visibleRows = (selectedRaffle === 'all' ? data : data.filter(r => r.raffle_id === selectedRaffle)) as VerifyRow[];
            const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
            if (totalPages <= 1) return null;
            return (
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded border bg-white text-black disabled:opacity-50"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >Anterior</button>
                <div className="text-xs text-white/90">Página {page} de {totalPages}</div>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded border bg-white text-black disabled:opacity-50"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >Siguiente</button>
              </div>
            );
          })()}

          {/* Vista tarjetas para móvil */}
          <div className="sm:hidden grid grid-cols-1 gap-3">
            {(() => {
              const visibleRows = (selectedRaffle === 'all' ? data : data.filter(r => r.raffle_id === selectedRaffle)) as VerifyRow[];
              const start = (page - 1) * pageSize;
              const paged = visibleRows.slice(start, start + pageSize);
              return paged;
            })().map((r) => (
              <div key={`${r.payment_id}-${r.ticket_id}`} className="rounded-xl border bg-white p-3 text-black shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{r.raffle_name}</div>
                  <div className="text-xs text-gray-600">#{r.ticket_number}</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 border border-gray-200">Ticket: {r.ticket_status === 'sold' ? 'VENDIDO' : r.ticket_status === 'reserved' ? 'RESERVADO' : r.ticket_status === 'available' ? 'DISPONIBLE' : String(r.ticket_status).toUpperCase()}</span>
                  <span
                    className={
                      `px-2 py-0.5 rounded-full border text-xs ` +
                      (r.payment_status === 'approved'
                        ? 'bg-green-100 text-green-800 border-green-200'
                        : r.payment_status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                        : r.payment_status === 'rejected'
                        ? 'bg-red-100 text-red-800 border-red-200'
                        : r.payment_status === 'underpaid'
                        ? 'bg-orange-100 text-orange-800 border-orange-200'
                        : r.payment_status === 'overpaid'
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : r.payment_status === 'ref_mismatch'
                        ? 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200'
                        : 'bg-gray-100 text-gray-800 border-gray-200')
                    }
                    title={
                      r.payment_status === 'underpaid'
                        ? 'Monto recibido menor al debido'
                        : r.payment_status === 'overpaid'
                        ? 'Monto recibido mayor al debido'
                        : r.payment_status === 'ref_mismatch'
                        ? 'La referencia no coincide o no se puede verificar'
                        : undefined
                    }
                  >
                    Pago: {
                      r.payment_status === 'approved' ? 'APROBADO' :
                      r.payment_status === 'pending' ? 'EN REVISIÓN' :
                      r.payment_status === 'rejected' ? 'RECHAZADO' :
                      r.payment_status === 'underpaid' ? 'MONTO MENOR' :
                      r.payment_status === 'overpaid' ? 'MONTO MAYOR' :
                      r.payment_status === 'ref_mismatch' ? 'REF. NO COINCIDE' :
                      'CANCELADO'
                    }
                  </span>
                </div>
                <div className="mt-2 text-xs text-gray-600">{new Date(r.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>

          {/* Tabla para pantallas grandes */}
          <div className="hidden sm:block rounded-2xl border overflow-hidden bg-white">
            <table className="w-full text-sm text-gray-900">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="text-left p-3 border-b">Rifa</th>
                  <th className="text-left p-3 border-b">Ticket</th>
                  <th className="text-left p-3 border-b">Estado Ticket</th>
                  <th className="text-left p-3 border-b">Estado Pago</th>
                  <th className="text-left p-3 border-b">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const visibleRows = (selectedRaffle === 'all' ? data : data.filter(r => r.raffle_id === selectedRaffle)) as VerifyRow[];
                  const start = (page - 1) * pageSize;
                  const paged = visibleRows.slice(start, start + pageSize);
                  return paged;
                })().map((r) => (
                  <tr key={`${r.payment_id}-${r.ticket_id}`} className="odd:bg-white even:bg-gray-50">
                    <td className="p-3 border-b">{r.raffle_name}</td>
                    <td className="p-3 border-b">{r.ticket_number}</td>
                    <td className="p-3 border-b">
                      {r.ticket_status === 'sold' && (
                        <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-200">VENDIDO</span>
                      )}
                      {r.ticket_status === 'reserved' && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">RESERVADO</span>
                      )}
                      {r.ticket_status === 'available' && (
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 border border-gray-200">DISPONIBLE</span>
                      )}
                      {!(r.ticket_status === 'sold' || r.ticket_status === 'reserved' || r.ticket_status === 'available') && (
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 border border-gray-200">{String(r.ticket_status).toUpperCase()}</span>
                      )}
                    </td>
                    <td className="p-3 border-b">
                      {r.payment_status === 'approved' && (
                        <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 border border-green-200">APROBADO</span>
                      )}
                      {r.payment_status === 'pending' && (
                        <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">EN REVISIÓN</span>
                      )}
                      {r.payment_status === 'rejected' && (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">RECHAZADO</span>
                      )}
                      {r.payment_status === 'underpaid' && (
                        <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200" title="Monto recibido menor al debido">MONTO MENOR</span>
                      )}
                      {r.payment_status === 'overpaid' && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200" title="Monto recibido mayor al debido">MONTO MAYOR</span>
                      )}
                      {r.payment_status === 'ref_mismatch' && (
                        <span className="px-2 py-0.5 rounded-full bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200" title="La referencia no coincide o no se puede verificar">REF. NO COINCIDE</span>
                      )}
                      {r.payment_status === 'cancelled' && (
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 border border-gray-200">CANCELADO</span>
                      )}
                    </td>
                    <td className="p-3 border-b">{new Date(r.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
