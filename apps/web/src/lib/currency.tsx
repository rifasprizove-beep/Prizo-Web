"use client";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type DisplayCurrency = "USD" | "VES";

type CurrencyContextValue = {
  currency: DisplayCurrency;
  setCurrency: (c: DisplayCurrency) => void;
  toggleCurrency: () => void;
};

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined);

const STORAGE_KEY = "prizo_currency";

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<DisplayCurrency>("USD");

  // Rehidratar desde localStorage sólo en cliente
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "USD" || saved === "VES") {
        setCurrencyState(saved);
      }
    } catch {}
  }, []);

  const setCurrency = (c: DisplayCurrency) => {
    setCurrencyState(c);
    try { localStorage.setItem(STORAGE_KEY, c); } catch {}
  };

  const toggleCurrency = () => setCurrency(currency === "USD" ? "VES" : "USD");

  const value = useMemo(() => ({ currency, setCurrency, toggleCurrency }), [currency]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within a CurrencyProvider");
  return ctx;
}
