"use client";
import type { Raffle } from '@/lib/types';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { centsToUsd, getUsdVesRate, round2 } from '@/lib/data/rate';
import { raffleStatusEs, formatVES } from '@/lib/i18n';
import { BadgePill } from './BadgePill';

function useRate() {
  const [rate, setRate] = useState<number | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const info = await getUsdVesRate();
        if (info?.rate) setRate(info.rate);
      } catch {}
    })();
  }, []);
  return rate;
}

export function RaffleCard({ raffle }: { raffle: Raffle }) {
  const rate = useRate();
  const isFree = (raffle as any).is_free === true || (raffle.ticket_price_cents ?? 0) === 0;
  const unitUSD = centsToUsd(raffle.ticket_price_cents);
  const unitVES = rate ? round2(unitUSD * rate) : 0;
  const prizeUSD = centsToUsd(raffle.prize_amount_cents ?? 0);
  const prizeVES = rate ? round2(prizeUSD * rate) : 0;
  const topBuyerUSD = centsToUsd(raffle.top_buyer_prize_cents ?? 0);
  const _topBuyerVES = rate ? round2(topBuyerUSD * rate) : 0;
  return (
    <a href={`/raffles/${raffle.id}`} className="block rounded-3xl overflow-hidden border border-brand-500/20 bg-surface-700 text-white hover:shadow-glowSm transition-shadow">
      <div className="p-4 pb-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          {isFree ? (
            <BadgePill tone="brand">Gratis</BadgePill>
          ) : (
            <BadgePill>{unitVES ? formatVES(unitVES) : '—'}</BadgePill>
          )}
          {raffle.status && (
            <BadgePill>{raffleStatusEs(raffle.status)}</BadgePill>
          )}
          {raffle.top_buyer_prize_cents ? (
            <BadgePill tone="brand">Top comprador</BadgePill>
          ) : null}
        </div>
        <h3 className="text-xl font-bold leading-tight line-clamp-2">{raffle.name}</h3>
        <p className="text-sm text-gray-300 line-clamp-2 min-h-[2.5rem]">{raffle.description ?? ''}</p>
      </div>
      {raffle.image_url ? (
        <div className="relative w-full aspect-[16/11] rounded-t-3xl overflow-hidden">
          <Image src={raffle.image_url} alt={raffle.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" priority={false} />
        </div>
      ) : (
        <div className="w-full aspect-[16/11] bg-surface-800 rounded-t-3xl" />
      )}
      {(raffle.prize_amount_cents ?? 0) > 0 && (
        <div className="px-4 py-3">
          <div className="text-xs text-gray-300">Premio</div>
          <div className="font-semibold">{prizeVES ? formatVES(prizeVES) : `$${prizeUSD.toFixed(2)}`}</div>
        </div>
      )}
    </a>
  );
}
