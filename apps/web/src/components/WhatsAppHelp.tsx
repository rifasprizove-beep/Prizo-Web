"use client";

export function WhatsAppHelp() {
  const phone = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  const base = `https://wa.me/${digits}`;
  const text = encodeURIComponent("Hola, necesito ayuda con mi participación/compra en Prizo.");
  const href = `${base}?text=${text}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-40 rounded-full px-4 py-2 bg-brand-500 text-white shadow-glow hover:translate-y-[-2px] transition-transform"
      aria-label="Chatear con soporte por WhatsApp"
    >
      Soporte
    </a>
  );
}
