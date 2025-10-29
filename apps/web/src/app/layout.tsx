import './globals.css'
import type { Metadata } from 'next'
import { ReactQueryClientProvider } from '../lib/query'

export const metadata: Metadata = {
  title: 'Prizo',
  description: 'Transparencia en sorteos',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <div className="site-container py-4">
          <header className="h-14 flex items-center justify-between">
            <a href="/" className="font-bold text-brand-600">PRIZO</a>
            <nav className="flex items-center gap-3 text-sm">
              <a href="/" className="hover:underline">Rifas</a>
              <a href="/verify" className="hover:underline">Verificar</a>
            </nav>
          </header>

          <ReactQueryClientProvider>
            {children}
          </ReactQueryClientProvider>
        </div>
      </body>
    </html>
  )
}
