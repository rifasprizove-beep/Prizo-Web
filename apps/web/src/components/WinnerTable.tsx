import type { Winner } from '@/lib/types';

function formatDate(d: string | Date) {
  try {
    const dt = typeof d === 'string' ? new Date(d) : d;
    return dt.toLocaleString('es-VE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(d);
  }
}

function positionBadge(n: number) {
  const base = 'inline-flex items-center justify-center min-w-8 h-7 px-2 rounded-full text-xs font-bold tabular-nums';
  if (n === 1) return <span className={`${base} bg-yellow-100 text-yellow-800 border border-yellow-300`}>🥇 {n}</span>;
  if (n === 2) return <span className={`${base} bg-gray-100 text-gray-800 border border-gray-300`}>🥈 {n}</span>;
  if (n === 3) return <span className={`${base} bg-amber-100 text-amber-800 border border-amber-300`}>🥉 {n}</span>;
  return <span className={`${base} bg-slate-100 text-slate-700 border border-slate-300`}>#{n}</span>;
}

function typeBadge(t?: string | null) {
  if (!t) return <span className="text-slate-500">—</span>;
  const label = t.replace(/_/g, ' ');
  return <span className="inline-block px-2 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300 capitalize">{label}</span>;
}

export default function WinnerTable({ winners }: { winners: Winner[] }) {
  if (!winners?.length) {
    return (
      <div className="rounded-xl border p-4 bg-white text-gray-700">
        Aún no hay ganadores registrados.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
      <table className="min-w-full text-sm text-gray-800">
        <caption className="sr-only">Resultados del sorteo</caption>
        <thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur supports-[backdrop-filter]:bg-gray-50/70 text-gray-600">
          <tr>
            <th className="px-4 py-2 text-left font-semibold">Posición</th>
            <th className="px-4 py-2 text-left font-semibold">Ticket</th>
            <th className="px-4 py-2 text-left font-semibold">Ganador</th>
            <th className="px-4 py-2 text-left font-semibold">Tipo</th>
            <th className="px-4 py-2 text-left font-semibold">Fecha</th>
            <th className="px-4 py-2 text-left font-semibold">Imagen</th>
          </tr>
        </thead>
        <tbody>
          {winners.map((w, i) => (
            <tr key={w.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-4 py-2">{positionBadge(Number(w.position ?? i + 1))}</td>
              <td className="px-4 py-2"><span className="inline-block px-2 py-1 rounded-md bg-slate-100 border border-slate-300 font-mono tabular-nums">{w.ticket_number_snapshot ?? '—'}</span></td>
              <td className="px-4 py-2">
                <div className="leading-tight">
                  <div className="font-semibold">{w.winner_name || (w.instagram_user ? `@${w.instagram_user}` : '—')}</div>
                  {w.instagram_user && w.winner_name && (
                    <div className="text-xs text-gray-500">@{w.instagram_user}</div>
                  )}
                </div>
              </td>
              <td className="px-4 py-2">{typeBadge(w.type)}</td>
              <td className="px-4 py-2 tabular-nums whitespace-nowrap">{formatDate(w.created_at)}</td>
              <td className="px-4 py-2">
                {w.image_url ? (
                  <a href={w.image_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={w.image_url} alt={`Imagen del ganador ${w.winner_name ?? w.instagram_user ?? ''}`} className="h-10 w-10 rounded object-cover border border-slate-300 group-hover:opacity-90" />
                    <span className="text-xs text-pink-700 underline">Abrir</span>
                  </a>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
