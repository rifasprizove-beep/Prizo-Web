"use client";
import { useQuery } from '@tanstack/react-query';
import { listRaffles } from '@/lib/data/raffles';
import { RaffleCard } from '../components/RaffleCard';
import { RaffleCardSkeleton } from '../components/RaffleCardSkeleton';

export default function Page() {
  const q = useQuery({ queryKey: ['raffles'], queryFn: listRaffles });
  return (
    <main className="mt-6 site-container">
      <section className="mb-6">
        <p className="text-xs uppercase tracking-wider text-gray-400">Eleva tu juego</p>
        <h1 className="text-4xl md:text-6xl font-extrabold leading-tight title-neon">Rifas para todos</h1>
      </section>
      {q.isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <RaffleCardSkeleton key={i} />
          ))}
        </div>
      ) : q.error ? (
        <div className="p-3 rounded border bg-yellow-50 text-yellow-800">
          No se pudieron cargar las rifas. Verifica que NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY estén configuradas en apps/web/.env.local
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {(q.data ?? []).map((r) => (
            <RaffleCard key={r.id} raffle={r} />
          ))}
        </div>
      )}
      {!q.isLoading && !(q.data ?? []).length && <div className="mt-4">No hay rifas disponibles.</div>}
    </main>
  );
}
