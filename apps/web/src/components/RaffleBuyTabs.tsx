"use client";
import { useState } from "react";
import { RaffleQuickBuy } from "./RaffleQuickBuy";
import type { RafflePaymentInfo, RafflePaymentMethod } from "@/lib/data/paymentConfig";
import { RaffleBuySection } from "./RaffleBuySection";

export function RaffleBuyTabs({ raffleId, currency, totalTickets, unitPriceCents, minTicketPurchase = 1, paymentInfo, paymentMethods, allowManual = true, isFree = false, disabledAll = false, bootCycle = 0, onBootReady }: { raffleId: string; currency: string; totalTickets: number; unitPriceCents: number; minTicketPurchase?: number; paymentInfo: RafflePaymentInfo | null; paymentMethods?: RafflePaymentMethod[]; allowManual?: boolean; isFree?: boolean; disabledAll?: boolean; bootCycle?: number; onBootReady?: () => void }) {
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
            Los números se asignan <b>al azar</b> y tu selección se reserva por <b>10 minutos</b>. <b>Límite: 1.000 tickets por pago</b>. Para adquirir más, realiza pagos adicionales.
          </div>
        )
      )}

      {/* Selector de método removido de aquí por UX; ahora va dentro del formulario */}

      {tab === 'quick' ? (
        <RaffleQuickBuy raffleId={raffleId} currency={currency} totalTickets={totalTickets} unitPriceCents={unitPriceCents} minTicketPurchase={minTicketPurchase} paymentInfo={paymentInfo ?? undefined} paymentMethods={paymentMethods} isFree={isFree} disabledAll={disabledAll} bootCycle={bootCycle} onBootReady={onBootReady} />
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border p-4 bg-white">
            <h2 className="text-lg md:text-xl font-extrabold tracking-wide uppercase">Elige tus números</h2>
            <p className="text-sm text-gray-600 mt-1">Pulsa en un número disponible para reservarlo por 10 minutos.</p>
          </div>
          <RaffleBuySection raffleId={raffleId} currency={currency} unitPriceCents={unitPriceCents} minTicketPurchase={minTicketPurchase} paymentInfo={paymentInfo} isFree={isFree} disabledAll={disabledAll} bootCycle={bootCycle} onBootReady={onBootReady}
          />
        </div>
      )}
    </div>
  );
}
