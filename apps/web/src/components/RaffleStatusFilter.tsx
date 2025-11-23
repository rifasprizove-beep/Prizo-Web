"use client";
import { useState, useEffect } from "react";
import type { Raffle } from "@/lib/types";

type StatusMode = "all" | "open" | "closed";

export function useRaffleStatusFilter() {
  const [mode, setMode] = useState<StatusMode>("open");
  return { mode, setMode } as const;
}

export function filterRafflesByMode(raffles: Raffle[], mode: StatusMode) {
  if (mode === "all") return raffles;
  const open = new Set(["published", "selling"]);
  const closed = new Set(["closed", "drawn"]);
  return raffles.filter(r => (mode === "open" ? open.has(r.status) : closed.has(r.status)));
}

export function RaffleStatusFilter({ value, onChange }: { value: StatusMode; onChange: (v: StatusMode) => void }) {
  return (
    <div
      className="relative inline-flex items-center rounded-full border border-brand-300 text-brand-200 bg-transparent px-1 py-1 shadow-glowSm select-none"
      role="group"
      aria-label="Filtrar rifas"
    >
      <span
        className={`absolute top-1 bottom-1 rounded-full bg-brand-500 transition-all duration-300 ease-out ${
          value === "open"
            ? "left-1 right-[66%]"
            : value === "closed"
            ? "left-[33%] right-[33%]"
            : "left-[66%] right-1"
        }`}
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={() => onChange("open")}
        aria-pressed={value === "open"}
        className={`relative z-10 px-4 py-1.5 text-xs font-semibold transition-colors ${
          value === "open" ? "text-black" : "text-brand-200 hover:text-white/90"
        }`}
      >
        Abiertas
      </button>
      <button
        type="button"
        onClick={() => onChange("closed")}
        aria-pressed={value === "closed"}
        className={`relative z-10 px-4 py-1.5 text-xs font-semibold transition-colors ${
          value === "closed" ? "text-black" : "text-brand-200 hover:text-white/90"
        }`}
      >
        Cerradas
      </button>
      <button
        type="button"
        onClick={() => onChange("all")}
        aria-pressed={value === "all"}
        className={`relative z-10 px-4 py-1.5 text-xs font-semibold transition-colors ${
          value === "all" ? "text-black" : "text-brand-200 hover:text-white/90"
        }`}
      >
        Todas
      </button>
    </div>
  );
}