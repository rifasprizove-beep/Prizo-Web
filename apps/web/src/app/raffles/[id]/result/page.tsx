export { generateStaticParams } from '../static-params';
import ClientResultPage from './ClientResultPage';

export default function RaffleResultPage({ params }: { params: { id: string } }) {
  return <ClientResultPage id={params.id} />;
}
