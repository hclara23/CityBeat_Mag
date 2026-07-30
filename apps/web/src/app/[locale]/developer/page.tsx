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
  { href: '/admin', label: 'Admin Control', description: 'Editorial review, performance, and the complete editor workspace.' },
  { href: '/admin/finance', label: 'Finance & Analytics', description: 'Incoming payments, outgoing payouts, orders, and platform analytics.' },
  { href: '/admin/payouts', label: 'Payout Settings', description: 'Global commissions, service rates, and per-user overrides.' },
  { href: '/admin/banners', label: 'Ad Banner Manager', description: 'Create, edit, activate, and place sponsor inventory across CityBeat.' },
  { href: '/admin/directory', label: 'Directory Manager', description: 'Add, edit, upgrade, verify, sponsor, publish, or remove listings.' },
  { href: '/admin/claims', label: 'Claims Queue', description: 'Review directory ownership claims and verification status.' },
  { href: '/admin/events', label: 'Events Manager', description: 'Review, moderate, publish, or remove submitted and sourced events.' },
  { href: '/admin/leads', label: 'Leads & Deals', description: 'Inspect quote requests, customer activity, and active business deals.' },
  { href: '/admin/sales', label: 'Sales Agent', description: 'Run automated outreach to unclaimed businesses and Premium prospects.' },
]

// Godmode is cumulative, so every role workspace remains available from this
// one command center in addition to the developer-only controls above.
const teamLinks = [
  { href: '/creator', label: 'Creator Studio', description: 'Write, edit, translate, and publish stories directly.' },
  { href: '/admin', label: 'Review Queue', description: 'Approve, reject, translate, or publish submitted articles.' },
  { href: '/admin/sales/me', label: 'Sales Desk', description: 'Work leads, generate any checkout, and track fulfillment.' },
  { href: '/dashboard', label: 'Advertiser Dashboard', description: 'Campaigns, owned listings, deals, and customer leads.' },
  { href: '/ads/campaigns', label: 'Ad Campaigns', description: 'Inspect advertising orders and campaign fulfillment.' },
  { href: '/account/payments', label: 'Bank & Payouts', description: 'Manage the connected payout account and transfer readiness.' },
  { href: '/directory', label: 'Directory', description: 'Browse the public directory and manage any listing inline.' },
  { href: '/jobs', label: 'Job Board', description: 'Inspect active customer job postings on the public board.' },
  { href: '/events', label: 'Public Events', description: 'Inspect the published events experience as a visitor.' },
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

      if (!hasDeveloperAccess(user)) {
        router.push(withLocale(locale, '/'))
        return
      }
      setIsDeveloper(true)
    })
  }, [router, locale])

  if (!isDeveloper) return null

  return (
    <div className="min-h-screen bg-brand-dark text-white">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="border border-brand-magenta/60 bg-brand-magenta/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-brand-magenta">
                Godmode active
              </span>
              <span className="border border-brand-neon/50 bg-brand-neon/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-brand-neon">
                Full platform access
              </span>
            </div>
            <h1 className="font-display text-4xl font-black uppercase tracking-tight">Developer Control</h1>
            <p className="mt-1 max-w-2xl text-sm text-white/50">
              Every CityBeat workspace, financial control, sales tool, and customer-facing view from one command center.
            </p>
            <a href={withLocale(locale, '/guide')} className="mt-2 inline-block text-xs font-bold text-brand-neon underline">
              User Guide
            </a>
          </div>
          <Link
            href={withLocale(locale, '/admin/sales/new')}
            className="inline-flex min-h-12 items-center justify-center bg-brand-neon px-6 py-3 text-sm font-black uppercase tracking-[0.16em] text-black transition hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-dark"
          >
            {locale === 'es' ? '+ Nueva venta' : '+ New sale'}
          </Link>
        </div>

        <section className="mb-12">
          <div className="mb-3 flex items-end justify-between gap-4 border-b border-brand-magenta/25 pb-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-magenta">Platform command</p>
              <p className="mt-1 text-xs text-white/40">Developer-only administration, money, moderation, and automation modules.</p>
            </div>
            <span className="font-mono text-xs text-white/30">{developerLinks.length} modules</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {developerLinks.map((item) => (
              <Link
                key={item.href}
                href={withLocale(locale, item.href)}
                className="group min-h-32 border border-white/10 bg-white/[0.035] p-5 transition hover:-translate-y-0.5 hover:border-brand-magenta/60 hover:bg-brand-magenta/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-magenta"
              >
                <p className="text-sm font-black uppercase tracking-[0.08em] text-white group-hover:text-brand-magenta">
                  {item.label}
                </p>
                <p className="mt-2 text-xs leading-5 text-white/45">{item.description}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <div className="mb-3 flex items-end justify-between gap-4 border-b border-brand-neon/25 pb-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-neon">All-role workspaces</p>
              <p className="mt-1 text-xs text-white/40">Publish stories, close sales, fulfill campaigns, manage listings, and inspect public products.</p>
            </div>
            <span className="font-mono text-xs text-white/30">{teamLinks.length} modules</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {teamLinks.map((item) => (
              <Link
                key={item.href}
                href={withLocale(locale, item.href)}
                className="group min-h-32 border border-white/10 bg-white/[0.035] p-5 transition hover:-translate-y-0.5 hover:border-brand-neon/60 hover:bg-brand-neon/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-neon"
              >
                <p className="text-sm font-black uppercase tracking-[0.08em] text-white group-hover:text-brand-neon">
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
