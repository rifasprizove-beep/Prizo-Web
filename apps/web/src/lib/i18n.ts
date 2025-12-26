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

// Status efectivo calculado en cliente según tiempos si el backend aún no lo actualiza.
export function effectiveRaffleStatus(r: Raffle): Raffle['status'] {
  const now = Date.now();
  const starts = r.starts_at ? Date.parse(r.starts_at) : null;
  const ends = r.ends_at ? Date.parse(r.ends_at) : null;
  // Si ya sorteado o archivado, respetar.
  if (r.status === 'drawn' || r.status === 'archived') return r.status;
  // Si marcado cerrado explícito, respetar.
  if (r.status === 'closed') return 'closed';
  // Si tiene fecha de fin pasada, cerrar automáticamente.
  if (ends && now >= ends) return 'closed';
  // Si está en published y ya alcanzó starts_at -> tratar como selling.
  if (r.status === 'published' && starts && now >= starts && (!ends || now < ends)) return 'selling';
  // De lo contrario devolver status original.
  return r.status;
}

// Fases de UI según petición del usuario:
// published -> upcoming (mensaje pronto). selling -> buying.
// drawn -> awaiting_winner (usuario solicitó que drawn muestre esperando ganador).
// closed -> finished (usuario solicitó que closed represente finalizado con ganador publicado).
export type RaffleUiPhase = 'upcoming' | 'buying' | 'awaiting_winner' | 'finished' | 'other';
export function uiRafflePhase(r: Raffle): RaffleUiPhase {
  const eff = effectiveRaffleStatus(r);
  switch (eff) {
    case 'published':
      return 'upcoming';
    case 'selling':
      return 'buying';
    case 'drawn':
      return 'awaiting_winner';
    case 'closed':
      return 'finished';
    default:
      return 'other';
  }
}

export function formatMoney(amount: number, currency: 'USD' | 'VES' | 'USDT'): string {
  try {
    const formatted = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    if (currency === 'USD') return `$${formatted}`;
    if (currency === 'USDT') return `${formatted} USDT`;
    return `Bs.${formatted}`;
  } catch {
    if (currency === 'USD') return `$${amount.toFixed(2)}`;
    if (currency === 'USDT') return `${amount.toFixed(2)} USDT`;
    return `Bs.${amount.toFixed(2)}`;
  }
}

export function formatVES(amount: number): string {
  return formatMoney(amount, 'VES');
}
