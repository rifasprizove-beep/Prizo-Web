"use client";
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listRaffles } from '@/lib/data/raffles';
import { RaffleCard } from '../components/RaffleCard';
import { getApiHealth } from '@/lib/rpc';
import { RaffleCardSkeleton } from '../components/RaffleCardSkeleton';
import { RaffleStatusFilter, useRaffleStatusFilter, filterRafflesByMode } from '../components/RaffleStatusFilter';

export default function Page() {
  const q = useQuery({ queryKey: ['raffles'], queryFn: listRaffles });
  const [apiWarn, setApiWarn] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const h = await getApiHealth();
      if (h && !h.ok) setApiWarn(`La API no responde: ${h.detail ?? ''}`.trim());
    })();
  }, []);
  const { mode, setMode } = useRaffleStatusFilter();
  const raffles = (q.data ?? []);
  const visible = filterRafflesByMode(raffles, mode);
  return (
    <main className="mt-6 site-container">
      {apiWarn && (
        <div className="mb-4 rounded-lg border border-yellow-300/40 bg-yellow-100/10 text-yellow-200 px-4 py-3">
          {apiWarn} · Revisa NEXT_PUBLIC_API_URL o el servicio de API.
        </div>
      )}
      <section className="mb-6">
        <p className="text-xs uppercase tracking-wider text-gray-400">Eleva tu juego</p>
        <h1 className="text-4xl md:text-6xl font-extrabold leading-tight title-neon">Rifas para todos</h1>
        {/* Barra de filtros */}
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <RaffleStatusFilter value={mode} onChange={setMode} />
        </div>
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
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {visible.map((r) => (
              <RaffleCard key={r.id} raffle={r} />
            ))}
          </div>
        </>
      )}
      {!q.isLoading && !raffles.length && <div className="mt-4">No hay rifas disponibles.</div>}
      {!q.isLoading && raffles.length > 0 && !visible.length && (
        <div className="mt-4 text-sm text-gray-400">No hay rifas en esta categoría.</div>
      )}
    </main>
  );
}
