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
    <div className="flex flex-wrap gap-2" aria-label="Filtrar por estado exacto">
      {OPTIONS.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
            value === opt
              ? 'bg-brand-500 border-brand-500 text-black'
              : 'border-brand-400/40 text-brand-200 hover:border-brand-300 hover:text-white'
          }`}
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
