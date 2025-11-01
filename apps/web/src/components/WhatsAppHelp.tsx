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
      className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-[#25D366] text-white shadow-lg shadow-black/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
      aria-label="Chatear con soporte por WhatsApp"
    >
      {/* Ícono de WhatsApp */}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="currentColor" className="w-7 h-7">
        <path d="M19.11 17.26c-.31-.15-1.81-.89-2.09-.99-.28-.1-.48-.15-.68.15-.2.31-.78.99-.96 1.19-.18.2-.36.22-.67.08-.31-.15-1.31-.48-2.5-1.52-.92-.82-1.54-1.83-1.72-2.14-.18-.31-.02-.48.13-.63.13-.13.31-.33.46-.5.15-.17.2-.28.31-.48.1-.2.05-.37-.03-.52-.08-.15-.68-1.64-.93-2.24-.24-.58-.49-.5-.68-.5-.18 0-.37-.02-.57-.02s-.52.07-.79.37c-.27.31-1.04 1.02-1.04 2.49 0 1.47 1.07 2.9 1.21 3.1.15.2 2.12 3.23 5.13 4.53.72.31 1.28.5 1.71.64.72.23 1.37.2 1.89.12.58-.09 1.81-.74 2.07-1.45.26-.71.26-1.31.18-1.45-.07-.15-.27-.23-.58-.38z"/>
        <path d="M27.27 4.73A13.4 13.4 0 0016 1.33C8.85 1.33 3.04 7.14 3.04 14.29c0 2.33.62 4.6 1.81 6.6L3 30.67l9.99-1.81a13.18 13.18 0 006.99 2c7.15 0 12.96-5.81 12.96-12.96.01-3.46-1.34-6.73-3.67-9.17zM16 28.18c-2.16 0-4.28-.58-6.14-1.68l-.44-.26-5.92 1.07 1.12-5.79-.28-.47a12.05 12.05 0 01-1.78-6.77C2.56 8.53 8.12 2.96 15 2.96c3.52 0 6.83 1.37 9.32 3.86a13.06 13.06 0 013.83 9.32c0 6.88-5.56 12.04-12.15 12.04z"/>
      </svg>
      <span className="sr-only">Soporte por WhatsApp</span>
    </a>
  );
}
