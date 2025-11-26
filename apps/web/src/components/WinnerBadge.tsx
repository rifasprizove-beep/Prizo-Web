import type { Winner } from '@/lib/types';

export default function WinnerBadge({ w }: { w: Winner }) {
  return (
    <div className="rounded-2xl border p-3 bg-white shadow-sm flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-3 justify-between">
      <div className="space-y-0.5">
        <div className="text-xs text-gray-500">Posición</div>
        <div className="text-2xl font-bold">#{w.position}</div>
      </div>
      <div className="flex-1 px-0 sm:px-4 w-full">
        <div className="text-sm text-gray-500">Ticket</div>
        <div className="text-base sm:text-lg font-semibold">
          {w.ticket_number_snapshot ?? '—'}
        </div>
        {w.rule_applied && (
          <div className="text-xs text-gray-500 mt-1">Regla: {w.rule_applied}</div>
        )}
      </div>
      <div className="text-right w-full sm:w-auto">
        <div className="text-sm text-gray-500">Ganador</div>
        <div className="font-medium break-words">
          {w.winner_name ?? 'Pendiente'}
        </div>
        {w.instagram_user && (
          <div className="text-xs text-gray-600 break-all">@{w.instagram_user}</div>
        )}
      </div>
    </div>
  );
}
