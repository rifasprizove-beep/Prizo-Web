"use client";
import type { Raffle, RaffleTicketCounters } from "@/lib/types";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { computeTicketPrice, centsToUsd, getEnvFallbackRate, getBcvRatePreferApi } from "@/lib/data/rate";
import { formatMoney } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { useQuery } from "@tanstack/react-query";
import { listWinners } from "@/lib/data/winners";
import { getRaffle, getRaffleCounters } from "@/lib/data/raffles";
import { listTopBuyers } from "@/lib/data/top_buyers";
import WinnerTable from "./WinnerTable";
import { Skeleton } from "./Skeleton";

export function RaffleHeader({ raffle, counters }: { raffle: Raffle; counters: RaffleTicketCounters | null }) {
  const { currency } = useCurrency();
  // Tasa de referencia (entorno) para calcular VES mostrados
  const fallbackRate = getEnvFallbackRate();
  const [bcvRate, setBcvRate] = useState<number | null>(null);
  useEffect(() => { (async () => { try { const info = await getBcvRatePreferApi(); if (info?.rate) setBcvRate(info.rate); } catch {} })(); }, []);

  // Refetch de la rifa en cliente para reflejar imagen y precios actualizados
  const raffleQ = useQuery({
    queryKey: ['raffle-header', raffle.id],
    queryFn: () => getRaffle(raffle.id),
    enabled: !!raffle.id,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  const srcRaffle = raffleQ.data ?? raffle;

  const isFree = (srcRaffle as any).is_free === true || (srcRaffle.ticket_price_cents ?? 0) === 0;
  const { unitVES, unitUsdAtBcv, prizeUsd, topBuyerUsd } = useMemo(() => {
    const ticketPrice = computeTicketPrice(srcRaffle.ticket_price_cents ?? 0, fallbackRate, bcvRate);
    const prizeUSDBase = centsToUsd(srcRaffle.prize_amount_cents ?? 0);
    const topBuyerUSDBase = centsToUsd(srcRaffle.top_buyer_prize_cents ?? 0);

    return {
      unitVES: ticketPrice.bsAtBcv,
      unitUsdAtBcv: ticketPrice.usdAtBcv,
      prizeUsd: prizeUSDBase,
      topBuyerUsd: topBuyerUSDBase,
    } as const;
  }, [srcRaffle.ticket_price_cents, srcRaffle.prize_amount_cents, srcRaffle.top_buyer_prize_cents, fallbackRate, bcvRate]);
  if (process.env.NEXT_PUBLIC_DEBUG === '1') {
    try {
      console.debug('[HeaderPriceDebug]', {
        ticket_price_cents: srcRaffle.ticket_price_cents,
        unitUSDBase: centsToUsd(srcRaffle.ticket_price_cents ?? 0),
        fallbackRate,
        bcvRate,
        unitVES,
        unitUsdAtBcv,
      });
    } catch {}
  }
  // Defensive conversion: Supabase may return numeric fields as strings.
  const soldNum = counters ? Number((counters as any).sold ?? 0) : 0;
  const totalNum = counters ? Number((counters as any).total_tickets ?? 0) : 0;
  const reservedNum = counters ? Number((counters as any).reserved ?? 0) : 0;
  // Refetch periódico de counters para mantener el avance actualizado
  const countersQ = useQuery({
    queryKey: ['raffle-counters', raffle.id],
    queryFn: () => getRaffleCounters(raffle.id),
    enabled: !!raffle.id,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
  });
  const effCounters = countersQ.data ?? counters;
  const soldEff = effCounters ? Number((effCounters as any).sold ?? 0) : soldNum;
  const totalEff = effCounters ? Number((effCounters as any).total_tickets ?? 0) : totalNum;
  const reservedEff = effCounters ? Number((effCounters as any).reserved ?? 0) : reservedNum;
  const percent = totalEff > 0 ? Math.max(0, Math.min(100, (soldEff / totalEff) * 100)) : 0;
  const isPaid = !(isFree);
  const soldOut = isPaid && totalEff > 0 && soldEff >= totalEff;
  const noneAvailable = isPaid && totalEff > 0 && (Math.max(0, totalEff - (soldEff + reservedEff)) <= 0) && !soldOut;
  const showProgress = true; // Progress bar hidden per request

  if (process.env.NEXT_PUBLIC_DEBUG === '1') {
    try {
      // eslint-disable-next-line no-console
      console.debug('[RaffleHeader] counters:', effCounters, 'soldNum:', soldEff, 'totalNum:', totalEff, 'percent:', percent);
    } catch {}
  }

  // Estado visual según la rifa
  const isDrawnEffective = srcRaffle.status === 'drawn';
  const startsAt = (srcRaffle as any)?.starts_at ? Date.parse((srcRaffle as any).starts_at as any) : null;
  const notStartedYetPublished = srcRaffle.status === 'published' && typeof startsAt === 'number' && Date.now() < startsAt;
  // Cargar ganadores para saber si hay alguno asignado
  const winnersPreQ = useQuery({
    queryKey: ['winners-pre', srcRaffle.id],
    queryFn: () => listWinners(srcRaffle.id),
    enabled: !!srcRaffle.id,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  const hasWinner = (winnersPreQ.data && winnersPreQ.data.length > 0);
  const [showWinners, setShowWinners] = useState(false);
  const [showTopBuyers, setShowTopBuyers] = useState(false);
  // Activación automática inicial del tab GANADOR (solo una vez) si la rifa está en drawn o ya hay ganador
  const [autoActivated, setAutoActivated] = useState(false);
  useEffect(() => {
    if ((isDrawnEffective || hasWinner) && !showWinners && !autoActivated) {
      setShowTopBuyers(false);
      setShowWinners(true);
      setAutoActivated(true); // evitar que al cambiar a TOP o COMPRAR se re-fuerce GANADOR
      try { if (typeof window !== 'undefined') window.location.hash = '#ganador'; } catch {}
    }
  }, [isDrawnEffective, hasWinner, showWinners, autoActivated]);

  return (
    <header className="space-y-6">
      <div className="rounded-2xl border p-4 bg-brand-500 text-white shadow-sm">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-wide uppercase">{srcRaffle.name}</h1>
        {srcRaffle.image_url ? (
          <div className="relative w-full rounded-xl mt-3 overflow-hidden bg-white aspect-[16/9] md:aspect-[21/9]">
            <Image
              src={srcRaffle.image_url}
              alt={srcRaffle.name}
              fill
              className="object-cover"
              sizes="100vw"
              priority
              unoptimized
            />
          </div>
        ) : (
          <div className="relative w-full rounded-xl mt-3 overflow-hidden aspect-[16/9] md:aspect-[21/9] bg-gradient-to-br from-brand-400/40 via-brand-500/30 to-pink-500/30 border border-white/20">
            <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm font-semibold">
              Imagen no disponible
            </div>
          </div>
        )}

        {srcRaffle.description && (
          <p className="mt-3 text-sm text-white/90 leading-relaxed">
            {srcRaffle.description}
          </p>
        )}

        <div className="mt-3 text-sm space-y-1">
          <div>
            <span className="opacity-90">Ticket:</span>{' '}
            {isFree ? (
              'Gratis'
            ) : currency === 'USD' ? (
              // Mostrar siempre el precio en USD calculado; si no hay BCV, usamos el base.
              formatMoney(unitUsdAtBcv, 'USD')
            ) : (
              formatMoney(unitVES, 'VES')
            )}
          </div>
          {srcRaffle.prize_amount_cents != null && srcRaffle.prize_amount_cents > 0 && (
            <div>
              <span className="opacity-90">Premio:</span> {formatMoney(prizeUsd, 'USDT')}
            </div>
          )}
          {srcRaffle.prize_amount_cents != null && srcRaffle.prize_amount_cents > 0 && typeof (srcRaffle as any).winners_count === 'number' && (srcRaffle as any).winners_count > 0 && (
            <div>
              <span className="opacity-90">Número de ganadores:</span> {(srcRaffle as any).winners_count}
            </div>
          )}
          {srcRaffle.top_buyer_prize_cents != null && srcRaffle.top_buyer_prize_cents > 0 && (
            <div>
              <span className="opacity-90">Top comprador:</span> {formatMoney(topBuyerUsd, 'USDT')}
            </div>
          )}
        </div>

        {/* Contenedor redundante removido: la instrucción de asignación aleatoria ya se muestra abajo */}

        {showProgress && !isFree && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-sm md:text-base font-semibold opacity-100 mb-1">
              <span>Avance del sorteo</span>
              <span className="tabular-nums">{percent.toFixed(1)}%</span>
            </div>
            <div className="h-3 md:h-4 w-full rounded-full bg-white/30">
              <div className="h-3 md:h-4 rounded-full bg-white" style={{ width: `${percent}%` }} />
            </div>
            {soldOut && (
              <div className="mt-2 text-xs font-semibold inline-block px-2 py-1 rounded bg-white text-brand-700">Agotado</div>
            )}
            {!soldOut && noneAvailable && (
              <div className="mt-2 text-xs inline-block px-2 py-1 rounded bg-white/70 text-brand-700">Sin disponibilidad por reservas</div>
            )}
          </div>
        )}

        <div className="mt-4">
          <div className="rounded-full bg-brand-600/50 p-1.5 border border-white/20">
            <div className="flex flex-row items-center gap-1">
              <a
                href="#sec-buy"
                onClick={() => { setShowWinners(false); setShowTopBuyers(false); if (typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname + window.location.search); }}
                className={`flex-1 text-center font-semibold px-3 py-2 rounded-full text-xs sm:text-sm tap-safe ${showWinners || showTopBuyers ? 'text-white/70 border border-white/30' : 'bg-white text-brand-700'}`}
              >
                {isFree ? 'PARTICIPAR' : 'COMPRAR'}
              </a>
              <button
                type="button"
                disabled={notStartedYetPublished}
                onClick={() => {
                  // Si aún no inicia y está published, no permitir abrir Top Compradores
                  if (notStartedYetPublished) return;
                  // Si ya estamos en TOP COMPRADORES, no hacer toggle (quedarse)
                  if (showTopBuyers) return;
                  setShowWinners(false);
                  setShowTopBuyers(true);
                  try {
                    if (typeof window !== 'undefined') window.location.hash = '#top';
                  } catch {}
                }}
                className={`flex-1 text-center font-extrabold px-3 py-2 rounded-full text-xs sm:text-sm tap-safe ${showTopBuyers
                  ? 'bg-white text-brand-700'
                  : (notStartedYetPublished ? 'text-white/50 border border-white/20' : 'text-white/80 hover:text-white border border-white/30')}`}
              >
                <span className="hidden sm:inline">TOP COMPRADORES</span>
                <span className="sm:hidden">TOP</span>
              </button>
              <button
                type="button"
                // Habilitar si la rifa está en drawn O si ya se detectó algún ganador
                disabled={!(isDrawnEffective || hasWinner)}
                onClick={() => {
                  if (!(isDrawnEffective || hasWinner)) return;
                  // Si ya estamos en GANADOR, no hacer toggle (quedarse)
                  if (showWinners) return;
                  setShowTopBuyers(false);
                  setShowWinners(true);
                  try {
                    if (typeof window !== 'undefined') window.location.hash = '#ganador';
                  } catch {}
                }}
                className={`flex-1 text-center font-extrabold px-3 py-2 rounded-full text-xs sm:text-sm tap-safe ${showWinners
                  ? 'bg-white text-brand-700'
                  : ((isDrawnEffective || hasWinner)
                    ? 'text-white/80 hover:text-white border border-white/30'
                    : 'text-white/50 border border-white/20')}`}
              >
                GANADOR
              </button>
            </div>
          </div>
        </div>
        {/* Estado removido por solicitud del cliente */}
      </div>
      {showTopBuyers && !notStartedYetPublished && (
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
  // Limitar a los primeros 3 únicamente
  const topRows = rows.slice(0, 3);
  return (
    <section className="space-y-4 text-base">
      <h3 className="text-lg font-semibold text-white">Top compradores</h3>
      <div className="rounded-xl border border-brand-500/30 bg-white/95 p-4">
        <ol className="space-y-3">
          {topRows.map((r, i) => {
            const rawIg = (r as any).instagram ?? (r as any).instagram_user;
            const igClean = typeof rawIg === 'string' ? rawIg.replace(/^@+/, '').trim() : '';
            const emailLocalRaw = (r.buyer_email ?? '').split('@')[0].trim();
            let display = '';
            let isInstagram = false;
            if (igClean && igClean.length >= 2) { display = `@${igClean}`; isInstagram = true; }
            else if (emailLocalRaw) display = emailLocalRaw;
            else display = 'Usuario';
            const colorRank = i === 0
              ? 'bg-gradient-to-br from-brand-500 to-pink-600 text-white'
              : i === 1
              ? 'bg-brand-500/90 text-white'
              : 'bg-brand-500/70 text-white';
            return (
              <li
                key={r.buyer_email || i}
                className="flex items-center gap-4 p-3 rounded-xl bg-white/90 border border-brand-500/10 hover:border-brand-500/40 transition-colors"
              >
                <span
                  className={"inline-flex items-center justify-center w-11 h-11 rounded-full text-sm font-bold tabular-nums shadow-sm " + colorRank}
                  aria-label={`Ranking posición ${i + 1}`}
                >
                  {i + 1}
                </span>
                {isInstagram ? (
                  <a
                    href={`https://instagram.com/${igClean}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium tracking-wide break-all text-brand-600 hover:text-brand-700 underline underline-offset-2"
                    aria-label={`Perfil de Instagram ${display}`}
                  >
                    {display}
                  </a>
                ) : (
                  <span className="text-sm font-medium tracking-wide break-all text-gray-900" aria-label={`Usuario ${display}`}>{display}</span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      <div className="text-xs mt-1 text-gray-500">Mostrando los 3 primeros (por tickets aprobados).</div>
    </section>
  );
}

