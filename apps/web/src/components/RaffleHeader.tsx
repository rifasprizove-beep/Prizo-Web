"use client";
import type { Raffle, RaffleTicketCounters } from "@/lib/types";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { centsToUsd, getUsdVesRate, round2 } from "@/lib/data/rate";
import { formatVES, raffleStatusEs } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { useQuery } from "@tanstack/react-query";
import { listWinners } from "@/lib/data/winners";
import WinnerTable from "./WinnerTable";

export function RaffleHeader({ raffle, counters }: { raffle: Raffle; counters: RaffleTicketCounters | null }) {
  const { currency } = useCurrency();
  const [rate, setRate] = useState<number | null>(null);
  useEffect(() => { (async () => { try { const info = await getUsdVesRate(); if (info?.rate) setRate(info.rate); } catch {} })(); }, []);
  const isFree = (raffle as any).is_free === true || (raffle.ticket_price_cents ?? 0) === 0;
  const priceUSD = centsToUsd(raffle.ticket_price_cents ?? 0);
  const priceVES = rate ? round2(priceUSD * rate) : 0;
  const prizeUSD = centsToUsd(raffle.prize_amount_cents ?? 0);
  const topBuyerUSD = centsToUsd(raffle.top_buyer_prize_cents ?? 0);
  const topBuyerVES = rate ? round2(topBuyerUSD * rate) : 0;
  const percent = counters && counters.total_tickets > 0 ? Math.min(100, (counters.sold / counters.total_tickets) * 100) : 0;

  // Estado visual según la rifa
  const isDrawnEffective = raffle.status === 'drawn';
  const [showWinners, setShowWinners] = useState(false);

  return (
    <header className="space-y-4">
      <div className="rounded-2xl border p-4 bg-brand-500 text-white shadow-sm">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-wide uppercase">{raffle.name}</h1>
        {raffle.image_url && (
          <div className="relative w-full h-64 md:h-80 rounded-xl mt-3 overflow-hidden bg-white">
            <Image src={raffle.image_url} alt={raffle.name} fill className="object-cover" sizes="100vw" />
          </div>
        )}

  <div className="mt-3 text-sm space-y-1">
          <div>
            <span className="opacity-90">Ticket:</span>{' '}
            {isFree
              ? 'Gratis'
              : (
                currency === 'USD'
                  ? `$${priceUSD.toFixed(2)}`
                  : (priceVES ? formatVES(priceVES) : '—')
              )
            }
            {!isFree && currency === 'VES' && <span className="opacity-80"> (tasa del día)</span>}
          </div>
          {raffle.prize_amount_cents != null && raffle.prize_amount_cents > 0 && (
            <div>
              <span className="opacity-90">Premio:</span> {currency === 'USD' ? `$${prizeUSD.toFixed(2)}` : (rate ? formatVES(round2(prizeUSD * rate)) : '—')}
            </div>
          )}
          {raffle.top_buyer_prize_cents != null && raffle.top_buyer_prize_cents > 0 && (
            <div>
              <span className="text-brand-300">Top comprador:</span> {currency === 'USD' ? `$${topBuyerUSD.toFixed(2)}` : (topBuyerVES ? formatVES(topBuyerVES) : '—')}
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
          {isDrawnEffective ? (
            <div className="rounded-full bg-brand-600/50 p-2 border border-white/20">
              <div className="flex items-center gap-2">
                <a
                  href="#sec-buy"
                  onClick={() => setShowWinners(false)}
                  className={`flex-1 text-center font-semibold px-4 py-3 rounded-full ${showWinners ? 'text-white/70 border border-white/30' : 'bg-white text-brand-700'}`}
                >
                  {isFree ? 'PARTICIPAR' : 'COMPRAR'}
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setShowWinners((v) => {
                      const next = !v;
                      try {
                        if (next) {
                          // Señal global para ocultar la sección de compra
                          if (typeof window !== 'undefined') window.location.hash = 'ganador';
                        } else {
                          // Quitar el hash sin cambiar la ruta ni recargar
                          if (typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname + window.location.search);
                        }
                      } catch {}
                      return next;
                    });
                  }}
                  className={`flex-1 text-center font-extrabold px-4 py-3 rounded-full ${showWinners ? 'bg-white text-brand-700' : 'text-white/80 hover:text-white border border-white/30'}`}
                >
                  GANADOR
                </button>
              </div>
            </div>
          ) : raffle.status === 'closed' ? (
            <div className="rounded-full px-4 py-3 text-center font-semibold border border-white/30 bg-white/10 text-white">
              Sorteo cerrado — pendiente de ganador
            </div>
          ) : (
            <div className="rounded-full bg-brand-600/50 p-2 border border-white/20">
              <div className="flex items-center gap-2">
                <a href="#sec-buy" className="flex-1 text-center font-semibold px-4 py-3 rounded-full bg-white text-brand-700">{isFree ? 'PARTICIPAR' : 'COMPRAR'}</a>
                <span className="flex-1 text-center font-semibold px-4 py-3 rounded-full text-white/50">GANADOR</span>
              </div>
            </div>
          )}
        </div>
        {isDrawnEffective && showWinners && (
          <div className="mt-3">
            <WinnersInline raffleId={raffle.id} raffleImage={raffle.image_url} raffleName={raffle.name} />
          </div>
        )}
        <div className="mt-2 text-xs opacity-80">
          Estado: {raffleStatusEs(raffle.status)}
        </div>
      </div>
    </header>
  );
}
function WinnersInline({ raffleId, raffleImage, raffleName }: { raffleId: string; raffleImage: string | null; raffleName: string }) {
  const winnersQ = useQuery({
    queryKey: ['winners', raffleId],
    queryFn: () => listWinners(raffleId),
    enabled: !!raffleId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  if (winnersQ.isLoading) return <div className="rounded-xl border p-3 bg-white text-brand-700">Cargando…</div>;
  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold text-white">Ganadores</h3>
      <WinnerTable winners={winnersQ.data ?? []} />
      {/* Imagen destacada del ticket ganador debajo del listado */}
      {(() => {
        const winners = winnersQ.data ?? [];
        const primary = winners.find(w => w.type === 'public_draw' && w.position === 1) || winners[0];
        const ticketImg = primary?.image_url || null;
        if (!ticketImg) return null;
        const label = primary?.ticket_number_snapshot != null
          ? `Ticket ganador #${primary.ticket_number_snapshot}`
          : 'Ticket ganador';
        return (
          <div className="mt-2 rounded-2xl border border-white/15 bg-white/5 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="inline-flex items-center gap-2 text-white/90 font-semibold">
                {/* ícono ticket */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path d="M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 01-2 2 2 2 0 000 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 000-4 2 2 0 01-2-2V8z"/>
                </svg>
                <span>{label}</span>
              </div>
              <span className="text-xs text-white/60">
                {primary?.winner_name || primary?.instagram_user || 'Ganador'}
              </span>
            </div>
            <div className="relative w-full rounded-xl overflow-hidden bg-black/20 border border-white/10">
              <img src={ticketImg} alt={label} className="w-full h-auto object-contain max-h-[28rem]" />
            </div>
          </div>
        );
      })()}
      <div className="text-xs opacity-80 mt-1 text-white/80">
        Para ver más detalles, visita la página de resultados.
        {' '}<Link href={`/raffles/${raffleId}/result`} className="underline">Abrir resultados</Link>
      </div>
    </section>
  );
}
 
