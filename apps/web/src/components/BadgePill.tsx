"use client";
import { ReactNode } from "react";

export function BadgePill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "brand" | "success" | "danger" }) {
  const styles =
    tone === "brand"
      ? "bg-brand-500 text-white border-brand-400"
      : tone === "success"
      ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/30"
      : tone === "danger"
      ? "bg-red-500/20 text-red-200 border-red-500/30"
      : "bg-white/5 text-gray-200 border-white/10";
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border ${styles}`}>{children}</span>
  );
}
