import { RaffleBuyClient } from './RaffleBuyClient';
import { RaffleHeader } from '@/components/RaffleHeader';
import { getRaffle, getRaffleCounters } from '@/lib/data/raffles';
import { generateStaticParams as generateStaticParamsImpl } from './static-params';

// Next.js con `output: 'export'` requiere que los segmentos dinámicos
// definan generateStaticParams directamente en el módulo de la ruta.
// Declaramos la función aquí para que el builder la detecte.
export async function generateStaticParams() {
  return generateStaticParamsImpl();
}

export default async function RaffleDetailPage({ params }: { params: { id: string } }) {
  const raffle = await getRaffle(params.id);
  const counters = raffle ? await getRaffleCounters(params.id) : null;
  if (!raffle) return <main className="mt-6"><div>Rifa no encontrada.</div></main>;
  return (
    <main className="mt-6 space-y-6">
      {/* Render server-side to avoid late surprise banners; include reserved info immediately */}
      <RaffleHeader raffle={raffle} counters={counters} />
      <section id="sec-buy" className="space-y-4">
        {/* Compra rápida con selector de cantidad y reserva por 10 minutos */}
        <RaffleBuyClient raffleId={params.id} />
      </section>
    </main>
  );
}
