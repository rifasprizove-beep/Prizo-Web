import type { Config } from 'tailwindcss'

export default {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Paleta "neon" (amarillo eléctrico) + superficies oscuras
        brand: {
          50: '#F7FFE0',
          100: '#EEFFC2',
          200: '#E3FF99',
          300: '#D9FF73',
          400: '#D3FF4D',
          500: '#D7FF00', // amarillo eléctrico principal
          600: '#B3D600',
          700: '#8FAA00',
          800: '#6A8000',
          900: '#465400',
        },
        surface: {
          900: '#0b0b0e',
          800: '#111114',
          700: '#151519',
        },
      },
      boxShadow: {
        glow: '0 0 0 2px rgba(215,255,0,0.3), 0 0 24px rgba(215,255,0,0.45)',
        glowSm: '0 0 0 1px rgba(215,255,0,0.25), 0 0 14px rgba(215,255,0,0.35)',
      },
    },
  },
  plugins: [],
} satisfies Config
