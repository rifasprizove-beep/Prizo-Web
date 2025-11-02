"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

type ThemeMode = "dark" | "light";

type ThemeCtx = {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  toggle: () => void;
};

const Ctx = createContext<ThemeCtx | null>(null);

const STORAGE_KEY = "prizo_theme_v1";

export function ThemeProvider({ children, lockedMode }: { children: React.ReactNode; lockedMode?: ThemeMode }) {
  const [theme, setTheme] = useState<ThemeMode>(lockedMode ?? "dark");

  // Leer de localStorage al montar
  useEffect(() => {
    if (lockedMode) {
      // Forzar el modo bloqueado desde el inicio
      setTheme(lockedMode);
      try { localStorage.setItem(STORAGE_KEY, lockedMode); } catch {}
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (raw === "light" || raw === "dark") setTheme(raw);
    } catch {}
  }, [lockedMode]);

  // Aplicar clase en <html> y persistir
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.documentElement;
    el.classList.remove("theme-dark", "theme-light");
    el.classList.add(theme === "light" ? "theme-light" : "theme-dark");
    try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
  }, [theme]);

  const value = useMemo<ThemeCtx>(() => ({
    theme,
    setTheme: (t) => setTheme(lockedMode ?? t),
    toggle: lockedMode ? () => {} : () => setTheme((p) => (p === "dark" ? "light" : "dark")),
  }), [theme, lockedMode]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
