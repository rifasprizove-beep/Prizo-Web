"use client";
import type { Raffle, RaffleTicketCounters } from "@/lib/types";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { centsToUsd, getEnvFallbackRate, getBcvRatePreferApi, round0, round1, round2 } from "@/lib/data/rate";
import { formatVES } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { useQuery } from "@tanstack/react-query";
import { listWinners } from "@/lib/data/winners";
import { listTopBuyers } from "@/lib/data/top_buyers";
import WinnerTable from "./WinnerTable";
import { Skeleton } from "./Skeleton";

export function RaffleHeader({ raffle, counters }: { raffle: Raffle; counters: RaffleTicketCounters | null }) {
  const { currency } = useCurrency();
  // Tasa de referencia (entorno) para calcular VES mostrados
  const fallbackRate = getEnvFallbackRate();
  // Tasa BCV para mostrar equivalentes en USD
  const [bcvRate, setBcvRate] = useState<number | null>(null);
  useEffect(() => { (async () => { try { const info = await getBcvRatePreferApi(); if (info?.rate) setBcvRate(info.rate); } catch {} })(); }, []);

  const isFree = (raffle as any).is_free === true || (raffle.ticket_price_cents ?? 0) === 0;
  const unitUSDBase = centsToUsd(raffle.ticket_price_cents ?? 0);
  // Precio del ticket mostrado en Bs con la tasa de entorno (entero)
  const unitVES = fallbackRate ? round0(unitUSDBase * fallbackRate) : 0;
  // Equivalente USD usando BCV (1 decimal). Si no hay BCV, usar el base.
  const unitUsdAtBcv = bcvRate && unitVES ? round1(unitVES / bcvRate) : round1(unitUSDBase);

  const prizeUSDBase = centsToUsd(raffle.prize_amount_cents ?? 0);
  const topBuyerUSDBase = centsToUsd(raffle.top_buyer_prize_cents ?? 0);
  const prizeVES = fallbackRate ? round0(prizeUSDBase * fallbackRate) : 0;
  const topBuyerVES = fallbackRate ? round0(topBuyerUSDBase * fallbackRate) : 0;
  const percent = counters && counters.total_tickets > 0 ? Math.min(100, (counters.sold / counters.total_tickets) * 100) : 0;

  // Estado visual según la rifa
  const isDrawnEffective = raffle.status === 'drawn';
  const [showWinners, setShowWinners] = useState(false);
  const [showTopBuyers, setShowTopBuyers] = useState(false);

  return (
    <header className="space-y-6">
      <div className="rounded-2xl border p-4 bg-brand-500 text-white shadow-sm">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-wide uppercase">{raffle.name}</h1>
        {raffle.image_url && (
          <div className="relative w-full h-64 md:h-80 rounded-xl mt-3 overflow-hidden bg-white">
            <Image src={raffle.image_url} alt={raffle.name} fill className="object-cover" sizes="100vw" />
          </div>
        )}

        {raffle.description && (
          <p className="mt-3 text-sm text-white/90 leading-relaxed">
            {raffle.description}
          </p>
        )}

  <div className="mt-3 text-sm space-y-1">
          <div>
            <span className="opacity-90">Ticket:</span>{' '}
            {isFree
              ? 'Gratis'
              : (
                currency === 'USD'
                  ? (bcvRate === null ? <Skeleton className="w-12 h-5 align-middle" /> : `$${unitUsdAtBcv.toFixed(1)}`)
                  : (unitVES ? formatVES(unitVES) : <Skeleton className="w-12 h-5 align-middle" />)
              )
            }
          </div>
          {raffle.prize_amount_cents != null && raffle.prize_amount_cents > 0 && (
            <div>
              <span className="opacity-90">Premio:</span> {currency === 'USD'
                ? (bcvRate === null ? <Skeleton className="w-16 h-5 align-middle" /> : `$${(bcvRate && prizeVES ? round1(prizeVES / bcvRate).toFixed(1) : round1(prizeUSDBase).toFixed(1))}`)
                : (prizeVES ? formatVES(prizeVES) : <Skeleton className="w-16 h-5 align-middle" />)}
            </div>
          )}
          {raffle.top_buyer_prize_cents != null && raffle.top_buyer_prize_cents > 0 && (
            <div>
              <span className="text-brand-300">Top comprador:</span> {currency === 'USD'
                ? (bcvRate === null ? <Skeleton className="w-16 h-5 align-middle" /> : `$${(bcvRate && topBuyerVES ? round1(topBuyerVES / bcvRate).toFixed(1) : round1(topBuyerUSDBase).toFixed(1))}`)
                : (topBuyerVES ? formatVES(topBuyerVES) : <Skeleton className="w-16 h-5 align-middle" />)}
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
              <a
                href="#sec-buy"
                onClick={() => { setShowWinners(false); setShowTopBuyers(false); if (typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname + window.location.search); }}
                className={`flex-1 text-center font-semibold px-4 py-3 rounded-full ${showWinners || showTopBuyers ? 'text-white/70 border border-white/30' : 'bg-white text-brand-700'}`}
              >
                {isFree ? 'PARTICIPAR' : 'COMPRAR'}
              </a>
              <button
                type="button"
                onClick={() => {
                  setShowTopBuyers((v) => {
                    const next = !v;
                    setShowWinners(false);
                    try {
                      if (next) {
                        if (typeof window !== 'undefined') window.location.hash = 'top';
                      } else {
                        if (typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname + window.location.search);
                      }
                    } catch {}
                    return next;
                  });
                }}
                className={`flex-1 text-center font-extrabold px-4 py-3 rounded-full ${showTopBuyers ? 'bg-white text-brand-700' : 'text-white/80 hover:text-white border border-white/30'}`}
              >
                TOP COMPRADORES
              </button>
              <button
                type="button"
                disabled={!isDrawnEffective}
                onClick={() => {
                  if (!isDrawnEffective) return;
                  setShowWinners((v) => {
                    const next = !v;
                    setShowTopBuyers(false);
                    try {
                      if (next) {
                        if (typeof window !== 'undefined') window.location.hash = 'ganador';
                      } else {
                        if (typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname + window.location.search);
                      }
                    } catch {}
                    return next;
                  });
                }}
                className={`flex-1 text-center font-extrabold px-4 py-3 rounded-full ${showWinners ? 'bg-white text-brand-700' : (isDrawnEffective ? 'text-white/80 hover:text-white border border-white/30' : 'text-white/50 border border-white/20')}`}
              >
                GANADOR
              </button>
            </div>
          </div>
        </div>
        {/* Estado removido por solicitud del cliente */}
      </div>
      {showTopBuyers && (
        <div>
          <TopBuyersInline raffleId={raffle.id} />
        </div>
      )}
      {showWinners && (
        <div>
          <WinnersInline raffleId={raffle.id} raffleImage={raffle.image_url} raffleName={raffle.name} />
        </div>
      )}
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
  if (winnersQ.isLoading) return <div className="rounded-xl border p-3 bg-white text-brand-700 text-sm">Cargando…</div>;
  return (
    <section className="space-y-3 text-sm">
      <h3 className="text-base font-semibold text-white">Ganadores</h3>
      <WinnerTable winners={winnersQ.data ?? []} />
      {raffleImage && (
        <div className="mt-2">
          <img src={raffleImage} alt={`Imagen del sorteo ${raffleName}`} className="w-full rounded-xl border" />
        </div>
      )}
      <div className="text-xs opacity-80 mt-1 text-white/80">
        Para ver más detalles, visita la página de resultados.
        {' '}<Link href={`/raffles/${raffleId}/result`} className="underline">Abrir resultados</Link>
      </div>
    </section>
  );
}

function TopBuyersInline({ raffleId }: { raffleId: string }) {
  const topQ = useQuery({
    queryKey: ['top-buyers', raffleId],
    queryFn: () => listTopBuyers(raffleId, 50),
    enabled: !!raffleId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  if (topQ.isLoading) return <div className="rounded-xl border p-3 bg-white text-brand-700 text-sm">Cargando ranking…</div>;
  const rows = topQ.data ?? [];
  if (!rows.length) return <div className="rounded-xl border p-3 bg-white text-brand-700 text-sm">Aún no hay compradores aprobados.</div>;
  return (
    <section className="space-y-3 text-sm">
      <h3 className="text-base font-semibold text-brand-700">Top compradores</h3>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-brand-50 text-brand-700 text-xs uppercase tracking-wide">
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Tickets</th>
              <th className="px-3 py-2 text-left">Pagos</th>
              <th className="px-3 py-2 text-left">Último</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.buyer_email || i} className={i % 2 ? 'bg-white' : 'bg-brand-50/40'}>
                <td className="px-3 py-2 font-mono text-xs">{i + 1}</td>
                <td className="px-3 py-2 break-all">{r.buyer_email ?? '—'}</td>
                <td className="px-3 py-2 font-semibold">{r.tickets}</td>
                <td className="px-3 py-2">{r.payments_count}</td>
                <td className="px-3 py-2 text-xs opacity-70">{new Date(r.last_payment).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-xs opacity-80 mt-1 text-brand-700/70">Ranking basado en pagos aprobados.</div>
    </section>
  );
}

