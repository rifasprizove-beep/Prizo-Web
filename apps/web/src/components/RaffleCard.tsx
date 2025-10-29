"use client";
import type { Raffle } from '@/lib/types';

function formatPrice(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export function RaffleCard({ raffle }: { raffle: Raffle }) {
  return (
    <a
      href={`/raffles/${raffle.id}`}
      className="block rounded-xl overflow-hidden border border-pink-100 hover:shadow-md transition-shadow bg-white"
    >
      {raffle.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={raffle.image_url}
          alt={raffle.name}
          className="w-full h-44 object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-44 bg-pink-50" />
      )}
      <div className="p-3">
        <h3 className="font-semibold text-gray-900 line-clamp-1">{raffle.name}</h3>
        <div className="mt-1 text-sm text-gray-600 line-clamp-2 min-h-[2.5rem]">
          {raffle.description ?? ''}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-pink-600 font-semibold">
            {formatPrice(raffle.ticket_price_cents, raffle.currency)}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 capitalize">
            {raffle.status}
          </span>
        </div>
      </div>
    </a>
  );
}
