'use client'

import { useEffect, useState } from 'react'
import { useLocale } from '@/components/TranslationProvider'

// Abandoned-checkout follow-up board, shown on BOTH the editor hub and the
// Sales Desk. These businesses received a payment link and didn't pay — the
// warmest leads in the funnel, previously invisible to everyone (the audit
// found 8 of them nobody knew about). Shows who was sent the Founders offer,
// who clicked it, and who converted — plus a phone number when we have one so
// a human can reach out, and a Remove action to clear dead/junk leads.

interface Lead {
  order_id: string
  business: string
  email: string
  phone: string | null
  product_id: string | null
  amount: number
  billing_type: string | null
  billing_interval: string | null
  link_state: 'expired' | 'ready'
  created_at: string | null
  recovery_emailed_at: string | null
  promo_offered: string | null
  promo_offer_sent_at: string | null
  promo_link_clicked_at: string | null
  converted: boolean
}

interface Summary {
  total: number
  offered: number
  clicked: number
  converted: number
}

const money = (cents: number) => `$${((cents || 0) / 100).toFixed(2)}`

// Cadence suffix for the amount: subscriptions show /mo or /yr; one-time products
// show nothing (so a one-time total isn't misread as a monthly charge).
const cadence = (lead: Lead, isEs: boolean): string => {
  if (lead.billing_type !== 'subscription') return ''
  if (lead.billing_interval === 'year') return isEs ? '/año' : '/yr'
  if (lead.billing_interval === 'month') return isEs ? '/mes' : '/mo'
  return ''
}

// Digits-only tel: target so a click-to-call works regardless of formatting.
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

function computeSummary(leads: Lead[]): Summary {
  return {
    total: leads.length,
    offered: leads.filter((l) => l.promo_offer_sent_at).length,
    clicked: leads.filter((l) => l.promo_link_clicked_at).length,
    converted: leads.filter((l) => l.converted).length,
  }
}

export function RecoveryLeadsBoard() {
  const locale = useLocale() as 'en' | 'es'
  const isEs = locale === 'es'
  const [leads, setLeads] = useState<Lead[] | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [denied, setDenied] = useState(false)
  // order_id currently in the two-step "click Remove → Confirm" flow.
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/recovery-leads', { cache: 'no-store' })
      .then((r) => {
        if (r.status === 401 || r.status === 403) {
          setDenied(true)
          return null
        }
        return r.ok ? r.json() : null
      })
      .then((d) => {
        if (!d) return
        setLeads(d.leads || [])
        setSummary(d.summary || computeSummary(d.leads || []))
      })
      .catch(() => setLeads(null))
  }, [])

  // Localize the API's error codes rather than showing its English strings verbatim
  // (this product is bilingual and El Paso skews Spanish-first).
  const errorMessage = (code: string | undefined): string => {
    switch (code) {
      case 'order_paid':
        return isEs ? 'Ese pedido ya se pagó y no se puede quitar aquí.' : 'That order is paid and cannot be removed here.'
      case 'order_not_found':
        return isEs ? 'No se encontró el pedido.' : 'Order not found.'
      case 'order_id_required':
      case 'invalid_order_id':
        return isEs ? 'Pedido no válido.' : 'Invalid order.'
      default:
        return isEs ? 'No se pudo quitar. Inténtalo de nuevo.' : 'Could not remove. Please try again.'
    }
  }

  const remove = async (lead: Lead) => {
    setBusyId(lead.order_id)
    setError('')
    try {
      const res = await fetch(`/api/admin/recovery-leads?order_id=${encodeURIComponent(lead.order_id)}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(errorMessage(data.code))
      // The API dismisses every unpaid order for this email — drop them all locally
      // so an older sibling can't linger in the table.
      setLeads((prev) => {
        const next = (prev || []).filter((l) => l.email !== lead.email)
        setSummary(computeSummary(next))
        return next
      })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusyId(null)
      setConfirmingId(null)
    }
  }

  if (denied || !leads || !summary) return null
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

      {error && (
        <p className="mb-3 rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>
      )}

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03] text-[10px] font-black uppercase tracking-wider text-white/40">
              <th className="px-4 py-2">{isEs ? 'Negocio' : 'Business'}</th>
              <th className="px-4 py-2">{isEs ? 'Contacto' : 'Contact'}</th>
              <th className="px-4 py-2">{isEs ? 'Teléfono' : 'Phone'}</th>
              <th className="px-4 py-2 text-right">{isEs ? 'Valor' : 'Value'}</th>
              <th className="px-4 py-2">{isEs ? 'Enlace' : 'Link'}</th>
              <th className="px-4 py-2">{isEs ? 'Seguimiento' : 'Follow-up'}</th>
              <th className="px-4 py-2">{isEs ? 'Creado' : 'Created'}</th>
              <th className="px-4 py-2 text-right">{isEs ? 'Acción' : 'Action'}</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.order_id} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-2.5 font-bold text-white/85">{l.business}</td>
                <td className="px-4 py-2.5 text-white/60">{l.email}</td>
                <td className="px-4 py-2.5">
                  {l.phone ? (
                    <a href={telHref(l.phone)} className="font-medium text-brand-neon hover:underline">
                      {l.phone}
                    </a>
                  ) : (
                    <span className="text-white/25">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right font-bold text-white">
                  {money(l.amount)}
                  <span className="text-white/40">{cadence(l, isEs)}</span>
                </td>
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
                <td className="px-4 py-2.5 text-right">
                  {confirmingId === l.order_id ? (
                    <span className="inline-flex items-center gap-2">
                      <button
                        onClick={() => remove(l)}
                        disabled={busyId === l.order_id}
                        className="rounded bg-red-500/90 px-2 py-1 text-[11px] font-black uppercase tracking-wider text-white hover:bg-red-500 disabled:opacity-50"
                      >
                        {busyId === l.order_id ? (isEs ? 'Quitando…' : 'Removing…') : isEs ? 'Confirmar' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => setConfirmingId(null)}
                        disabled={busyId === l.order_id}
                        className="text-[11px] font-bold text-white/40 hover:text-white/70 disabled:opacity-50"
                      >
                        {isEs ? 'Cancelar' : 'Cancel'}
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setError('')
                        setConfirmingId(l.order_id)
                      }}
                      className="rounded border border-white/15 px-2 py-1 text-[11px] font-bold text-white/55 hover:border-red-400/40 hover:text-red-300"
                    >
                      {isEs ? 'Quitar' : 'Remove'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] text-white/30">
        {isEs
          ? 'Quitar oculta el lead del tablero (no se cobra ni se borra el registro).'
          : 'Remove hides the lead from the board (no charge; the record is kept).'}
      </p>
    </section>
  )
}
