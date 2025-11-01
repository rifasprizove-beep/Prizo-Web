"use client";
import type { Raffle, RaffleTicketCounters } from "@/lib/types";
import Link from "next/link";
import { useEffect, useState } from "react";
import { centsToUsd, getUsdVesRate, round2 } from "@/lib/data/rate";
import { formatVES, raffleStatusEs } from "@/lib/i18n";

export function RaffleHeader({ raffle, counters }: { raffle: Raffle; counters: RaffleTicketCounters | null }) {
  const [rate, setRate] = useState<number | null>(null);
  useEffect(() => { (async () => { try { const info = await getUsdVesRate(); if (info?.rate) setRate(info.rate); } catch {} })(); }, []);
  const isFree = (raffle as any).is_free === true || (raffle.ticket_price_cents ?? 0) === 0;
  const priceUSD = centsToUsd(raffle.ticket_price_cents ?? 0);
  const priceVES = rate ? round2(priceUSD * rate) : 0;
  const prizeUSD = centsToUsd(raffle.prize_amount_cents ?? 0);
  const prizeVES = rate ? round2(prizeUSD * rate) : 0;
  const topBuyerUSD = centsToUsd(raffle.top_buyer_prize_cents ?? 0);
  const topBuyerVES = rate ? round2(topBuyerUSD * rate) : 0;
  const percent = counters && counters.total_tickets > 0 ? Math.min(100, (counters.sold / counters.total_tickets) * 100) : 0;

  return (
    <header className="space-y-4">
      <div>
        <Link href="/" className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg border bg-white">
          ← Cambiar de rifa
        </Link>
      </div>

      <div className="rounded-2xl border p-4 bg-brand-500 text-white shadow-sm">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-wide uppercase">{raffle.name}</h1>
        {raffle.image_url && (
          <img
            src={raffle.image_url}
            alt={raffle.name}
            className="w-full h-64 md:h-80 object-cover rounded-xl mt-3 bg-white"
            loading="lazy"
          />
        )}

        <div className="mt-3 text-sm space-y-1">
          <div>
            <span className="opacity-90">Ticket:</span> {isFree ? 'Gratis' : (priceVES ? formatVES(priceVES) : '—')} {!isFree && <span className="opacity-80">(tasa del día)</span>}
          </div>
          {raffle.prize_amount_cents != null && raffle.prize_amount_cents > 0 && (
            <div>
              <span className="opacity-90">Premio:</span> {prizeVES ? formatVES(prizeVES) : `$${prizeUSD.toFixed(2)}`}
            </div>
          )}
          {raffle.top_buyer_prize_cents != null && raffle.top_buyer_prize_cents > 0 && (
            <div>
              <span className="opacity-90">Top comprador:</span> {topBuyerVES ? formatVES(topBuyerVES) : `$${topBuyerUSD.toFixed(2)}`}
            </div>
          )}
        </div>

        {!isFree && raffle.allow_manual === false && (
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white text-brand-700 text-xs font-semibold border border-white/40">
            <span>🔀</span>
            <span>Asignación aleatoria de números</span>
          </div>
        )}

        {!isFree && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs opacity-90 mb-1">
              <span>Avance del sorteo</span>
              <span>{percent.toFixed(1)}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-white/30">
              <div className="h-3 rounded-full bg-white" style={{ width: `${percent}%` }} />
            </div>
          </div>
        )}

        <div className="mt-4">
          <div className="rounded-full bg-brand-600/50 p-2 border border-white/20">
            <div className="flex items-center gap-2">
              <a href="#sec-buy" className="flex-1 text-center font-semibold px-4 py-3 rounded-full bg-white text-brand-700">{isFree ? 'PARTICIPAR' : 'COMPRAR'}</a>
              {raffle.status === 'drawn' ? (
                <Link href={`/raffles/${raffle.id}/result`} className="flex-1 text-center font-semibold px-4 py-3 rounded-full text-white/80 hover:text-white">GANADOR</Link>
              ) : (
                <span className="flex-1 text-center font-semibold px-4 py-3 rounded-full text-white/50">GANADOR</span>
              )}
            </div>
          </div>
        </div>
        <div className="mt-2 text-xs opacity-80">
          Estado: {raffleStatusEs(raffle.status)}
        </div>
      </div>
    </header>
  );
}
