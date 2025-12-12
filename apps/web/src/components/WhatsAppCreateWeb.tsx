"use client";

export function WhatsAppCreateWeb() {
  const phone = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  const base = `https://wa.me/${digits}`;
  const text = encodeURIComponent("Hola, quisiera crear mi propia web.");
  const href = `${base}?text=${text}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-20 left-4 sm:bottom-24 sm:left-5 z-40 inline-flex items-center gap-2 rounded-full bg-white text-black px-2.5 py-1.5 shadow-lg ring-1 ring-brand-500/20 hover:translate-y-[-1px] active:translate-y-[0] transition-transform opacity-80 hover:opacity-100"
      aria-label="Crea tu web (WhatsApp)"
    >
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#25D366] text-white">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-3.5 h-3.5"
          aria-hidden="true"
          shapeRendering="geometricPrecision"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.966-.273-.099-.472-.148-.67.149-.198.297-.767.966-.94 1.164-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.173.198-.297.298-.495.099-.198.05-.372-.025-.521-.074-.149-.669-1.612-.916-2.207-.242-.58-.487-.501-.67-.51-.173-.009-.372-.011-.571-.011-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.694.626.712.227 1.36.195 1.872.118.571-.085 1.758-.718 2.006-1.411.248-.694.248-1.29.173-1.411-.074-.124-.272-.198-.57-.347zM12.005 2.003c-5.514 0-9.997 4.483-9.997 9.997 0 1.761.46 3.411 1.268 4.839L2 22l5.33-1.389a9.948 9.948 0 0 0 4.675 1.193h.001c5.514 0 9.997-4.483 9.997-9.997 0-2.67-1.04-5.178-2.94-7.07A9.94 9.94 0 0 0 12.005 2.003zm0 18.2a8.16 8.16 0 0 1-4.166-1.152l-.3-.178-3.164.825.845-3.086-.195-.317a8.197 8.197 0 0 1-1.248-4.292c0-4.533 3.688-8.22 8.223-8.22 2.196 0 4.258.856 5.81 2.41a8.167 8.167 0 0 1 2.413 5.81c0 4.533-3.687 8.22-8.218 8.22z"/>
        </svg>
      </span>
      <span className="text-[11px] sm:text-xs font-semibold">Crea tu web</span>
    </a>
  );
}