'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { withLocale } from './content'
import { useLocale } from '@/components/TranslationProvider'

function getNavItems(locale: string) {
  return [
    { label: locale === 'es' ? 'Boletines' : 'Stories', href: '/briefs' },
    { label: locale === 'es' ? 'Eventos' : 'Events', href: '/#events' },
    { label: locale === 'es' ? 'Directorio' : 'Directory', href: '/#directory' },
    { label: locale === 'es' ? 'Enviar' : 'Submit', href: '/contribute' },
  ]
}

export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const locale = useLocale()
  const otherLocale = locale === 'en' ? 'es' : 'en'
  const localizedPath = pathname.startsWith(`/${locale}`)
    ? `/${otherLocale}${pathname.slice(locale.length + 1) || ''}`
    : `/${otherLocale}`
  const navItems = getNavItems(locale)

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-brand-dark/85 backdrop-blur-xl">
      <div className="container-wide flex items-center justify-between py-4">
        <Link href={`/${locale}`} className="group inline-flex items-baseline gap-1">
          <span className="font-display text-2xl font-black tracking-tighter text-white">
            city<span className="italic text-brand-neon">BEat</span>
          </span>
          <span className="hidden text-xs uppercase tracking-[0.3em] text-white/40 sm:inline">mag</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={withLocale(locale, item.href)}
              className="text-xs font-bold uppercase tracking-[0.22em] text-white/70 transition hover:text-brand-neon"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link href={localizedPath} className="text-xs font-bold uppercase tracking-[0.22em] text-white/60 hover:text-white">
            {otherLocale}
          </Link>
          <Link href={withLocale(locale, '/ads')} className="rounded-md bg-brand-neon px-4 py-2 text-sm font-black uppercase tracking-wider text-black transition hover:bg-cyan-300">
            {locale === 'es' ? 'Anunciar' : 'Advertise'}
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-md border border-white/15 px-3 py-2 text-sm font-bold uppercase tracking-wider text-white md:hidden"
          aria-expanded={open}
          aria-controls="mobile-navigation"
        >
          {locale === 'es' ? 'Menú' : 'Menu'}
        </button>
      </div>

      {open && (
        <nav id="mobile-navigation" className="border-t border-white/10 bg-brand-dark px-4 py-6 md:hidden">
          <div className="flex flex-col gap-5">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={withLocale(locale, item.href)}
                onClick={() => setOpen(false)}
                className="font-display text-3xl font-black text-white hover:text-brand-neon"
              >
                {item.label}
              </Link>
            ))}
            <Link href={localizedPath} className="text-sm font-bold uppercase tracking-[0.22em] text-brand-neon">
              {locale === 'es' ? 'Cambiar a ' : 'Switch to '}{otherLocale.toUpperCase()}
            </Link>
          </div>
        </nav>
      )}
    </header>
  )
}
