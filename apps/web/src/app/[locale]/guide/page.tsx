'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SiteHeader } from '@/components/citybeat/SiteHeader'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'
import { RoleGuide, type GuideRoles } from '@/components/citybeat/RoleGuide'

// Role-aware user guide. Signed-out visitors see the public sections; each
// granted role unlocks its own section. Linked as the "User Guide" tab from
// every dashboard.
export default function GuidePage() {
  const locale = useLocale() as 'en' | 'es'
  const [roles, setRoles] = useState<GuideRoles>({
    isOwner: false,
    isWriter: false,
    isSales: false,
    isEditor: false,
    isDeveloper: false,
  })

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const p = d?.profile
        if (!p) return
        setRoles({
          isOwner: Boolean(p.is_advertiser),
          isWriter: Boolean(p.is_writer || p.is_editor || p.is_developer),
          isSales: Boolean(p.sales_dashboard_enabled || p.is_sales || p.is_editor || p.is_developer),
          isEditor: Boolean(p.is_editor || p.is_developer),
          isDeveloper: Boolean(p.is_developer),
        })
      })
      .catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-brand-dark text-white citybeat-app">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-10">
          <h1 className="font-display text-4xl font-black uppercase tracking-tight">User Guide</h1>
          <p className="mt-1 text-sm text-white/50">
            What you can do on CityBeat — sections appear based on your role.{' '}
            <Link href={withLocale(locale, '/dashboard')} className="text-brand-neon underline">
              Back to dashboard
            </Link>
          </p>
        </div>
        <RoleGuide roles={roles} locale={locale} />
      </main>
    </div>
  )
}
