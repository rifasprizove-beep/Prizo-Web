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
        // Paleta "neon" magenta basada en #D70056 + superficies oscuras
        brand: {
          50: '#FFE6F0',
          100: '#FFC2D9',
          200: '#FF99BF',
          300: '#FF73A8',
          400: '#FF4D90',
          500: '#D70056', // magenta principal
          600: '#B30047',
          700: '#8F0039',
          800: '#6A002B',
          900: '#46001D',
        },
        surface: {
          900: '#0b0b0e',
          800: '#111114',
          700: '#151519',
        },
      },
      boxShadow: {
        glow: '0 0 0 2px rgba(215,0,86,0.35), 0 0 24px rgba(215,0,86,0.5)',
        glowSm: '0 0 0 1px rgba(215,0,86,0.3), 0 0 14px rgba(215,0,86,0.4)',
      },
    },
  },
  plugins: [],
} satisfies Config
