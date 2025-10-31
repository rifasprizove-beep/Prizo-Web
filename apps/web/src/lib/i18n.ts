import type { Raffle } from './types';

export function raffleStatusEs(status: Raffle['status']): string {
  switch (status) {
    case 'selling':
      return 'abierto';
    case 'published':
      return 'publicado';
    case 'closed':
      return 'cerrado';
    case 'drawn':
      return 'sorteado';
    case 'draft':
      return 'borrador';
    case 'archived':
      return 'archivado';
    default:
      return String(status);
  }
}

export function formatVES(amount: number): string {
  try {
    return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'VES', maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount.toFixed(2)} Bs`;
  }
}
