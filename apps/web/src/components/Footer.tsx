"use client";

export function Footer() {
  return (
    <footer className="mt-10 py-8 border-t border-white/10 text-sm text-gray-300">
      <div className="site-container grid gap-4 md:grid-cols-3 items-center">
        <div className="font-semibold text-white">PRIZO</div>
        <nav className="flex flex-wrap gap-3">
          <a href="/" className="hover:underline">Inicio</a>
          <a href="/verify" className="hover:underline">Verificar</a>
          <a href="/terms" className="hover:underline">Términos</a>
        </nav>
        <div className="md:text-right opacity-70">© {new Date().getFullYear()} Prizo. Todos los derechos reservados.</div>
      </div>
    </footer>
  );
}
