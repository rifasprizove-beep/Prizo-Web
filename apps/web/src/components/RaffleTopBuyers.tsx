"use client";
import { useQuery } from '@tanstack/react-query';
import { listTopBuyers } from '@/lib/data/top_buyers';

export function RaffleTopBuyers({ raffleId }: { raffleId: string }) {
  const q = useQuery({
    queryKey: ['top-buyers', raffleId],
    queryFn: () => listTopBuyers(raffleId),
    enabled: !!raffleId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  if (q.isLoading) return <div className="rounded-2xl border p-4 bg-white text-sm">Cargando top compradores…</div>;
  const data = q.data || [];
  if (!data.length) return <div className="rounded-2xl border p-4 bg-white text-sm">Aún no hay compradores aprobados.</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border p-4 bg-white">
        <h2 className="text-lg md:text-xl font-extrabold tracking-wide uppercase">Top compradores</h2>
        <p className="text-sm text-gray-600 mt-1">Ordenado por tickets aprobados. Se desempata por fecha reciente.</p>
      </div>
      <div className="rounded-2xl border bg-white overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 px-3">#</th>
              <th className="py-2 px-3">Email</th>
              <th className="py-2 px-3">Tickets</th>
              <th className="py-2 px-3">Pagos</th>
              <th className="py-2 px-3">Último</th>
            </tr>
          </thead>
          <tbody>
            {data.map((b, i) => (
              <tr key={b.buyer_email || i} className="border-b last:border-b-0">
                <td className="py-2 px-3 font-semibold">{i + 1}</td>
                <td className="py-2 px-3 break-all">{b.buyer_email || '—'}</td>
                <td className="py-2 px-3">{b.tickets}</td>
                <td className="py-2 px-3">{b.payments_count}</td>
                <td className="py-2 px-3 text-xs text-gray-600">{new Date(b.last_payment).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}