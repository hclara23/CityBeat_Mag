'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'
import { getUser } from '@citybeat/lib/firebase/auth-client'
import { EngagementBoard } from '@/components/citybeat/EngagementBoard'
import { SupportInbox } from '@/components/citybeat/SupportInbox'

export default function AdminLeads() {
  const router = useRouter()
  const locale = useLocale() as 'en' | 'es'
  const [ready, setReady] = useState(false)
  const [deals, setDeals] = useState<any[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    getUser().then(({ user }) => {
      if (!user) return router.push(withLocale(locale, '/login'))
      if (!user.is_editor && !user.can_manage_platform && !user.is_developer) {
        return router.push(withLocale(locale, '/'))
      }
      Promise.all([
        fetch('/api/deals', { cache: 'no-store' }).then((r) => { if(!r.ok) throw new Error('Deals could not be loaded.'); return r.json() }),
      ]).then(([d]) => {
        setDeals(d?.deals || [])
        setReady(true)
      }).catch((e)=>{setError(e.message);setReady(true)})
    }).catch(()=>{setError('Could not verify your session. Reload to try again.');setReady(true)})
  }, [router, locale])

  const removeDeal = async (id: string) => {
    if (!confirm('Remove this deal?')) return
    try {
      const response=await fetch(`/api/deals?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if(!response.ok) throw new Error('The deal could not be removed. It remains listed.')
      setDeals((x) => x.filter((d) => d.id !== id));setError('')
    } catch(e) {setError((e as Error).message)}
  }

  if (!ready) return null

  return (
    <CityBeatShell locale={locale}>
      <section className="container-wide max-w-4xl py-14">
        <Link href={withLocale(locale, '/admin')} className="text-sm text-brand-neon hover:underline">← Back to Dashboard</Link>
        <h1 className="mt-3 font-display text-4xl font-black tracking-tight text-white">Leads & deals</h1>
        {error&&<p role="alert" className="mt-4 rounded border border-red-400/30 p-3 text-red-200">{error} <button onClick={()=>window.location.reload()} className="underline">Reload</button></p>}

        {/* Warm leads — businesses that opened/clicked outreach emails. */}
        <div className="mt-8">
          <EngagementBoard />
        </div>

        <SupportInbox locale={locale} />

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
