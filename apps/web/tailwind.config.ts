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
          ink: '#050505',
          neon: '#06B6D4',
          magenta: '#D946EF',
          gold: '#EAB308',
        },
      },
      // The design uses these half-steps (p-4.5, p-6.5, h-4.5, w-4.5) but Tailwind's
      // default scale has no .5 steps, so those classes emitted NO css — cards lost
      // padding and pin icons collapsed. Register them so the authored look applies.
      spacing: {
        '4.5': '1.125rem', // 18px
        '6.5': '1.625rem', // 26px
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
