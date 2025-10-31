"use client";
import { useQuery } from '@tanstack/react-query';
import { getLastDraw } from '@/lib/data/draws';
import { listWinners } from '@/lib/data/winners';
import { LastDrawCard } from '@/components/LastDrawCard';
import WinnerList from '@/components/WinnerList';
export { generateStaticParams } from '../static-params';

export default function RaffleResultPage({ params }: { params: { id: string } }) {
  const drawQ = useQuery({ queryKey: ['last-draw', params.id], queryFn: () => getLastDraw(params.id), enabled: !!params.id });
  const winnersQ = useQuery({ queryKey: ['winners', params.id], queryFn: () => listWinners(params.id), enabled: !!params.id });

  return (
    <main className="mt-6 space-y-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">Resultados</h1>

      {drawQ.isLoading ? (
        <div className="p-4 border rounded-xl bg-white">Cargando sorteo…</div>
      ) : drawQ.data ? (
        <LastDrawCard draw={drawQ.data} />
      ) : (
        <div className="p-4 border rounded-xl bg-gray-50">No hay sorteos registrados.</div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Ganadores</h2>
        {winnersQ.isLoading ? (
          <div className="p-4 border rounded-xl bg-white">Cargando ganadores…</div>
        ) : (
          <WinnerList winners={winnersQ.data ?? []} />
        )}
      </section>
    </main>
  );
}
