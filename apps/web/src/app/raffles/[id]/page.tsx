import { RaffleDetailClient } from './RaffleDetailClient';
import { RaffleBuyClient } from './RaffleBuyClient';

export default function RaffleDetailPage({ params }: { params: { id: string } }) {
  return (
    <main className="mt-6 space-y-6">
      <RaffleDetailClient id={params.id} />
      <section id="sec-buy" className="space-y-4">
        {/* Compra rápida con selector de cantidad y reserva por 10 minutos */}
        <RaffleBuyClient raffleId={params.id} />
      </section>
    </main>
  );
}
