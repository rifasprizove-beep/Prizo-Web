"use client";

export function Footer() {
  const igRaw = process.env.NEXT_PUBLIC_INSTAGRAM_URL || '';
  // Sanitiza por si alguien dejó comillas en .env ("https://...")
  const ig = igRaw.replace(/^['"]|['"]$/g, '');
  return (
    <footer className="mt-10 py-8 border-t border-white/10 text-sm text-[var(--text)]">
      <div className="site-container grid gap-4 md:grid-cols-2 items-center">
        <div className="font-semibold">PRIZO</div>
        <div className="md:text-right opacity-80 flex md:justify-end items-center gap-3">
          <a href="/terms" className="hover:underline">Términos y condiciones</a>
          {/* Instagram */}
          {ig && (
            <a
              href={ig}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 hover:text-white"
              aria-label="Ir a nuestro Instagram"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M7 2C4.2 2 2 4.2 2 7v10c0 2.8 2.2 5 5 5h10c2.8 0 5-2.2 5-5V7c0-2.8-2.2-5-5-5H7zm0 2h10c1.7 0 3 1.3 3 3v10c0 1.7-1.3 3-3 3H7c-1.7 0-3-1.3-3-3V7c0-1.7 1.3-3 3-3zm5 3.5A5.5 5.5 0 106 13a5.5 5.5 0 006-5.5zm0 2A3.5 3.5 0 118.5 13 3.5 3.5 0 0112 9.5zM18 6.8a1.2 1.2 0 11-2.4 0 1.2 1.2 0 012.4 0z"/>
              </svg>
              <span className="hidden sm:inline">Instagram</span>
            </a>
          )}
          <span>© {new Date().getFullYear()} Prizo. Todos los derechos reservados.</span>
        </div>
      </div>
    </footer>
  );
}
