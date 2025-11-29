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
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number; visible: boolean }>({ left: 0, width: 0, visible: false });

  useEffect(() => {
    function update() {
      const container = containerRef.current;
      if (!container) return;
      // Si está en 'all', ocultar el pill (no hay selección)
      if (value === 'all') {
        setPillStyle(s => ({ ...s, visible: false }));
        return;
      }
      // Calcular posición y ancho del pill por segmentos iguales (2 columnas)
      const idx = value === 'open' ? 0 : 1;
      const containerStyles = getComputedStyle(container);
      const padLeft = parseFloat(containerStyles.paddingLeft || '0');
      const padRight = parseFloat(containerStyles.paddingRight || '0');
      const innerWidth = container.clientWidth - padLeft - padRight;
      const segmentWidth = innerWidth / 2;
      const left = padLeft + idx * segmentWidth;
      const width = segmentWidth;
      setPillStyle({ left, width, visible: true });
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="relative inline-flex items-center rounded-full border border-brand-300 text-brand-200 bg-transparent px-1 py-1 shadow-glowSm w-[260px] mx-auto sm:mx-0 sm:w-auto overflow-hidden"
      role="group"
      aria-label="Filtrar rifas"
    >
      {pillStyle.visible && (
        <span
          style={{ left: pillStyle.left, width: pillStyle.width }}
          className="absolute top-1 bottom-1 rounded-full bg-brand-500 transition-all duration-300 ease-out"
          aria-hidden="true"
        />
      )}

      <div className="relative z-10 inline-flex items-center gap-0 w-full">
        <button
          ref={(el) => { btnRefs.current[0] = el; }}
          type="button"
          onClick={() => onChange(value === 'open' ? 'all' : 'open')}
          aria-pressed={value === 'open'}
          className={`relative z-10 px-4 py-2 text-xs font-semibold transition-colors flex-1 text-center rounded-full ${
            value === 'open' ? 'text-black' : 'text-brand-200 hover:text-white/90'
          }`}
        >
          Abiertas
        </button>
        <button
          ref={(el) => { btnRefs.current[1] = el; }}
          type="button"
          onClick={() => onChange(value === 'closed' ? 'all' : 'closed')}
          aria-pressed={value === 'closed'}
          className={`relative z-10 px-4 py-2 text-xs font-semibold transition-colors flex-1 text-center rounded-full ${
            value === 'closed' ? 'text-black' : 'text-brand-200 hover:text-white/90'
          }`}
        >
          Cerradas
        </button>
      </div>
    </div>
  );
}