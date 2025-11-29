"use client";
import { useEffect, useRef, useState } from "react";

export function SegmentedControl({ options, value, onChange }: { options: Array<{ key: string; label: string }>; value: string; onChange: (v: string) => void }) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);
	const [pillStyle, setPillStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

	useEffect(() => {
		function update() {
			const container = containerRef.current;
			if (!container) return;
			const idx = Math.max(0, options.findIndex((o) => o.key === value));
			const styles = getComputedStyle(container);
			const padLeft = parseFloat(styles.paddingLeft || '0');
			const padRight = parseFloat(styles.paddingRight || '0');
			const innerWidth = container.clientWidth - padLeft - padRight;

			// Si hay exactamente 2 opciones, usar segmentos iguales para simetría
			if (options.length === 2) {
				const segmentWidth = innerWidth / 2;
				const left = padLeft + idx * segmentWidth;
				const width = segmentWidth;
				setPillStyle({ left, width });
				return;
			}

			// Fallback: calcular por botón seleccionado (para 3+ opciones)
			const btn = btnRefs.current[idx];
			if (!btn) return;
			const containerRect = container.getBoundingClientRect();
			const btnRect = btn.getBoundingClientRect();
			const left = Math.max(padLeft, btnRect.left - containerRect.left + 4);
			const width = Math.max(32, btnRect.width - 8);
			setPillStyle({ left, width });
		}
		update();
		window.addEventListener("resize", update);
		return () => window.removeEventListener("resize", update);
	}, [value, options]);

	return (
		<div
			ref={containerRef}
			className="relative inline-flex items-center rounded-full border border-brand-300 text-brand-200 bg-transparent px-1 py-1 shadow-glowSm"
			role="tablist"
		>
			<span style={{ left: pillStyle.left, width: pillStyle.width }} className="absolute top-1 bottom-1 rounded-full bg-brand-500 transition-all duration-300 ease-out" aria-hidden="true" />
			<div className="relative z-10 inline-flex items-center gap-0">
				{options.map((o, i) => (
					<button
						key={o.key}
						ref={(el: HTMLButtonElement | null) => { btnRefs.current[i] = el; }}
						type="button"
						role="tab"
						aria-selected={value === o.key}
						onClick={() => onChange(o.key)}
						className={`relative z-10 px-4 sm:px-5 py-1.5 text-xs font-semibold transition-colors ${value === o.key ? "text-black" : "text-brand-200 hover:text-white/90"}`}
					>
						{o.label}
					</button>
				))}
			</div>
		</div>
	);
}
