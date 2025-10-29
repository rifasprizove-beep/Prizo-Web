"use client";
import { useQuery } from '@tanstack/react-query';
import { getRaffle, getRaffleCounters } from '@/lib/data/raffles';
import { RaffleHeader } from '@/components/RaffleHeader';

export function RaffleDetailClient({ id }: { id: string }) {
  const raffleQ = useQuery({ queryKey: ['raffle', id], queryFn: () => getRaffle(id) });
  const countersQ = useQuery({ queryKey: ['raffle-counters', id], queryFn: () => getRaffleCounters(id), enabled: !!raffleQ.data });

  if (raffleQ.isLoading) return <div>Cargando rifa…</div>;
  if (!raffleQ.data) return <div>Rifa no encontrada.</div>;

  return (
    <RaffleHeader raffle={raffleQ.data} counters={countersQ.data ?? null} />
  );
}
