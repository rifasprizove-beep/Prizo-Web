import type { Winner } from '@/lib/types';

export default function WinnerTable({ winners }: { winners: Winner[] }) {
  if (!winners?.length) {
    return (
      <div className="rounded-xl border p-4 bg-white text-gray-700">
        Aún no hay ganadores registrados.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="min-w-full text-sm text-gray-800">
        <thead>
          <tr className="bg-gray-50 text-gray-600">
            <th className="px-4 py-2 text-left">Posición</th>
            <th className="px-4 py-2 text-left">Ticket</th>
            <th className="px-4 py-2 text-left">Ganador</th>
            <th className="px-4 py-2 text-left">Tipo</th>
            <th className="px-4 py-2 text-left">Fecha</th>
          </tr>
        </thead>
        <tbody>
          {winners.map((w, i) => (
            <tr key={w.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-4 py-2 font-semibold">#{w.position}</td>
              <td className="px-4 py-2">{w.ticket_number_snapshot ?? '—'}</td>
              <td className="px-4 py-2">{w.winner_name || (w.instagram_user ? `@${w.instagram_user}` : '—')}</td>
              <td className="px-4 py-2 capitalize">{w.type?.replace('_', ' ')}</td>
              <td className="px-4 py-2">{new Date(w.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
