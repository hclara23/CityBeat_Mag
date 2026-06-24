'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SiteHeader } from '@/components/citybeat/SiteHeader'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'
import { getUser } from '@citybeat/lib/firebase/auth-client'

const developerLinks = [
  { href: '/admin/sales', label: 'Sales Agent', description: 'Automated outreach to unclaimed businesses — claim + Premium upsell funnel.' },
  { href: '/admin/banners', label: 'Ad Banner Manager', description: 'Create, edit, activate, and place sponsor banners across the site.' },
  { href: '/admin/payouts', label: 'Payout Settings', description: 'Set the % paid out to users per service and per-user overrides.' },
  { href: '/admin/finance', label: 'Finance & Analytics', description: 'All incoming and outgoing payments plus analytics.' },
  { href: '/admin/directory', label: 'Directory Manager', description: 'Add, edit, upgrade, verify, sponsor, or delete business listings.' },
]

export default function DeveloperDashboard() {
  const router = useRouter()
  const locale = useLocale() as 'en' | 'es'
  const [isDeveloper, setIsDeveloper] = useState(false)

  useEffect(() => {
    getUser().then(({ user, error }) => {
      if (error || !user) {
        router.push(withLocale(locale, '/login'))
        return
      }
      
      // Check for developer role via API profile
      fetch(`/api/profile?id=${user.id}`)
        .then(res => res.json())
        .then(data => {
          if (!data.profile?.is_developer && !user.is_developer) {
            router.push(withLocale(locale, '/'))
            return
          }
          setIsDeveloper(true)
        })
    })
  }, [router, locale])

  if (!isDeveloper) return null

  return (
    <div className="min-h-screen bg-brand-dark text-white">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-10">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-magenta">Godmode</p>
          <h1 className="font-display text-4xl font-black tracking-tight tracking-tight uppercase">Developer Control</h1>
          <p className="mt-1 text-white/50 text-sm">Advanced platform settings and automations.</p>
        </div>

        <section className="mb-10">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {developerLinks.map((item) => (
              <Link
                key={item.href}
                href={withLocale(locale, item.href)}
                className="group rounded-lg border border-white/10 bg-white/5 p-4 transition hover:border-brand-magenta/50 hover:bg-brand-magenta/10"
              >
                <p className="text-sm font-black uppercase tracking-wider text-white group-hover:text-brand-magenta">
                  {item.label}
                </p>
                <p className="mt-2 text-xs leading-5 text-white/45">{item.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
