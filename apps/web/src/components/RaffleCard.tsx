"use client";
import type { Raffle } from '@/lib/types';
import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { centsToUsd, getEnvFallbackRate, getBcvRatePreferApi, round0, round1 } from '@/lib/data/rate';
import { formatMoney, effectiveRaffleStatus, uiRafflePhase } from '@/lib/i18n';
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

  // Derivados y formatos memoizados para evitar recalcular y re-render innecesarios
  const {
    isFree,
    unitVES,
    unitUsdAtBcv,
    prizeUsdStatic,
  } = useMemo(() => {
    const isFreeCalc = (raffle as any).is_free === true || (raffle.ticket_price_cents ?? 0) === 0;
    const ticketUsdBase = centsToUsd(raffle.ticket_price_cents);
    const prizeUsdBase = centsToUsd(raffle.prize_amount_cents ?? 0);

    const unitVESCalc = fallbackRate ? round0(ticketUsdBase * fallbackRate) : 0;
    const unitUsdAtBcvCalc = bcvRate && unitVESCalc ? round1(unitVESCalc / bcvRate) : round1(ticketUsdBase);

    // Premio estático en USD: siempre mostrar el monto original en dólares
    const prizeUsdStaticCalc = round1(prizeUsdBase);

    return {
      isFree: isFreeCalc,
      unitVES: unitVESCalc,
      unitUsdAtBcv: unitUsdAtBcvCalc,
      prizeUsdStatic: prizeUsdStaticCalc,
    } as const;
  }, [raffle.ticket_price_cents, raffle.prize_amount_cents, fallbackRate, bcvRate]);
  // Siempre enviamos al detalle; si está "drawn" el header tendrá el botón GANADOR activo
  const cardHref = `/raffles/${raffle.id}`;
  const effStatus = effectiveRaffleStatus(raffle);
  const phase = uiRafflePhase(raffle);
  const awaiting = phase === 'awaiting_winner';
  const isClosed = raffle.status === 'closed';
  const isFinished = phase === 'finished';
  return (
    <>
      <Link
        href={cardHref}
        className="relative block rounded-3xl border border-brand-500/20 bg-surface-700 text-white transition-shadow hover:shadow-glowSm"
      >
        <div className="p-4 pb-0 space-y-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            {isFree ? (
              <BadgePill tone="brand">Gratis</BadgePill>
            ) : (
              <>
                <BadgePill>
                  {currency === 'USD'
                    ? (bcvRate === null ? <Skeleton className="w-10 h-4 align-middle" /> : formatMoney(unitUsdAtBcv, 'USD'))
                    : (unitVES ? formatMoney(unitVES, 'VES') : <Skeleton className="w-10 h-4 align-middle" />)}
                </BadgePill>
              </>
            )}
            {(effStatus === 'published' || effStatus === 'selling') && (
              <BadgePill tone="brand">Abierta</BadgePill>
            )}
            {effStatus === 'drawn' && (
              <BadgePill tone="brand">Sorteando</BadgePill>
            )}
            {isClosed && (
              <BadgePill tone="brand">Cerrada</BadgePill>
            )}
            {raffle.top_buyer_prize_cents ? (
              <BadgePill tone="brand">Top comprador</BadgePill>
            ) : null}
          </div>
          <h3 className="text-xl font-bold leading-tight line-clamp-2">{raffle.name}</h3>
          <p className="text-sm text-gray-300 line-clamp-2 min-h-[40px]">{raffle.description ?? ''}</p>
        </div>
        {raffle.image_url ? (
          <div className="relative w-full aspect-[16/11] rounded-3xl overflow-hidden -mb-2">
            <Image src={raffle.image_url} alt={raffle.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" priority={false} />
          </div>
        ) : (
          <div className="w-full aspect-[16/11] bg-surface-800 rounded-3xl -mb-2" />
        )}
        {awaiting && !isClosed && (
          <div className="px-4 py-2 bg-yellow-500/10 text-yellow-200 text-xs border-t border-yellow-500/20">
            Ventas cerradas — sorteando
          </div>
        )}
        {isFinished && isClosed && (
          <div className="px-4 py-2 bg-red-500/10 text-red-200 text-xs border-t border-red-500/30">
            Rifa cerrada — ganador publicado
          </div>
        )}
        {(raffle.prize_amount_cents ?? 0) > 0 && (
          <div className="px-4 py-2 mt-4 flex items-center justify-between gap-3">
            <div className="text-xl sm:text-2xl font-extrabold leading-tight">
              {formatMoney(prizeUsdStatic, 'USD')}
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <Link href="https://tripletachira.com/resultados.php" target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-1">
                <img src="https://res.cloudinary.com/dzaokhfcw/image/upload/v1763940209/Untitled_design_zynbxm.png" alt="Triple Gana" className="h-5 sm:h-7 w-auto object-contain" />
              </Link>
              <Link href="https://www.conalot.gob.ve" target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-1">
                <img src="https://res.cloudinary.com/dzaokhfcw/image/upload/v1763940064/3_cvgejv.png" alt="Conalot" className="h-5 sm:h-7 w-auto object-contain" />
              </Link>
              <Link href="https://supergana.com.ve/resultados.php" target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-1">
                <img src="https://res.cloudinary.com/dzaokhfcw/image/upload/v1763940064/2_uaee43.png" alt="Super Gana" className="h-5 sm:h-7 w-auto object-contain" />
              </Link>
            </div>
          </div>
        )}
      </Link>
    </>
  );
}
