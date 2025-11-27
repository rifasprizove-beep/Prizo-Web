"use client";
import { useState } from "react";
import type { Raffle } from "@/lib/types";

export type RawStatus = 'all' | 'draft' | 'published' | 'selling' | 'drawn' | 'closed' | 'archived';

export function useRaffleRawStatus() {
  const [status, setStatus] = useState<RawStatus>('all');
  return { status, setStatus } as const;
}

export function filterRafflesByRawStatus(raffles: Raffle[], status: RawStatus) {
  if (status === 'all') return raffles;
  return raffles.filter(r => r.status === status);
}

const OPTIONS: RawStatus[] = ['all','published','selling','drawn','closed']; // ocultamos archived y draft

export function RaffleRawStatusFilter({ value, onChange }: { value: RawStatus; onChange: (v: RawStatus) => void }) {
  return (
    <div
      className="flex items-center justify-center bg-black/80 border-2 border-brand-400 rounded-full p-1 w-fit mx-auto"
      aria-label="Filtrar por estado exacto"
      style={{ boxShadow: '0 0 0 2px #ff2e7a' }}
    >
      {OPTIONS.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
          className={`px-6 py-2 rounded-full text-xs font-semibold transition-colors focus:outline-none ${
            value === opt
              ? 'bg-brand-500 text-black shadow-md'
              : 'bg-transparent text-brand-200 hover:text-white'
          }`}
          style={{ border: 'none' }}
        >
          {label(opt)}
        </button>
      ))}
    </div>
  );
}

function label(s: RawStatus) {
  switch (s) {
    case 'all': return 'Todas';
    case 'published': return 'Publicadas';
    case 'selling': return 'Vendiendo';
    case 'drawn': return 'Con Sorteo';
    case 'closed': return 'Cerradas';
    case 'archived': return 'Archivadas'; // ya no se muestra
    case 'draft': return 'Borrador';
  }
}
