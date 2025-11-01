import './globals.css'
import type { Metadata } from 'next'
import { ReactQueryClientProvider } from '../lib/query'
import { Space_Grotesk } from 'next/font/google'
import { TermsConsent } from '../components/TermsConsent'
import { Footer } from '../components/Footer'
import { WhatsAppHelp } from '../components/WhatsAppHelp'
import Image from 'next/image'

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
          <header className="relative h-16 flex items-center justify-center">
            <a href="/" aria-label="Inicio" className="absolute left-4 inline-flex items-center gap-2">
              <Image
                src="https://res.cloudinary.com/dzaokhfcw/image/upload/v1762024154/Prizo_l32y0t.png"
                alt="Prizo"
                width={120}
                height={36}
                className="h-7 w-auto"
                priority
              />
              <span className="text-xl font-extrabold text-brand-500 title-neon hidden sm:inline">PRIZO</span>
            </a>
            <nav className="flex items-center gap-3 text-sm">
              <a href="/" className="pill-outline">Home</a>
            </nav>
            <a
              href="/verify"
              aria-label="Verificar"
              className="absolute right-4 inline-flex items-center justify-center pill-outline px-3 py-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </a>
          </header>

          <ReactQueryClientProvider>
            {children}
          </ReactQueryClientProvider>
        </div>
        {/* Modal de TyC bloqueante al entrar */}
        <TermsConsent />
        <Footer />
        <WhatsAppHelp />
      </body>
    </html>
  )
}
