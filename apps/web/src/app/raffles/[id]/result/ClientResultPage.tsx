"use client";
import { useQuery } from '@tanstack/react-query';
import { getLastDraw } from '@/lib/data/draws';
import { listWinners } from '@/lib/data/winners';
import { LastDrawCard } from '@/components/LastDrawCard';
import WinnerTable from '@/components/WinnerTable';
import { getRaffle } from '@/lib/data/raffles';

export default function ClientResultPage({ id }: { id: string }) {
  const drawQ = useQuery({ queryKey: ['last-draw', id], queryFn: () => getLastDraw(id), enabled: !!id });
  const winnersQ = useQuery({ queryKey: ['winners', id], queryFn: () => listWinners(id), enabled: !!id });
  const raffleQ = useQuery({ queryKey: ['raffle', id], queryFn: () => getRaffle(id), enabled: !!id });

  return (
    <main className="mt-6 space-y-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">Resultados</h1>

      {drawQ.isLoading ? (
        <div className="p-4 border rounded-xl bg-white">Cargando sorteo…</div>
      ) : drawQ.data ? (
        <LastDrawCard draw={drawQ.data} />
      ) : raffleQ.data?.status === 'drawn' ? (
        <div className="p-4 border rounded-xl bg-gray-50">Sorteo realizado — los resultados se publicarán en breve.</div>
      ) : (
        <div className="p-4 border rounded-xl bg-gray-50">No hay sorteos registrados.</div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Ganadores</h2>
        {winnersQ.isLoading ? (
          <div className="p-4 border rounded-xl bg-white">Cargando ganadores…</div>
        ) : (
          <WinnerTable winners={winnersQ.data ?? []} />
        )}
      </section>
    </main>
  );
}
