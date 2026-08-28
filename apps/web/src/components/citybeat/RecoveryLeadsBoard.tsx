'use client'

import { useEffect, useState } from 'react'
import { useLocale } from '@/components/TranslationProvider'

// Abandoned-checkout follow-up board, shown on BOTH the editor hub and the
// Sales Desk. These businesses received a payment link and didn't pay — the
// warmest leads in the funnel, previously invisible to everyone (the audit
// found 8 of them nobody knew about). Shows who was sent the Founders offer,
// who clicked it, and who converted.

interface Lead {
  order_id: string
  business: string
  email: string
  product_id: string | null
  amount: number
  link_state: 'expired' | 'ready'
  created_at: string | null
  recovery_emailed_at: string | null
  promo_offered: string | null
  promo_offer_sent_at: string | null
  promo_link_clicked_at: string | null
  converted: boolean
}

const money = (cents: number) => `$${((cents || 0) / 100).toFixed(2)}`

export function RecoveryLeadsBoard() {
  const locale = useLocale() as 'en' | 'es'
  const isEs = locale === 'es'
  const [data, setData] = useState<{ leads: Lead[]; summary: any } | null>(null)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    fetch('/api/admin/recovery-leads', { cache: 'no-store' })
      .then((r) => {
        if (r.status === 401 || r.status === 403) {
          setDenied(true)
          return null
        }
        return r.ok ? r.json() : null
      })
      .then(setData)
      .catch(() => setData(null))
  }, [])

  if (denied || !data) return null
  const { leads, summary } = data
  if (!leads.length) return null

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(isEs ? 'es-MX' : 'en-US', { month: 'short', day: 'numeric' }) : '—'

  return (
    <section className="mb-10 rounded-xl border border-amber-400/25 bg-amber-400/[0.04] p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">
            {isEs ? 'Seguimiento: pagos abandonados' : 'Follow-up: abandoned checkouts'}
          </h2>
          <p className="mt-1 text-sm text-white/45">
            {isEs
              ? 'Negocios que recibieron un enlace de pago y no lo completaron — los leads más calientes que hay.'
              : 'Businesses that received a payment link and never completed it — the warmest leads there are.'}
          </p>
        </div>
        <div className="flex gap-5 text-right">
          {[
            [summary.total, isEs ? 'Leads' : 'Leads'],
            [summary.offered, isEs ? 'Oferta enviada' : 'Offer sent'],
            [summary.clicked, isEs ? 'Clic' : 'Clicked'],
            [summary.converted, isEs ? 'Convertidos' : 'Converted'],
          ].map(([n, label]) => (
            <div key={String(label)}>
              <p className="text-2xl font-black text-white">{String(n)}</p>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">{String(label)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03] text-[10px] font-black uppercase tracking-wider text-white/40">
              <th className="px-4 py-2">{isEs ? 'Negocio' : 'Business'}</th>
              <th className="px-4 py-2">{isEs ? 'Contacto' : 'Contact'}</th>
              <th className="px-4 py-2 text-right">{isEs ? 'Valor/mes' : 'Value/mo'}</th>
              <th className="px-4 py-2">{isEs ? 'Enlace' : 'Link'}</th>
              <th className="px-4 py-2">{isEs ? 'Seguimiento' : 'Follow-up'}</th>
              <th className="px-4 py-2">{isEs ? 'Creado' : 'Created'}</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.order_id} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-2.5 font-bold text-white/85">{l.business}</td>
                <td className="px-4 py-2.5 text-white/60">{l.email}</td>
                <td className="px-4 py-2.5 text-right font-bold text-white">{money(l.amount)}</td>
                <td className="px-4 py-2.5">
                  {l.converted ? (
                    <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                      {isEs ? 'PAGÓ' : 'PAID'}
                    </span>
                  ) : l.link_state === 'ready' ? (
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white/50">
                      {isEs ? 'Activo' : 'Live'}
                    </span>
                  ) : (
                    <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300">
                      {isEs ? 'Vencido' : 'Expired'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs text-white/55">
                  {l.promo_link_clicked_at
                    ? `${isEs ? 'Abrió la oferta' : 'Opened offer'} ${fmtDate(l.promo_link_clicked_at)}`
                    : l.promo_offer_sent_at
                      ? `${isEs ? 'Oferta Founders enviada' : 'Founders offer sent'} ${fmtDate(l.promo_offer_sent_at)}`
                      : l.recovery_emailed_at
                        ? `${isEs ? 'Recordatorio enviado' : 'Nudge sent'} ${fmtDate(l.recovery_emailed_at)}`
                        : isEs
                          ? 'Sin contactar'
                          : 'Not contacted'}
                </td>
                <td className="px-4 py-2.5 text-xs text-white/40">{fmtDate(l.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
