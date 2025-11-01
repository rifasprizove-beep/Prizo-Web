import ClientResultPage from './ClientResultPage';

// Para `output: 'export'`, esta página dentro de un segmento dinámico
// necesita exponer generateStaticParams directamente.
// No requiere valores aquí, solo la presencia de la función.
export async function generateStaticParams() {
  return [] as Array<{ id: string }>;
}

export default function RaffleResultPage({ params }: { params: { id: string } }) {
  return <ClientResultPage id={params.id} />;
}
