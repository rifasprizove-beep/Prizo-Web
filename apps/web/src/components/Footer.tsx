"use client";
import { useTheme } from "../lib/theme";

export function Footer() {
  const { theme, toggle } = useTheme();
  const igRaw = process.env.NEXT_PUBLIC_INSTAGRAM_URL || '';
  // Sanitiza por si alguien dejó comillas en .env ("https://...")
  const ig = igRaw.replace(/^['"]|['"]$/g, '');
  return (
    <footer className="mt-10 py-8 border-t border-white/10 text-sm text-[var(--text)]">
      <div className="site-container grid gap-4 md:grid-cols-3 items-center">
        <div className="font-semibold">PRIZO</div>
        <nav className="flex flex-wrap gap-3">
          <a href="/" className="hover:underline">Inicio</a>
          <a href="/verify" className="hover:underline">Verificar</a>
          <a href="/terms" className="hover:underline">Términos</a>
        </nav>
        <div className="md:text-right opacity-80 flex md:justify-end items-center gap-3">
          {/* Toggle de tema */}
          <button
            type="button"
            onClick={toggle}
            disabled
            aria-disabled="true"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-white/10 opacity-50 cursor-not-allowed"
            aria-label={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
            title={`Próximamente: cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
          >
            {theme === 'dark' ? (
              // Icono sol
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.5-7.5-1.5 1.5M6 18l-1.5 1.5M18 18l-1.5-1.5M6 6 4.5 4.5" />
              </svg>
            ) : (
              // Icono luna
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
            )}
            <span className="hidden sm:inline">{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
            <span className="text-xs opacity-70">(Pronto)</span>
          </button>
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
