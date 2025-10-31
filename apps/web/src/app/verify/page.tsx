"use client";
import { useState } from 'react';

type VerifyRow = {
  raffle_id: string;
  raffle_name: string;
  ticket_id: string;
  ticket_number: number;
  ticket_status: 'available' | 'reserved' | 'sold' | 'void' | 'refunded';
  payment_id: string;
  payment_status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  created_at: string;
};

export default function VerifyPage() {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<VerifyRow[] | null>(null);

  const handleCheck = async () => {
    setErr(null);
    setData(null);
    const term = q.trim();
    if (!term || term.length < 2) {
      setErr('Ingresa correo o cédula de identidad (mínimo 2 caracteres).');
      return;
    }
    setBusy(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_URL || '';
      if (!base) throw new Error('API no configurada. Define NEXT_PUBLIC_API_URL');
      const url = `${base}/verify?q=${encodeURIComponent(term)}&include_pending=true`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const j = await res.json();
      const rows: VerifyRow[] = j?.data ?? [];
      setData(rows);
      if (!rows.length) setErr('No hay registros con ese correo o cédula.');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'No se pudo consultar';
      setErr(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mt-6 space-y-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <span className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-pink-600 text-white">🔎</span>
        Verificar tickets
      </h1>

      <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
        <label className="block">
          <div className="text-sm text-gray-600">Correo o Cédula</div>
          <input value={q} onChange={(e) => setQ(e.target.value)} className="mt-1 w-full p-2 border rounded" placeholder="ej. micorreo@mail.com o V-12345678" />
        </label>
        <button className="px-4 py-2 rounded bg-black text-white flex items-center gap-2" onClick={handleCheck} disabled={busy}>
          <span>🔎</span>
          <span>Buscar</span>
        </button>
      </div>

      {err && (
        <div className="p-3 rounded border bg-red-50 text-red-700 text-sm">{err}</div>
      )}
      {busy && (
        <div className="p-3 rounded border bg-white text-sm">Buscando…</div>
      )}
      {data && data.length > 0 && (
        <div className="space-y-3">
          {/* Resumen profesional */}
          <div className="rounded-xl border bg-white p-3 text-sm flex flex-wrap items-center gap-3">
            <span className="font-semibold">Resultados: {data.length}</span>
            <span className="inline-flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800">Aprobado: {data.filter(r => r.payment_status === 'approved').length}</span>
              <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">En revisión: {data.filter(r => r.payment_status === 'pending').length}</span>
              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800">Rechazado: {data.filter(r => r.payment_status === 'rejected').length}</span>
            </span>
          </div>

          <div className="rounded-2xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="text-left p-2 border-b">Rifa</th>
                <th className="text-left p-2 border-b">Ticket</th>
                <th className="text-left p-2 border-b">Estado Ticket</th>
                <th className="text-left p-2 border-b">Estado Pago</th>
                <th className="text-left p-2 border-b">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={`${r.payment_id}-${r.ticket_id}`} className="odd:bg-white even:bg-gray-50">
                  <td className="p-2 border-b">{r.raffle_name}</td>
                  <td className="p-2 border-b">{r.ticket_number}</td>
                  <td className="p-2 border-b">
                    {r.ticket_status === 'sold' && (
                      <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800">VENDIDO</span>
                    )}
                    {r.ticket_status === 'reserved' && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">RESERVADO</span>
                    )}
                    {r.ticket_status === 'available' && (
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">DISPONIBLE</span>
                    )}
                    {!(r.ticket_status === 'sold' || r.ticket_status === 'reserved' || r.ticket_status === 'available') && (
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{String(r.ticket_status).toUpperCase()}</span>
                    )}
                  </td>
                  <td className="p-2 border-b">
                    {r.payment_status === 'approved' && (
                      <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800">APROBADO</span>
                    )}
                    {r.payment_status === 'pending' && (
                      <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">EN REVISIÓN</span>
                    )}
                    {r.payment_status === 'rejected' && (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800">RECHAZADO</span>
                    )}
                    {r.payment_status === 'cancelled' && (
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">CANCELADO</span>
                    )}
                  </td>
                  <td className="p-2 border-b">{new Date(r.created_at).toLocaleString()}</td>
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
