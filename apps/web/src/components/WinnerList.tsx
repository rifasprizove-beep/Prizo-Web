import type { Winner } from '@/lib/types';
import WinnerBadge from './WinnerBadge';

export default function WinnerList({ winners }: { winners: Winner[] }) {
  if (!winners?.length) {
    return (
      <div className="rounded-xl border p-4 bg-gray-50 text-gray-600">
        Aún no hay ganadores registrados.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {winners.map((w) => <WinnerBadge key={w.id} w={w} />)}
    </div>
  );
}
