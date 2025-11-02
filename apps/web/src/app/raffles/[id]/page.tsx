import { RaffleDetailClient } from './RaffleDetailClient';
import { RaffleBuyClient } from './RaffleBuyClient';
import ClientResultPage from './result/ClientResultPage';
import { generateStaticParams as generateStaticParamsImpl } from './static-params';

// Next.js con `output: 'export'` requiere que los segmentos dinámicos
// definan generateStaticParams directamente en el módulo de la ruta.
// Declaramos la función aquí para que el builder la detecte.
export async function generateStaticParams() {
  return generateStaticParamsImpl();
}

export default function RaffleDetailPage({ params }: { params: { id: string } }) {
  return (
    <main className="mt-6 space-y-6">
      <RaffleDetailClient id={params.id} />
      <section id="sec-buy" className="space-y-4">
        {/* Compra rápida con selector de cantidad y reserva por 10 minutos */}
        <RaffleBuyClient raffleId={params.id} />
      </section>
      <section id="sec-result" className="space-y-4">
        <ClientResultPage id={params.id} />
      </section>
    </main>
  );
}
