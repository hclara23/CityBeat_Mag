'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { withLocale } from './content'
import { useLocale } from '@/components/TranslationProvider'
import { getUser, signOut } from '@citybeat/lib/firebase/auth-client'
import { NotificationInbox } from '@/components/NotificationInbox'

function getNavItems(locale: string) {
  return [
    { label: locale === 'es' ? 'Este finde' : 'This Weekend', href: '/this-weekend' },
    { label: locale === 'es' ? 'Boletines' : 'Stories', href: '/stories' },
    { label: locale === 'es' ? 'Eventos' : 'Events', href: '/events' },
    { label: locale === 'es' ? 'Directorio' : 'Directory', href: '/directory' },
    { label: locale === 'es' ? 'Enviar' : 'Submit', href: '/contribute' },
  ]
}

// Where each role's "Dashboard" button lands. Most-privileged match wins.
export function dashboardFor(profile: any): string {
  if (!profile) return '/account'
  if (profile.can_manage_platform || profile.is_developer) return '/developer'
  if (profile.is_editor) return '/admin'
  if (profile.is_sales || profile.sales_dashboard_enabled) return '/admin/sales/me'
  if (profile.is_writer) return '/creator'
  if (profile.is_advertiser) return '/dashboard'
  return '/account'
}

export function SiteHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [profile, setProfile] = useState<any | null>(null)
  const locale = useLocale()

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

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Always-visible EN|ES toggle — El Paso's audience is ~90% Spanish-speaking,
              so language switching must never be buried in a menu. */}
          <div className="flex items-center overflow-hidden rounded-full border border-white/25 text-[11px] font-black uppercase tracking-wider">
            <Link href={enPath} aria-label="English" className={`px-2.5 py-1 transition ${locale === 'en' ? 'bg-brand-neon text-black' : 'text-white/60 hover:text-white'}`}>
              EN
            </Link>
            <Link href={esPath} aria-label="Español" className={`px-2.5 py-1 transition ${locale === 'es' ? 'bg-brand-neon text-black' : 'text-white/60 hover:text-white'}`}>
              ES
            </Link>
          </div>

          {/* In-app notification bell (dormant until Novu is configured). */}
          {profile?.id && <NotificationInbox subscriberId={profile.id} />}

          <div className="hidden items-center gap-3 md:flex">
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
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-md border border-white/15 px-3 py-2 text-sm font-bold uppercase tracking-wider text-white md:hidden"
            aria-expanded={open}
            aria-controls="mobile-navigation"
          >
            {locale === 'es' ? 'Menú' : 'Menu'}
          </button>
        </div>
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
          </div>
        </nav>
      )}
    </header>
  )
}
