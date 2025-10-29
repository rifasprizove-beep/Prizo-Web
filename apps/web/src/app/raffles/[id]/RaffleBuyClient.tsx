"use client";
import { useQuery } from '@tanstack/react-query';
import { getRaffle } from '@/lib/data/raffles';
import { getLastDraw } from '@/lib/data/draws';
import { RaffleBuyTabs } from '@/components/RaffleBuyTabs';
import { getRafflePaymentInfo } from '@/lib/data/paymentConfig';

export function RaffleBuyClient({ raffleId }: { raffleId: string }) {
  const raffleQ = useQuery({ queryKey: ['raffle', raffleId], queryFn: () => getRaffle(raffleId) });
  const drawQ = useQuery({ queryKey: ['raffle-last-draw', raffleId], queryFn: () => getLastDraw(raffleId), enabled: !!raffleQ.data });
  const payQ = useQuery({ queryKey: ['raffle-payment', raffleId], queryFn: () => getRafflePaymentInfo(raffleId), enabled: !!raffleQ.data });
  if (raffleQ.isLoading) return <div className="p-4">Cargando…</div>;
  if (!raffleQ.data) return <div className="p-4">Rifa no encontrada.</div>;
  // Regla: si la última draw.rule incluye 'random_only' o 'no_manual', se deshabilita elegir números
  const rule = drawQ.data?.rule?.toLowerCase() ?? '';
  const allowManual = !(rule.includes('random_only') || rule.includes('no_manual'));
  return <RaffleBuyTabs raffleId={raffleId} currency={raffleQ.data.currency} totalTickets={raffleQ.data.total_tickets} unitPriceCents={raffleQ.data.ticket_price_cents} paymentInfo={payQ.data ?? null} allowManual={allowManual} />;
}
