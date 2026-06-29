import type { Config } from 'tailwindcss'
import forms from '@tailwindcss/forms'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#06B6D4',
        secondary: '#1A1A1A',
        accent: '#D946EF',
        brand: {
          dark: '#0A0A0A',
          charcoal: '#1A1A1A',
          neon: '#06B6D4',
          magenta: '#D946EF',
          gold: '#EAB308',
        },
      },
      fontFamily: {
        // var(--font-space-grotesk) is the real font loaded by next/font in the
        // root layout; the names after it are graceful fallbacks while it swaps.
        sans: ['var(--font-space-grotesk)', '"Space Grotesk"', 'system-ui', 'sans-serif'],
        display: ['var(--font-space-grotesk)', '"Space Grotesk"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [forms],
}
export default config
