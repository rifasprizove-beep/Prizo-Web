"use client";
import { useCurrency } from "@/lib/currency";

export function CurrencyToggle() {
  const { currency, setCurrency, toggleCurrency } = useCurrency();
  return (
    <div
      className="relative inline-flex items-center rounded-full border border-brand-300 text-brand-200 bg-transparent px-1 py-1 shadow-glowSm"
      role="group"
      aria-label="Seleccionar moneda"
    >
      {/* Thumb deslizante */}
      <span
        className={`absolute top-1 bottom-1 rounded-full bg-brand-500 transition-all duration-300 ease-out ${currency === 'USD' ? 'left-1/2 right-1' : 'left-1 right-1/2'}`}
        aria-hidden="true"
      />

      {/* Opciones */}
      <button
        type="button"
        onClick={() => setCurrency('VES')}
        aria-pressed={currency === 'VES'}
        aria-label="Ver valores en bolívares"
        className={`relative z-10 px-4 py-1.5 text-xs font-semibold transition-colors ${currency === 'VES' ? 'text-black' : 'text-brand-200 hover:text-white/90'}`}
      >
        VES
      </button>
      <button
        type="button"
        onClick={() => setCurrency('USD')}
        aria-pressed={currency === 'USD'}
        aria-label="Ver valores en dólares"
        className={`relative z-10 px-4 py-1.5 text-xs font-semibold transition-colors ${currency === 'USD' ? 'text-black' : 'text-brand-200 hover:text-white/90'}`}
      >
        USD
      </button>
    </div>
  );
}
