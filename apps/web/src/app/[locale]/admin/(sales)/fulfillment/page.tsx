'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SiteHeader } from '@/components/citybeat/SiteHeader'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'
import { getUser } from '@citybeat/lib/firebase/auth-client'

// Work queue for the two paid products delivered BY HAND: Sponsored Stories
// (an editor writes the story from the brief) and Custom Quotes (whatever a
// manager approved). Their briefs used to land in collections nothing read —
// a customer could pay and complete their brief with no surface anywhere
// showing the work existed.

interface Brief {
  id: string
  kind: 'sponsored_story' | 'custom'
  sales_order_id: string | null
  contact_email: string | null
  status: string
  created_at: string | null
  // sponsored_story fields
  sponsor_name?: string
  story_goal?: string
  key_message?: string
  headline_idea?: string | null
  desired_publish_date?: string | null
  // custom fields
  customer_name?: string
  approved_description?: string | null
  approved_deliverable?: string
  goal?: string
  deadline?: string | null
}

const STATUS_STYLE: Record<string, string> = {
  pending_review: 'bg-amber-400/15 text-amber-300',
  in_review: 'bg-amber-400/15 text-amber-300',
  in_progress: 'bg-sky-400/15 text-sky-300',
  delivered: 'bg-emerald-400/15 text-emerald-300',
}

export default function FulfillmentQueuePage() {
  const router = useRouter()
  const locale = useLocale() as 'en' | 'es'
  const isEs = locale === 'es'
  const [briefs, setBriefs] = useState<Brief[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)

  const load = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/admin/fulfillment')
      if (res.status === 401 || res.status === 403) {
        setIsAuthorized(false)
        return
      }
      if (res.ok) {
        const data = await res.json()
        setBriefs(data.briefs || [])
        setIsAuthorized(true)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    getUser().then(({ user, error }) => {
      if (error || !user) {
        router.push(withLocale(locale, '/login'))
        return
      }
      load()
    })
  }, [router, locale, load])

  const mark = async (brief: Brief, action: 'in_progress' | 'delivered') => {
    const res = await fetch('/api/admin/fulfillment', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: brief.id, kind: brief.kind, action }),
    })
    if (res.ok) await load()
    else alert((await res.json().catch(() => ({})) as any).error || 'Update failed')
  }

  if (!isLoading && !isAuthorized) {
    return (
      <div className="min-h-screen bg-brand-dark text-white">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="text-white/70">Sales Desk access required.</p>
        </main>
      </div>
    )
  }

  const open = briefs.filter((b) => b.status !== 'delivered')

  return (
    <div className="min-h-screen bg-brand-dark text-white">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="mb-8">
          <Link href={withLocale(locale, '/admin/sales/me')} className="text-sm text-brand-neon hover:underline">
            ← {isEs ? 'Volver al Sales Desk' : 'Back to Sales Desk'}
          </Link>
          <h1 className="mt-3 font-display text-4xl font-black uppercase tracking-tight">
            {isEs ? 'Entregas manuales' : 'Fulfillment Queue'}
          </h1>
          <p className="mt-1 text-sm text-white/50">
            {isEs
              ? 'Historias patrocinadas y pedidos personalizados pagados — trabajo que un humano entrega.'
              : 'Paid Sponsored Stories and Custom Quotes — work a human delivers.'}
            {open.length > 0 && (
              <span className="ml-2 rounded bg-amber-400/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300">
                {open.length} {isEs ? 'abiertos' : 'open'}
              </span>
            )}
          </p>
        </div>

        {isLoading ? (
          <div className="py-10 text-white/50">Loading…</div>
        ) : briefs.length === 0 ? (
          <div className="citybeat-panel p-8 text-center text-white/50">
            {isEs ? 'No hay pedidos todavía.' : 'No briefs yet.'}
          </div>
        ) : (
          <div className="grid gap-5">
            {briefs.map((b) => {
              const status = b.status || 'pending_review'
              return (
                <div key={`${b.kind}:${b.id}`} className="citybeat-panel flex flex-col gap-3 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-bold">{b.sponsor_name || b.customer_name || '(unnamed)'}</h3>
                        <span className="rounded bg-brand-magenta/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-brand-magenta">
                          {b.kind === 'sponsored_story' ? (isEs ? 'Historia patrocinada' : 'Sponsored Story') : (isEs ? 'Pedido personalizado' : 'Custom Quote')}
                        </span>
                        <span className={`rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${STATUS_STYLE[status] || STATUS_STYLE.pending_review}`}>
                          {status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-white/60">
                        {b.kind === 'sponsored_story'
                          ? b.story_goal || b.key_message || ''
                          : b.approved_deliverable || b.approved_description || b.goal || ''}
                      </p>
                    </div>
                    <div className="text-right text-xs text-white/40">
                      {b.created_at && <p>{new Date(b.created_at).toLocaleDateString(isEs ? 'es-MX' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>}
                      {b.contact_email && <p className="mt-1">{b.contact_email}</p>}
                      {(b.desired_publish_date || b.deadline) && (
                        <p className="mt-1 text-amber-300">{isEs ? 'Fecha objetivo' : 'Target'}: {b.desired_publish_date || b.deadline}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
                    {status !== 'in_progress' && status !== 'delivered' && (
                      <button
                        onClick={() => mark(b, 'in_progress')}
                        className="rounded border border-sky-500/30 bg-sky-500/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-sky-300 transition hover:bg-sky-500 hover:text-white"
                      >
                        {isEs ? 'Tomar el trabajo' : 'Start work'}
                      </button>
                    )}
                    {status !== 'delivered' && (
                      <button
                        onClick={() => mark(b, 'delivered')}
                        className="rounded border border-emerald-500/30 bg-emerald-500/20 px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-300 transition hover:bg-emerald-500 hover:text-white"
                      >
                        {isEs ? 'Marcar entregado' : 'Mark delivered'}
                      </button>
                    )}
                    <span className="ml-auto font-mono text-[10px] text-white/30">
                      {b.sales_order_id ? `order ${b.sales_order_id}` : `id ${b.id}`}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
