"use client";
import { useQuery } from '@tanstack/react-query';
import { listWinners } from '@/lib/data/winners';
import WinnerTable from '@/components/WinnerTable';
import { getRaffle } from '@/lib/data/raffles';

export default function ClientResultPage({ id }: { id: string }) {
  const winnersQ = useQuery({ queryKey: ['winners', id], queryFn: () => listWinners(id), enabled: !!id });
  const raffleQ = useQuery({ queryKey: ['raffle', id], queryFn: () => getRaffle(id), enabled: !!id });

  return (
    <main className="mt-6 space-y-6 max-w-3xl mx-auto">
      <section className="space-y-3">
        <h2 className="text-xl font-bold">
          Ganadores {raffleQ.data?.name ? (
            <span className="text-gray-500 font-medium">— {raffleQ.data.name}</span>
          ) : null}
        </h2>
        {winnersQ.isLoading ? (
          <div className="p-4 border rounded-xl bg-white">Cargando ganadores…</div>
        ) : (
          <WinnerTable winners={winnersQ.data ?? []} />
        )}
      </section>
    </main>
  );
}
