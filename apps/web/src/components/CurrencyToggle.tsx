"use client";
import { useCurrency } from "@/lib/currency";

export function CurrencyToggle() {
  const { currency, setCurrency, toggleCurrency } = useCurrency();
  return (
    <div className="inline-flex items-center rounded-full border bg-white overflow-hidden">
      <button
        type="button"
        className={`px-3 py-1.5 text-xs font-semibold ${currency === 'VES' ? 'bg-brand-500 text-black' : 'text-brand-700 hover:bg-brand-50'}`}
        onClick={() => setCurrency('VES')}
        aria-pressed={currency === 'VES'}
        aria-label="Ver premio en bolívares"
      >VES</button>
      <button
        type="button"
        className={`px-3 py-1.5 text-xs font-semibold ${currency === 'USD' ? 'bg-brand-500 text-black' : 'text-brand-700 hover:bg-brand-50'}`}
        onClick={() => setCurrency('USD')}
        aria-pressed={currency === 'USD'}
        aria-label="Ver premio en dólares"
      >USD</button>
    </div>
  );
}
