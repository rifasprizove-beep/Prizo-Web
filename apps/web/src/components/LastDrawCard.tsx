import type { Draw } from '@/lib/types';

export function LastDrawCard({ draw }: { draw: Draw }) {
  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm space-y-2">
      <h2 className="text-lg font-semibold">Último sorteo</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-sm">
        <div><span className="text-gray-500">Proveedor: </span>{draw.provider ?? '—'}</div>
        <div><span className="text-gray-500">ID externo: </span>{draw.external_draw_id ?? '—'}</div>
        <div><span className="text-gray-500">Regla aplicada: </span>{draw.rule ?? '—'}</div>
        <div><span className="text-gray-500">Fecha sorteo: </span>{draw.draw_date ?? '—'}</div>
        <div><span className="text-gray-500">Resultado: </span>
          <strong className="text-lg sm:text-xl">{draw.result_number ?? '—'}</strong>
        </div>
        {draw.official_link && (
          <div className="truncate">
            <a className="text-blue-600 underline" href={draw.official_link} target="_blank" rel="noreferrer">
              Ver enlace oficial
            </a>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-500">Iniciado: {new Date(draw.started_at).toLocaleString()}</p>
    </section>
  );
}
