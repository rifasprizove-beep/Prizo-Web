"use client";
import type { Raffle } from '@/lib/types';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { centsToUsd, getEnvFallbackRate, getBcvRatePreferApi, round0, round1, round2 } from '@/lib/data/rate';
import { raffleStatusEs, formatVES } from '@/lib/i18n';
import { BadgePill } from './BadgePill';
import { useCurrency } from '@/lib/currency';
import { Skeleton } from './Skeleton';

function useRates() {
  const [bcvRate, setBcvRate] = useState<number | null>(null);
  const fallbackRate = getEnvFallbackRate();
  useEffect(() => {
    (async () => {
      try {
        const info = await getBcvRatePreferApi();
        if (info?.rate) setBcvRate(info.rate);
      } catch {}
    })();
  }, []);
  return { fallbackRate, bcvRate } as const;
}

export function RaffleCard({ raffle }: { raffle: Raffle }) {
  const { currency } = useCurrency();
  const { fallbackRate, bcvRate } = useRates();
  const isFree = (raffle as any).is_free === true || (raffle.ticket_price_cents ?? 0) === 0;
  const unitUSDBase = centsToUsd(raffle.ticket_price_cents);
  // Precio mostrado en Bs con la tasa de entorno (entero)
  const unitVES = fallbackRate ? round0(unitUSDBase * fallbackRate) : 0;
  // Equivalente USD mostrado usando tasa BCV (4 decimales). Si no hay BCV, mostrar el base.
  const unitUsdAtBcv = bcvRate && unitVES ? round1(unitVES / bcvRate) : round1(unitUSDBase);
  const prizeUSDBase = centsToUsd(raffle.prize_amount_cents ?? 0);
  const topBuyerUSDBase = centsToUsd(raffle.top_buyer_prize_cents ?? 0);
  const prizeVES = fallbackRate ? round0(prizeUSDBase * fallbackRate) : 0;
  const topBuyerVES = fallbackRate ? round0(topBuyerUSDBase * fallbackRate) : 0;
  // Siempre enviamos al detalle; si está "drawn" el header tendrá el botón GANADOR activo
  const cardHref = `/raffles/${raffle.id}`;
  return (
    <a href={cardHref} className="block rounded-3xl border border-brand-500/20 bg-surface-700 text-white hover:shadow-glowSm transition-shadow">
  <div className="p-4 pb-0 space-y-2 mb-1 sm:mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {isFree ? (
            <BadgePill tone="brand">Gratis</BadgePill>
          ) : (
            <>
              <BadgePill>
                {currency === 'USD'
                  ? (bcvRate === null ? <Skeleton className="w-10 h-4 align-middle" /> : `$${unitUsdAtBcv.toFixed(1)}`)
                  : (unitVES ? formatVES(unitVES) : <Skeleton className="w-10 h-4 align-middle" />)}
              </BadgePill>
            </>
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
          <div className="font-semibold">{currency === 'USD'
            ? (bcvRate === null ? <Skeleton className="w-16 h-5 align-middle" /> : `$${(bcvRate && prizeVES ? round1(prizeVES / bcvRate).toFixed(1) : round1(prizeUSDBase).toFixed(1))}`)
            : (prizeVES ? formatVES(prizeVES) : <Skeleton className="w-16 h-5 align-middle" />)}
          </div>
        </div>
      )}
    </a>
  );
}
