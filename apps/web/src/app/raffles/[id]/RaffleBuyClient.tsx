"use client";
import { useQuery } from '@tanstack/react-query';
import { getRaffle } from '@/lib/data/raffles';
import { getLastDraw } from '@/lib/data/draws';
import { RaffleBuyTabs } from '@/components/RaffleBuyTabs';
import { getRafflePaymentInfo } from '@/lib/data/paymentConfig';

export function RaffleBuyClient({ raffleId }: { raffleId: string }) {
  const raffleQ = useQuery({
    queryKey: ['raffle', raffleId],
    queryFn: () => getRaffle(raffleId),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
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
  // Si el sorteo está cerrado o ya fue sorteado, no permitir comprar/participar
  if (raffleQ.data.status === 'closed') {
    return (
      <div className="rounded-2xl border p-4 bg-white text-center text-gray-700">
        Ventas cerradas — pendiente de ganador
      </div>
    );
  }
  if (raffleQ.data.status === 'drawn') {
    return (
      <div className="rounded-2xl border p-4 bg-white text-center text-gray-700">
        Este sorteo ya fue sorteado. Revisa el{' '}
        <a href={`/raffles/${raffleId}/result`} className="text-pink-700 font-semibold underline">resultado aquí</a>.
      </div>
    );
  }
  // Regla: si la última draw.rule incluye 'random_only' o 'no_manual', se deshabilita elegir números
  const rule = drawQ.data?.rule?.toLowerCase() ?? '';
  const allowManual = (raffleQ.data.allow_manual !== false) && !(rule.includes('random_only') || rule.includes('no_manual'));
  const isFree = (raffleQ.data as any)?.is_free === true || (raffleQ.data.ticket_price_cents ?? 0) === 0;
  return <RaffleBuyTabs raffleId={raffleId} currency={raffleQ.data.currency} totalTickets={raffleQ.data.total_tickets} unitPriceCents={raffleQ.data.ticket_price_cents} paymentInfo={payQ.data ?? null} allowManual={allowManual} isFree={isFree} />;
}
