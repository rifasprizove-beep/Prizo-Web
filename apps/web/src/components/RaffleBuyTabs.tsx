"use client";
import { useState } from "react";
import { RaffleQuickBuy } from "./RaffleQuickBuy";
import type { RafflePaymentInfo } from "@/lib/data/paymentConfig";
import type { RafflePaymentMethod } from "@/lib/data/paymentConfig";
import { RaffleBuySection } from "./RaffleBuySection";

export function RaffleBuyTabs({ raffleId, currency, totalTickets, unitPriceCents, minTicketPurchase = 1, paymentInfo, allowManual = true, isFree = false, disabledAll = false, methodSelector }: { raffleId: string; currency: string; totalTickets: number; unitPriceCents: number; minTicketPurchase?: number; paymentInfo: RafflePaymentInfo | null; allowManual?: boolean; isFree?: boolean; disabledAll?: boolean; methodSelector?: { methods: RafflePaymentMethod[]; index: number; onChange: (n: number) => void } }) {
  const [tab, setTab] = useState<"quick" | "manual">("quick");

  return (
    <div className="space-y-4">
      {allowManual ? (
        <div className="flex items-center rounded-full border bg-white overflow-hidden w-full max-w-xs mx-auto">
          <button
            type="button"
            className={`px-4 py-2 text-sm font-semibold ${tab === 'quick' ? 'bg-pink-600 text-white' : 'text-pink-700 hover:bg-pink-50'}`}
            onClick={() => setTab('quick')}
          >
            Selección rápida
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-semibold ${tab === 'manual' ? 'bg-pink-600 text-white' : 'text-pink-700 hover:bg-pink-50'}`}
            onClick={() => setTab('manual')}
          >
            Elegir números
          </button>
        </div>
      ) : (
        !isFree && (
          <div className="rounded-xl border p-3 bg-white text-sm text-brand-700">
            Esta rifa asigna los números <b>al azar</b>. Puedes indicar cuántos quieres y los reservaremos por 10 minutos.
          </div>
        )
      )}

      {methodSelector && (
        <div className="flex items-center justify-center gap-2">
          {methodSelector.methods.map((m, i) => (
            <button
              key={m.key ?? i}
              type="button"
              className={`px-3 py-1.5 rounded-full text-sm border ${methodSelector.index === i ? 'bg-pink-600 text-white border-pink-600' : 'bg-white text-pink-700 border-pink-300'}`}
              onClick={() => methodSelector.onChange(i)}
            >{m.method_label ?? (i === 0 ? 'Pago Móvil' : 'Otro método')}</button>
          ))}
        </div>
      )}

      {tab === 'quick' ? (
        <RaffleQuickBuy raffleId={raffleId} currency={currency} totalTickets={totalTickets} unitPriceCents={unitPriceCents} minTicketPurchase={minTicketPurchase} paymentInfo={paymentInfo ?? undefined} isFree={isFree} disabledAll={disabledAll} />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border p-4 bg-white">
            <h2 className="text-lg md:text-xl font-extrabold tracking-wide uppercase">Elige tus números</h2>
            <p className="text-sm text-gray-600 mt-1">Pulsa en un número disponible para reservarlo por 10 minutos.</p>
          </div>
          <RaffleBuySection raffleId={raffleId} currency={currency} unitPriceCents={unitPriceCents} minTicketPurchase={minTicketPurchase} paymentInfo={paymentInfo} isFree={isFree} disabledAll={disabledAll}
          />
        </div>
      )}
    </div>
  );
}
