"use client";
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getRaffle } from '@/lib/data/raffles';
import { getLastDraw } from '@/lib/data/draws';
import { RaffleBuyTabs } from '@/components/RaffleBuyTabs';
import { getRafflePaymentInfo } from '@/lib/data/paymentConfig';
import { effectiveRaffleStatus, uiRafflePhase } from '@/lib/i18n';

export function RaffleBuyClient({ raffleId }: { raffleId: string }) {
  const raffleQ = useQuery({
    queryKey: ['raffle', raffleId],
    queryFn: () => getRaffle(raffleId),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  // Ocultar sección cuando el header muestra GANADOR (#ganador) o TOP COMPRADORES (#top)
  const [hiddenByOverlay, setHiddenByOverlay] = useState<boolean>(() => typeof window !== 'undefined' && (window.location.hash === '#ganador' || window.location.hash === '#top'));
  useEffect(() => {
    const handler = () => setHiddenByOverlay(typeof window !== 'undefined' && (window.location.hash === '#ganador' || window.location.hash === '#top'));
    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', handler);
      handler();
    }
    return () => { if (typeof window !== 'undefined') window.removeEventListener('hashchange', handler); };
  }, []);
  const drawQ = useQuery({
    queryKey: ['raffle-last-draw', raffleId],
    queryFn: () => getLastDraw(raffleId),
    enabled: !!raffleQ.data,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  const payQ = useQuery({
    queryKey: ['raffle-payment', raffleId],
    queryFn: () => getRafflePaymentInfo(raffleId),
    enabled: !!raffleQ.data,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  if (raffleQ.isLoading) return <div className="p-4">Cargando…</div>;
  if (!raffleQ.data) return <div className="p-4">Rifa no encontrada.</div>;
  const effStatus = effectiveRaffleStatus(raffleQ.data);
  const phase = uiRafflePhase(raffleQ.data);
  if (phase === 'upcoming') {
    return (
      <div className="rounded-2xl border p-4 bg-white text-center text-gray-700">
        Próximamente podrás comprar tickets
        {raffleQ.data.starts_at && (
          <div className="mt-1 text-xs text-gray-500">Inicio estimado: {new Date(raffleQ.data.starts_at).toLocaleString()}</div>
        )}
      </div>
    );
  }
  if (phase === 'awaiting_winner') {
    return (
      <div className="rounded-2xl border p-4 bg-yellow-500/10 border-yellow-500/30 text-center text-yellow-100">
        Ventas cerradas — esperando ganador
      </div>
    );
  }
  // Cuando el sorteo ya tiene ganador publicado, usamos el estado efectivo
  if (effStatus === 'drawn') {
    return (
      <div className="rounded-2xl border p-4 bg-gray-600/30 text-center text-gray-300">
        Sorteo finalizado — ganador publicado
        <div className="mt-1 text-xs">
          Consulta resultados en{' '}
          <a href={`/raffles/${raffleId}/result`} className="underline text-gray-100">resultado</a>.
        </div>
      </div>
    );
  }
  // Deshabilitar participación si ya hay ganador publicado
  const disabledAll = effStatus === 'drawn';
  // Regla: si la última draw.rule incluye 'random_only' o 'no_manual', se deshabilita elegir números
  const rule = drawQ.data?.rule?.toLowerCase() ?? '';
  const allowManual = (raffleQ.data.allow_manual !== false) && !(rule.includes('random_only') || rule.includes('no_manual'));
  const isFree = (raffleQ.data as any)?.is_free === true || (raffleQ.data.ticket_price_cents ?? 0) === 0;
  // Ocultar completamente si overlay activo (ganador o top compradores)
  if (hiddenByOverlay) {
    return null;
  }

  return (
    <div className="space-y-3">
      {effStatus === 'drawn' && (
        <div className="rounded-xl border p-3 bg-white text-center text-gray-700">
          Sorteo realizado. La sección de participación se muestra solo a modo informativo.
          Consulta los ganadores en el botón GANADOR arriba o en el{' '}
          <a href={`/raffles/${raffleId}/result`} className="text-pink-700 font-semibold underline">resultado</a>.
        </div>
      )}
      <RaffleBuyTabs
        raffleId={raffleId}
        currency={raffleQ.data.currency}
        totalTickets={raffleQ.data.total_tickets}
        unitPriceCents={raffleQ.data.ticket_price_cents}
        minTicketPurchase={(raffleQ.data as any).min_ticket_purchase ?? 1}
        paymentInfo={payQ.data ?? null}
        allowManual={allowManual}
        isFree={isFree}
        disabledAll={disabledAll}
      />
    </div>
  );
}
