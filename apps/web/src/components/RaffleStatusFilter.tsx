"use client";
import { useState, useEffect, useRef } from "react";
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  useEffect(() => {
    function update() {
      const idx = value === "open" ? 0 : value === "closed" ? 1 : 2;
      const btn = btnRefs.current[idx];
      const container = containerRef.current;
      if (!btn || !container) return;
      const containerRect = container.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      const left = Math.max(8, btnRect.left - containerRect.left + 4); // escala 8px
      const width = Math.max(32, btnRect.width - 8);
      setPillStyle({ left, width });
    }

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-center rounded-full border border-brand-300 text-brand-200 bg-transparent px-1 py-1 shadow-glowSm"
      role="group"
      aria-label="Filtrar rifas"
    >
      <span
        style={{ left: pillStyle.left, width: pillStyle.width }}
        className="absolute top-1 bottom-1 rounded-full bg-brand-500 transition-all duration-300 ease-out"
        aria-hidden="true"
      />

      <div className="relative z-10 inline-flex items-center gap-0">
        <button
          ref={el => (btnRefs.current[0] = el)}
          type="button"
          onClick={() => onChange("open")}
          aria-pressed={value === "open"}
          className={`relative z-10 px-4 py-2 text-xs font-semibold transition-colors ${
            value === "open" ? "text-black" : "text-brand-200 hover:text-white/90"
          }`}
        >
          Abiertas
        </button>
        <button
          ref={el => (btnRefs.current[1] = el)}
          type="button"
          onClick={() => onChange("closed")}
          aria-pressed={value === "closed"}
          className={`relative z-10 px-4 py-2 text-xs font-semibold transition-colors ${
            value === "closed" ? "text-black" : "text-brand-200 hover:text-white/90"
          }`}
        >
          Cerradas
        </button>
        <button
          ref={el => (btnRefs.current[2] = el)}
          type="button"
          onClick={() => onChange("all")}
          aria-pressed={value === "all"}
          className={`relative z-10 px-4 py-2 text-xs font-semibold transition-colors ${
            value === "all" ? "text-black" : "text-brand-200 hover:text-white/90"
          }`}
        >
          Todas
        </button>
      </div>
    </div>
  );
}