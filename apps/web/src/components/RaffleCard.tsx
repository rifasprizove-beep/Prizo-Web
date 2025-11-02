"use client";
import type { Raffle } from '@/lib/types';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { centsToUsd, getUsdVesRate, round2 } from '@/lib/data/rate';
import { raffleStatusEs, formatVES } from '@/lib/i18n';
import { BadgePill } from './BadgePill';
import { useCurrency } from '@/lib/currency';

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
  const { currency } = useCurrency();
  const rate = useRate();
  const isFree = (raffle as any).is_free === true || (raffle.ticket_price_cents ?? 0) === 0;
  const unitUSD = centsToUsd(raffle.ticket_price_cents);
  const unitVES = rate ? round2(unitUSD * rate) : 0;
  const prizeUSD = centsToUsd(raffle.prize_amount_cents ?? 0);
  const topBuyerUSD = centsToUsd(raffle.top_buyer_prize_cents ?? 0);
  const _topBuyerVES = rate ? round2(topBuyerUSD * rate) : 0;
  // Siempre enviamos al detalle; si está "drawn" el header tendrá el botón GANADOR activo
  const cardHref = `/raffles/${raffle.id}`;
  return (
    <a href={cardHref} className="block rounded-3xl border border-brand-500/20 bg-surface-700 text-white hover:shadow-glowSm transition-shadow">
      <div className="p-4 pb-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          {isFree ? (
            <BadgePill tone="brand">Gratis</BadgePill>
          ) : (
            <BadgePill>{currency === 'USD' ? `$${unitUSD.toFixed(2)}` : (unitVES ? formatVES(unitVES) : '—')}</BadgePill>
          )}
          {raffle.status && (
            <BadgePill>{raffleStatusEs(raffle.status)}</BadgePill>
          )}
          {raffle.status === 'drawn' ? (
            <BadgePill tone="brand">Ganador</BadgePill>
          ) : null}
          {raffle.top_buyer_prize_cents ? (
            <BadgePill tone="brand">Top comprador</BadgePill>
          ) : null}
        </div>
        <h3 className="text-xl font-bold leading-tight line-clamp-2">{raffle.name}</h3>
        <p className="text-sm text-gray-300 line-clamp-2 min-h-[2.5rem]">{raffle.description ?? ''}</p>
      </div>
      {raffle.image_url ? (
        <div className="relative w-full aspect-[16/11] rounded-3xl overflow-hidden -mb-2">
          <Image src={raffle.image_url} alt={raffle.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" priority={false} />
        </div>
      ) : (
        <div className="w-full aspect-[16/11] bg-surface-800 rounded-3xl -mb-2" />
      )}
      {raffle.status === 'closed' && (
        <div className="px-4 py-2 bg-yellow-500/10 text-yellow-200 text-xs border-t border-yellow-500/20">
          Ventas cerradas — pendiente de ganador
        </div>
      )}
      {(raffle.prize_amount_cents ?? 0) > 0 && (
        <div className="px-4 py-3">
          <div className="text-xs text-gray-300">Premio</div>
          <div className="font-semibold">{currency === 'USD' ? `$${prizeUSD.toFixed(2)}` : (rate ? formatVES(round2(prizeUSD * rate)) : '—')}</div>
        </div>
      )}
    </a>
  );
}
