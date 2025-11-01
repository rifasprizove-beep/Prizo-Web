import './globals.css'
import type { Metadata } from 'next'
import { ReactQueryClientProvider } from '../lib/query'
import { Space_Grotesk } from 'next/font/google'

const grotesk = Space_Grotesk({ subsets: ['latin'], weight: ['400','600','700'] })

export const metadata: Metadata = {
  title: 'Prizo',
  description: 'Transparencia en sorteos',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={grotesk.className} suppressHydrationWarning>
        <div className="site-container py-4">
          <header className="h-16 flex items-center justify-between">
            <a href="/" className="text-2xl font-extrabold text-brand-500 title-neon">PRIZO</a>
            <nav className="flex items-center gap-3 text-sm">
              <a href="/" className="pill-outline">Home</a>
              <a href="/" className="pill-outline">Rifas</a>
              <a href="/verify" className="pill-outline">Verificar</a>
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
