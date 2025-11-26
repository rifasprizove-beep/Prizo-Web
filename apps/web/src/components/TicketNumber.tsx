"use client";
import clsx from 'clsx';

export function TicketNumber({ t, isSelected, onClick }: {
  t: any;
  isSelected: boolean;
  onClick: () => void;
}) {
  const status = isSelected ? 'selected' : t.status;
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'h-10 sm:h-12 rounded-md text-sm sm:text-base font-medium border transition',
        status === 'available' && 'bg-white hover:bg-gray-50 text-black',
        status === 'reserved' && 'bg-yellow-100 border-yellow-300 text-yellow-900',
        status === 'sold' && 'bg-gray-200 text-gray-500 cursor-not-allowed',
        status === 'selected' && 'bg-black text-white'
      )}
      disabled={t.status === 'sold'}
      aria-pressed={isSelected}
      aria-label={`Ticket ${t.ticket_number} (${t.status})`}
    >
      {t.ticket_number}
    </button>
  );
}
