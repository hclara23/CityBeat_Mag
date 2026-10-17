'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { withLocale } from './content'
import { useLocale } from '@/components/TranslationProvider'
import { getUser, signOut } from '@citybeat/lib/firebase/auth-client'
import { FirstPartyInbox } from '@/components/FirstPartyInbox'
import { dashboardPathFor } from '@citybeat/lib/roles'

function getNavItems(locale: string) {
  return [
    { label: locale === 'es' ? 'Boletines' : 'Stories', href: '/stories' },
    { label: locale === 'es' ? 'Deportes' : 'Sports', href: '/sports' },
    { label: locale === 'es' ? 'Eventos' : 'Events', href: '/events' },
    { label: locale === 'es' ? 'Empleos' : 'Jobs', href: '/jobs' },
    { label: locale === 'es' ? 'Directorio' : 'Directory', href: '/directory' },
  ]
}

// Where each role's "Dashboard" button lands. Most-privileged match wins.
export function dashboardFor(profile: any): string {
  return dashboardPathFor(profile)
}

export function SiteHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [profile, setProfile] = useState<any | null>(null)
  const locale = useLocale()
  const toggleRef = useRef<HTMLButtonElement>(null)
  const mobileNavRef = useRef<HTMLElement>(null)

  // Expose editorial navigation on ordinary laptops while retaining the
  // compact account menu until the full action rail fits at 2xl.
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1536px)')
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false) }
    desktop.addEventListener('change', closeOnDesktop)
    return () => desktop.removeEventListener('change', closeOnDesktop)
  }, [])

  // Detect the signed-in user so we can surface a role-appropriate Dashboard link.
  useEffect(() => {
    let active = true
    getUser().then(({ user }) => {
      if (active) setProfile(user ?? null)
    })
    return () => {
      active = false
    }
  }, [pathname])

  // Mobile-menu keyboard behavior (WCAG 2.1.1 / 2.4.3): move focus into the panel
  // on open, trap Tab within it, close on Escape, and restore focus to the toggle
  // on close. Also lock background scroll while the overlay is open.
  useEffect(() => {
    if (!open) return
    const panel = mobileNavRef.current
    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      )
    focusables()[0]?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        toggleRef.current?.focus()
        return
      }
      if (e.key === 'Tab') {
        const items = focusables()
        if (items.length === 0) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  const dashboardHref = profile ? dashboardFor(profile) : null

  const handleSignOut = async () => {
    setProfile(null)
    setOpen(false)
    await signOut()
    router.push(withLocale(locale, '/'))
    router.refresh()
  }
  const otherLocale = locale === 'en' ? 'es' : 'en'
  // Path within the current locale (so each toggle segment can deep-link to the
  // same page in the other language).
  const basePath = pathname.startsWith(`/${locale}`) ? pathname.slice(locale.length + 1) || '' : ''
  const enPath = `/en${basePath}`
  const esPath = `/es${basePath}`
  const localizedPath = `/${otherLocale}${basePath}`
  const navItems = getNavItems(locale)

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#07111d]/95 shadow-[0_8px_30px_rgba(0,0,0,.18)] backdrop-blur-xl">
      <div className="mx-auto flex min-h-[68px] w-full max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 2xl:gap-8">
        <Link href={`/${locale}`} className="group inline-flex shrink-0 items-baseline gap-1 whitespace-nowrap" aria-label="CityBeat Magazine home">
          <span className="font-display text-2xl font-black tracking-[-0.06em] text-white sm:text-3xl">
            city<span className="text-brand-neon">BEat</span>
          </span>
          <span className="hidden text-[10px] font-bold uppercase tracking-[0.35em] text-white/55 sm:inline">mag</span>
        </Link>

        <nav aria-label={locale === 'es' ? 'Navegación principal' : 'Main navigation'} className="hidden shrink-0 items-center gap-7 whitespace-nowrap xl:flex">
          {navItems.map((item) => {
            const active = basePath === item.href || basePath.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={withLocale(locale, item.href)}
                aria-current={active ? 'page' : undefined}
                className={`border-b-2 py-6 text-xs font-bold tracking-[0.04em] transition ${
                  active ? 'border-brand-neon text-brand-neon' : 'border-transparent text-white/78 hover:border-white/25 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2 whitespace-nowrap sm:gap-3">
          {/* Always-visible EN|ES toggle — El Paso's audience is ~90% Spanish-speaking,
              so language switching must never be buried in a menu. */}
          <div className="flex items-center overflow-hidden rounded-full border border-white/25 text-[11px] font-black uppercase tracking-wider">
            <Link href={enPath} aria-label="English" aria-current={locale === 'en' ? 'true' : undefined} className={`px-2.5 py-1 transition ${locale === 'en' ? 'bg-brand-neon text-black' : 'text-white/60 hover:text-white'}`}>
              EN
            </Link>
            <Link href={esPath} aria-label="Español" aria-current={locale === 'es' ? 'true' : undefined} className={`px-2.5 py-1 transition ${locale === 'es' ? 'bg-brand-neon text-black' : 'text-white/60 hover:text-white'}`}>
              ES
            </Link>
          </div>

          {/* First-party in-app notification bell — works without any external
              provider; email/Novu are delivery channels on the same records. */}
          {profile?.id && <FirstPartyInbox />}

          <div className="hidden items-center gap-4 2xl:flex">
            {dashboardHref ? (
              <>
                <Link
                  href={withLocale(locale, dashboardHref)}
                  className="rounded-md border border-brand-neon px-4 py-2 text-sm font-black uppercase tracking-wider text-brand-neon transition hover:bg-brand-neon hover:text-black"
                >
                  {locale === 'es' ? 'Panel' : 'Dashboard'}
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-xs font-bold uppercase tracking-[0.22em] text-white/70 hover:text-white transition"
                >
                  {locale === 'es' ? 'Cerrar Sesión' : 'Sign Out'}
                </button>
              </>
            ) : (
              <>
                <Link href={withLocale(locale, '/login')} className="text-xs font-bold uppercase tracking-[0.22em] text-white/70 hover:text-white transition">
                  {locale === 'es' ? 'Iniciar Sesión' : 'Sign In'}
                </Link>
                <Link href={withLocale(locale, '/signup')} className="rounded-md border border-brand-neon px-4 py-2 text-sm font-black uppercase tracking-wider text-brand-neon transition hover:bg-brand-neon hover:text-black">
                  {locale === 'es' ? 'Crear Cuenta' : 'Register'}
                </Link>
              </>
            )}
            <Link href={withLocale(locale, '/ads')} className="rounded-md bg-brand-neon px-4 py-2 text-sm font-black uppercase tracking-wider text-black transition hover:bg-cyan-300">
              {locale === 'es' ? 'Anunciar' : 'Advertise'}
            </Link>
          </div>

          <button
            ref={toggleRef}
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-white 2xl:hidden"
            aria-expanded={open}
            aria-controls="mobile-navigation"
            aria-label={open ? (locale === 'es' ? 'Cerrar menú' : 'Close menu') : (locale === 'es' ? 'Abrir menú' : 'Open menu')}
          >
            <span className="sr-only">{locale === 'es' ? 'Menú' : 'Menu'}</span>
            <span aria-hidden="true" className="text-xl leading-none">{open ? '×' : '☰'}</span>
          </button>
        </div>
      </div>

      {open && (
        <nav ref={mobileNavRef} id="mobile-navigation" aria-label={locale === 'es' ? 'Navegación móvil' : 'Mobile navigation'} className="max-h-[calc(100dvh-4.25rem)] overflow-y-auto border-t border-white/10 bg-[#07111d] px-4 py-6 2xl:hidden">
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
            {dashboardHref ? (
              <>
                <Link
                  href={withLocale(locale, dashboardHref)}
                  onClick={() => setOpen(false)}
                  className="font-display text-3xl font-black text-brand-neon hover:text-cyan-300"
                >
                  {locale === 'es' ? 'Panel' : 'Dashboard'}
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-left font-display text-3xl font-black text-white/70 hover:text-white"
                >
                  {locale === 'es' ? 'Cerrar Sesión' : 'Sign Out'}
                </button>
              </>
            ) : (
              <>
                <Link
                  href={withLocale(locale, '/login')}
                  onClick={() => setOpen(false)}
                  className="font-display text-3xl font-black text-white/70 hover:text-white"
                >
                  {locale === 'es' ? 'Iniciar Sesión' : 'Sign In'}
                </Link>
                <Link
                  href={withLocale(locale, '/signup')}
                  onClick={() => setOpen(false)}
                  className="font-display text-3xl font-black text-brand-neon hover:text-cyan-300"
                >
                  {locale === 'es' ? 'Crear Cuenta' : 'Register'}
                </Link>
              </>
            )}
            <Link href={withLocale(locale, '/ads')} onClick={() => setOpen(false)} className="font-display text-3xl font-black text-brand-neon hover:text-cyan-300">
              {locale === 'es' ? 'Anunciar' : 'Advertise'}
            </Link>
          </div>
        </nav>
      )}
    </header>
  )
}
