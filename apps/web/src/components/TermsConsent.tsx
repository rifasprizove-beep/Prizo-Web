"use client";
import { useEffect, useState } from "react";

const STORAGE_KEY = "prizo_terms_accepted_v1";

export function TermsConsent() {
  const [open, setOpen] = useState(false);
  const [ageOk, setAgeOk] = useState(false);
  const [accept, setAccept] = useState(false);

  useEffect(() => {
    try {
      const ok = localStorage.getItem(STORAGE_KEY) === "1";
      if (!ok) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  if (!open) return null;

  const canContinue = ageOk && accept;

  return (
    <div className="fixed inset-0 z-[1000]">
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative z-10 max-w-lg w-[92%] mx-auto mt-20 rounded-2xl border border-brand-500/30 bg-surface-700 text-white p-5 shadow-glow">
        <h2 className="text-xl font-bold mb-2">Términos y condiciones</h2>
        <p className="text-sm text-gray-300 mb-3">
          Para usar esta web debes leer y aceptar los Términos y Condiciones. En especial:
        </p>
        <ul className="text-sm text-gray-200 list-disc pl-5 space-y-1 mb-3">
          <li>Declaras ser mayor de 18 años.</li>
          <li>Proporcionas datos reales y autorizas su uso para gestionar tu participación.</li>
          <li>Las rifas gratis permiten solo una participación por persona (correo, Instagram o teléfono).</li>
          <li>El uso fraudulento puede anular participaciones.</li>
        </ul>
        <a href="/terms" className="text-brand-500 underline text-sm">Leer términos completos</a>

        <div className="mt-4 space-y-2">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={ageOk} onChange={(e) => setAgeOk(e.target.checked)} />
            <span>Soy mayor de 18 años.</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
            <span>He leído y acepto los Términos y Condiciones y la Política de Privacidad.</span>
          </label>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            className="pill-outline"
            onClick={() => {
              try { localStorage.removeItem(STORAGE_KEY); } catch {}
              setOpen(true);
            }}
          >Volver a leer</button>
          <button
            className="btn-neon disabled:opacity-50"
            disabled={!canContinue}
            onClick={() => {
              try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
              setOpen(false);
            }}
          >Aceptar y continuar</button>
        </div>
      </div>
    </div>
  );
}
