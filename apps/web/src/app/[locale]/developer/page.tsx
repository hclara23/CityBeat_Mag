'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SiteHeader } from '@/components/citybeat/SiteHeader'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'
import { getUser } from '@citybeat/lib/firebase/auth-client'
import { hasDeveloperAccess } from '@citybeat/lib/roles'

const developerLinks = [
  { href: '/admin', label: 'Admin Control', description: 'Review queues: claims, briefs, events, leads, directory, and site performance.' },
  { href: '/admin/sales', label: 'Sales Agent', description: 'Automated outreach to unclaimed businesses — claim + Premium upsell funnel.' },
  { href: '/admin/banners', label: 'Ad Banner Manager', description: 'Create, edit, activate, and place sponsor banners across the site.' },
  { href: '/admin/payouts', label: 'Payout Settings', description: 'Set the % paid out to users per service and per-user overrides.' },
  { href: '/admin/finance', label: 'Finance & Analytics', description: 'All incoming and outgoing payments plus analytics.' },
  { href: '/admin/directory', label: 'Directory Manager', description: 'Add, edit, upgrade, verify, sponsor, or delete business listings.' },
]

// Every module any other role can use — godmode is a superset, so link them all
// from one place. Access is already granted by the role helpers (developer ⊇
// admin ⊇ editor/writer/sales, + advertiser), these are just the entry points.
const teamLinks = [
  { href: '/creator', label: 'Creator Studio', description: 'Write, edit, and publish stories — a developer can publish directly.' },
  { href: '/admin/review', label: 'Review Queue', description: 'Approve or publish articles submitted for review.' },
  { href: '/admin/sales/new', label: 'New Sale', description: 'Generate a payment link or QR to charge a business on the spot.' },
  { href: '/admin/sales/me', label: 'Sales Dashboard', description: 'Rep commissions, leads, and the sales leaderboard.' },
  { href: '/dashboard', label: 'Advertiser Dashboard', description: 'Campaigns, your listings, deals, and customer leads.' },
  { href: '/directory', label: 'Directory', description: 'Browse the public directory and manage any listing inline.' },
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
          if (!hasDeveloperAccess(data.profile) && !user.is_developer && !user.can_manage_platform) {
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
          <a href={withLocale(locale, '/guide')} className="mt-1 inline-block text-xs font-bold text-brand-neon underline">
            📖 User Guide
          </a>
        </div>

        <section className="mb-10">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-brand-magenta/80">Platform &amp; automations</p>
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

        <section className="mb-10">
          <p className="mb-1 text-xs font-black uppercase tracking-[0.24em] text-brand-neon/80">Act as any role</p>
          <p className="mb-3 text-xs text-white/40">Godmode can do everything every other role can — publish stories, close sales, run an advertiser account.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {teamLinks.map((item) => (
              <Link
                key={item.href}
                href={withLocale(locale, item.href)}
                className="group rounded-lg border border-white/10 bg-white/5 p-4 transition hover:border-brand-neon/50 hover:bg-brand-neon/10"
              >
                <p className="text-sm font-black uppercase tracking-wider text-white group-hover:text-brand-neon">
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
