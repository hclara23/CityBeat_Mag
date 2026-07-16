'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale } from '@/components/TranslationProvider'

// Always-visible EN|ES pill. Each segment deep-links to the same page in that
// language. Reused wherever a nav doesn't already carry the toggle (e.g. the
// dashboard's @citybeat/ui Navigation).
export function LocaleToggle({ className = '' }: { className?: string }) {
  const pathname = usePathname() || '/'
  const locale = useLocale()
  const basePath = pathname.startsWith(`/${locale}`) ? pathname.slice(locale.length + 1) || '' : ''
  const enPath = `/en${basePath}`
  const esPath = `/es${basePath}`
  return (
    <div className={`flex items-center overflow-hidden rounded-full border border-white/25 text-[11px] font-black uppercase tracking-wider ${className}`}>
      <Link href={enPath} aria-label="English" className={`px-2.5 py-1 transition ${locale === 'en' ? 'bg-brand-neon text-black' : 'text-white/60 hover:text-white'}`}>
        EN
      </Link>
      <Link href={esPath} aria-label="Español" className={`px-2.5 py-1 transition ${locale === 'es' ? 'bg-brand-neon text-black' : 'text-white/60 hover:text-white'}`}>
        ES
      </Link>
    </div>
  )
}
