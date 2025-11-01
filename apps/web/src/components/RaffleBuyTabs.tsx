"use client";
import { useState } from "react";
import { RaffleQuickBuy } from "./RaffleQuickBuy";
import type { RafflePaymentInfo } from "@/lib/data/paymentConfig";
import { RaffleBuySection } from "./RaffleBuySection";

export function RaffleBuyTabs({ raffleId, currency, totalTickets, unitPriceCents, paymentInfo, allowManual = true, isFree = false }: { raffleId: string; currency: string; totalTickets: number; unitPriceCents: number; paymentInfo: RafflePaymentInfo | null; allowManual?: boolean; isFree?: boolean }) {
  const [tab, setTab] = useState<"quick" | "manual">("quick");

  return (
    <div className="space-y-4">
      {allowManual ? (
        <div className="flex items-center rounded-full border bg-white overflow-hidden w-fit">
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
        <div className="rounded-2xl border p-4 bg-white text-sm text-gray-700">
          Esta rifa asigna los números <b>al azar</b>. Puedes indicar cuántos quieres y los reservaremos por 10 minutos.
        </div>
      )}

      {!allowManual || tab === 'quick' ? (
        <RaffleQuickBuy raffleId={raffleId} currency={currency} totalTickets={totalTickets} unitPriceCents={unitPriceCents} paymentInfo={paymentInfo ?? undefined} isFree={isFree} />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border p-4 bg-white">
            <h2 className="text-lg md:text-xl font-extrabold tracking-wide uppercase">Elige tus números</h2>
            <p className="text-sm text-gray-600 mt-1">Pulsa en un número disponible para reservarlo por 10 minutos.</p>
          </div>
          <RaffleBuySection raffleId={raffleId} currency={currency} unitPriceCents={unitPriceCents} paymentInfo={paymentInfo} isFree={isFree}
          />
        </div>
      )}
    </div>
  );
}
