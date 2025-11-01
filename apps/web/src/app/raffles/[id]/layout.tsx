import { generateStaticParams as generateStaticParamsImpl } from './static-params';
export async function generateStaticParams() {
  return generateStaticParamsImpl();
}

export default function RaffleIdLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
