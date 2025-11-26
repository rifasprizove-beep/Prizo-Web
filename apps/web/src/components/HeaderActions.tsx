"use client";
import { usePathname } from "next/navigation";
import { CurrencyToggle } from "./CurrencyToggle";

export function HeaderActions() {
  const pathname = usePathname();
  const hideCurrency = pathname === "/verify" || pathname === "/terms";
  return (
    <nav className="flex items-center gap-2 text-sm">
      {!hideCurrency && <CurrencyToggle />}
    </nav>
  );
}
