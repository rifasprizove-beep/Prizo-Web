"use client";
import { useQuery } from '@tanstack/react-query';
import { listRaffles } from '@/lib/data/raffles';
import { RaffleCard } from '../components/RaffleCard';

export default function Page() {
  const q = useQuery({ queryKey: ['raffles'], queryFn: listRaffles });
  return (
    <main className="mt-6 site-container">
      <h1 className="text-2xl font-bold mb-4">Rifas</h1>
      {q.isLoading ? (
        <div>Cargando rifas…</div>
      ) : q.error ? (
        <div className="p-3 rounded border bg-yellow-50 text-yellow-800">
          No se pudieron cargar las rifas. Verifica que NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY estén configuradas en apps/web/.env.local
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(q.data ?? []).map((r) => (
            <RaffleCard key={r.id} raffle={r} />
          ))}
        </div>
      )}
      {!q.isLoading && !(q.data ?? []).length && <div className="mt-4">No hay rifas disponibles.</div>}
    </main>
  );
}
