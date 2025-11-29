import type { Winner } from '@/lib/types';

// Formatea el número de ticket con ceros a la izquierda (ej: 1 => 0001)
function formatTicket(n: number | null) {
  if (n == null) return '—';
  return String(n).padStart(4, '0');
}

function positionBadge(n: number) {
  const base = 'inline-flex items-center justify-center min-w-8 h-7 px-2 rounded-full text-xs font-bold tabular-nums';
  if (n === 1) return <span className={`${base} bg-yellow-100 text-yellow-800 border border-yellow-300`}>🥇 {n}</span>;
  if (n === 2) return <span className={`${base} bg-gray-100 text-gray-800 border border-gray-300`}>🥈 {n}</span>;
  if (n === 3) return <span className={`${base} bg-amber-100 text-amber-800 border border-amber-300`}>🥉 {n}</span>;
  return <span className={`${base} bg-slate-100 text-slate-700 border border-slate-300`}>#{n}</span>;
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
            <th className="px-3 sm:px-4 py-2 text-left font-semibold">Posición</th>
            <th className="px-3 sm:px-4 py-2 text-left font-semibold">Ticket</th>
            <th className="px-3 sm:px-4 py-2 text-left font-semibold">Ganador</th>
          </tr>
        </thead>
        <tbody>
          {winners.map((w, i) => {
            const handle = w.instagram_user
              ? `@${w.instagram_user.replace(/^@/, '')}`
              : (w.winner_name ?? '—');
            return (
              <tr key={w.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-3 sm:px-4 py-2">{positionBadge(Number(w.position ?? i + 1))}</td>
                <td className="px-3 sm:px-4 py-2"><span className="inline-block px-2 py-1 rounded-md bg-slate-100 border border-slate-300 font-mono tabular-nums">{formatTicket(w.ticket_number_snapshot)}</span></td>
                <td className="px-3 sm:px-4 py-2 font-semibold break-words">{handle}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
