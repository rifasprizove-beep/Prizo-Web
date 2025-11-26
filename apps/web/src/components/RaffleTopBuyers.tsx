"use client";
import { useQuery } from '@tanstack/react-query';
import { listTopBuyers } from '@/lib/data/top_buyers';
import clsx from 'clsx';

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
  const top3 = data.slice(0, 3);

  const fmtDate = (d?: string) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleString();
    } catch { return d; }
  };

  return (
    <div className="space-y-6 top-buyers-root bg-white rounded-2xl p-6 shadow-md">
      <style>{`.top-buyers-root, .top-buyers-root * { color: #000 !important; opacity: 1 !important; }
        .top-buyers-root ::selection { background: #bde0ff !important; color: #000 !important; }
        .top-buyers-root a { color: #000 !important; }
      `}</style>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg md:text-xl font-extrabold tracking-wide uppercase text-black">Top compradores</h2>
          <p className="text-sm text-gray-600 mt-1">Ordenado por tickets aprobados. Se desempata por fecha reciente.</p>
        </div>
      </div>

      {/* Top 3 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {top3.map((b, i) => (
          <div key={b.buyer_email || i} className={clsx('flex items-center gap-4 p-4 rounded-xl bg-white border shadow-sm', i === 0 ? 'ring-1 ring-yellow-300' : '')}>
            <div className={clsx('flex-shrink-0 h-14 w-14 rounded-full flex items-center justify-center text-lg font-bold text-pink-700 bg-pink-100')}>
              {b.instagram ? b.instagram.charAt(0).toUpperCase() : (b.buyer_email ? b.buyer_email.charAt(0).toUpperCase() : '?')}
            </div>

            <div className="flex-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-gray-500">#{i + 1}</div>
                  <div className="flex items-center gap-2"> 
                    {b.instagram ? (
                      <a href={`https://instagram.com/${b.instagram}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-black hover:underline" style={{ color: '#000', opacity: 1 }}>@{b.instagram}</a>
                    ) : (
                      <div className="font-semibold text-black break-all" style={{ color: '#000', opacity: 1 }}>{b.buyer_email || '—'}</div>
                    )}
                    {b.instagram && (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4 text-pink-500" fill="currentColor" aria-hidden>
                        <path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5A4.25 4.25 0 0 0 7.75 20.5h8.5a4.25 4.25 0 0 0 4.25-4.25v-8.5A4.25 4.25 0 0 0 16.25 3.5h-8.5zM12 7.25a4.75 4.75 0 1 1 0 9.5 4.75 4.75 0 0 1 0-9.5zm0 1.5a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5zM17.5 6.25a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5z" />
                      </svg>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-gray-400">Tickets</div>
                  <div className="text-2xl font-extrabold text-black" style={{ color: '#000', opacity: 1 }}>{b.tickets}</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-black" style={{ color: '#000', opacity: 1 }}>Último pago: {fmtDate(b.last_payment)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Full table */}
      <div className="rounded-2xl border bg-white overflow-x-auto selection:text-black selection:bg-blue-200 mt-4">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-pink-50 text-black">
              <th className="py-3 px-4 text-left font-semibold">#</th>
              <th className="py-3 px-4 text-left font-semibold">Usuario</th>
              <th className="py-3 px-4 font-semibold">Tickets</th>
              <th className="py-3 px-4 font-semibold">Pagos</th>
              <th className="py-3 px-4 font-semibold">Último</th>
            </tr>
          </thead>
          <tbody className="text-black">
            {data.map((b, i) => (
              <tr key={b.buyer_email || i} className="bg-white">
                <td className="py-3 px-4 font-semibold" style={{ color: '#000', opacity: 1 }}>{i + 1}</td>
                <td className="py-3 px-4 break-all" style={{ color: '#000', opacity: 1 }}>
                  {b.instagram ? (
                    <a href={`https://instagram.com/${b.instagram}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-black" style={{ color: '#000', opacity: 1 }}>@{b.instagram}</a>
                  ) : (
                    <span style={{ color: '#000', opacity: 1 }}>{b.buyer_email || '—'}</span>
                  )}
                </td>
                <td className="py-3 px-4 text-center font-semibold text-black" style={{ color: '#000', opacity: 1 }}>{b.tickets}</td>
                <td className="py-3 px-4 text-center text-black" style={{ color: '#000', opacity: 1 }}>{b.payments_count}</td>
                <td className="py-3 px-4 text-xs text-black" style={{ color: '#000', opacity: 1 }}>{fmtDate(b.last_payment)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}