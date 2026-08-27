'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'
import { getUser } from '@citybeat/lib/firebase/auth-client'
import { EngagementBoard } from '@/components/citybeat/EngagementBoard'

export default function AdminLeads() {
  const router = useRouter()
  const locale = useLocale() as 'en' | 'es'
  const [ready, setReady] = useState(false)
  const [leads, setLeads] = useState<any[]>([])
  const [deals, setDeals] = useState<any[]>([])

  useEffect(() => {
    getUser().then(({ user }) => {
      if (!user) return router.push(withLocale(locale, '/login'))
      if (!user.is_editor && !user.can_manage_platform && !user.is_developer) {
        return router.push(withLocale(locale, '/'))
      }
      Promise.all([
        fetch('/api/admin/leads', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { leads: [] })).catch(() => ({ leads: [] })),
        fetch('/api/deals', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { deals: [] })).catch(() => ({ deals: [] })),
      ]).then(([l, d]) => {
        setLeads(l?.leads || [])
        setDeals(d?.deals || [])
        setReady(true)
      })
    })
  }, [router, locale])

  const removeDeal = async (id: string) => {
    if (!confirm('Remove this deal?')) return
    await fetch(`/api/deals?id=${id}`, { method: 'DELETE' }).catch(() => {})
    setDeals((x) => x.filter((d) => d.id !== id))
  }

  if (!ready) return null

  return (
    <CityBeatShell locale={locale}>
      <section className="container-wide max-w-4xl py-14">
        <Link href={withLocale(locale, '/admin')} className="text-sm text-brand-neon hover:underline">← Back to Dashboard</Link>
        <h1 className="mt-3 font-display text-4xl font-black tracking-tight text-white">Leads & deals</h1>

        {/* Warm leads — businesses that opened/clicked outreach emails. */}
        <div className="mt-8">
          <EngagementBoard />
        </div>

        {/* Captured leads */}
        <h2 className="mt-10 mb-3 text-lg font-bold text-white">Quote requests <span className="text-white/40">({leads.length})</span></h2>
        {leads.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/5 px-5 py-6 text-sm text-white/45">No leads captured yet.</p>
        ) : (
          <div className="grid gap-2">
            {leads.map((l) => (
              <div key={l.id} className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-white">{l.name} <span className="font-normal text-white/50">· {l.contact}</span></p>
                  <span className="text-xs text-white/40">{l.created_at ? new Date(l.created_at).toLocaleString() : ''}</span>
                </div>
                {l.business_name && (
                  <p className="text-xs text-brand-neon">
                    {l.listing_id ? (
                      <Link href={withLocale(locale, `/directory/${l.listing_id}`)} className="hover:underline">{l.business_name} →</Link>
                    ) : l.business_name}
                  </p>
                )}
                {l.message && <p className="mt-1 text-sm text-white/60">{l.message}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Deals moderation */}
        <h2 className="mt-12 mb-3 text-lg font-bold text-white">Active deals <span className="text-white/40">({deals.length})</span></h2>
        {deals.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/5 px-5 py-6 text-sm text-white/45">No active deals.</p>
        ) : (
          <div className="grid gap-2">
            {deals.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-bold text-white">{d.title}</p>
                  <p className="truncate text-xs text-white/45">{d.business_name}{d.code ? ` · ${d.code}` : ''}</p>
                </div>
                <button onClick={() => removeDeal(d.id)} className="ml-3 shrink-0 text-sm text-red-400 hover:underline">Remove</button>
              </div>
            ))}
          </div>
        )}
      </section>
    </CityBeatShell>
  )
}
