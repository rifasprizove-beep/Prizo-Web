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
        brand: {
          50: '#FFE5F0',
          100: '#FFC9DE',
          200: '#FF99BF',
          300: '#FF6AA0',
          400: '#FF3B82',
          500: '#E11D71', // rosa principal
          600: '#B0155A',
          700: '#800E42',
          800: '#4F0829',
          900: '#200311',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
