'use client'

import { Fragment, useEffect, useState } from 'react'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'

interface Row {
  id: string
  collection: string
  listing_id: string | null
  business: string
  email: string | null
  opens: number
  clicks: number
  status: string
  last_activity: string | null
  heat: 'verified' | 'hot' | 'warm'
  verified?: boolean
}

type Hidden = { scanner: number; unconfirmed: number; bad_contact: number; unsubscribed: number; dismissed: number; duplicate: number }
type Summary = { engaged: number; verified?: number; hot: number; warm: number; hidden?: Hidden }

// Warm-leads board for reps: businesses where a PERSON engaged with outreach,
// strongest evidence first (lib/lead-board.ts). VERIFIED = clicked through and
// used the page; HOT = clicked (not a scanner); WARM = came back to the email an
// hour or more later. Everything else is hidden and counted in the header.
type Followup = { loading?: boolean; email_subject?: string; email_body?: string; call_script?: string }

export function EngagementBoard() {
  const locale = useLocale() as 'en' | 'es'
  const [rows, setRows] = useState<Row[] | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [dismissing, setDismissing] = useState('')
  const [followups, setFollowups] = useState<Record<string, Followup>>({})
  const [copied, setCopied] = useState('')

  useEffect(() => {
    fetch('/api/admin/outreach-engagement')
      .then((r) => (r.ok ? r.json() : { rows: [], summary: null }))
      .then((d) => {
        setRows(d.rows || [])
        setSummary(d.summary || null)
      })
      .catch(() => setRows([]))
  }, [])

  // "Not real": hides the lead from the board (reversible server-side). It does
  // not unsubscribe or stop the sequence — that is the recipient's call, not ours.
  const dismiss = async (r: Row) => {
    setDismissing(r.id)
    const res = await fetch('/api/admin/outreach-engagement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id, collection: r.collection, action: 'dismiss' }),
    }).catch(() => null)
    setDismissing('')
    if (res?.ok) {
      setRows((cur) => (cur || []).filter((x) => x.id !== r.id))
      setSummary((cur) =>
        cur
          ? {
              ...cur,
              engaged: cur.engaged - 1,
              [r.heat]: Math.max(0, ((cur as any)[r.heat] || 0) - 1),
              hidden: cur.hidden ? { ...cur.hidden, dismissed: cur.hidden.dismissed + 1 } : cur.hidden,
            }
          : cur
      )
    }
  }

  const getFollowup = async (r: Row) => {
    if (followups[r.id] && !followups[r.id].loading) {
      // Toggle closed if already open.
      setFollowups((f) => { const n = { ...f }; delete n[r.id]; return n })
      return
    }
    setFollowups((f) => ({ ...f, [r.id]: { loading: true } }))
    try {
      const res = await fetch('/api/admin/lead-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business: r.business, listingId: r.listing_id, clicked: r.clicks > 0 }),
      })
      const d = await res.json()
      setFollowups((f) => ({ ...f, [r.id]: { ...d, loading: false } }))
    } catch {
      setFollowups((f) => { const n = { ...f }; delete n[r.id]; return n })
    }
  }

  const copy = (key: string, text: string) => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(''), 2000) })
  }

  if (rows === null) return null

  return (
    <section className="citybeat-panel rounded-2xl border border-white/10 p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-xl font-bold uppercase tracking-wide text-brand-neon">
          {locale === 'es' ? 'Prospectos interesados' : 'Warm leads'}
        </h2>
        {summary && (
          <div className="text-right text-xs text-white/50">
            <p>
              ✅ {summary.verified || 0} {locale === 'es' ? 'verificados' : 'verified'} · 🔥 {summary.hot}{' '}
              {locale === 'es' ? 'clic' : 'clicked'} · 👀 {summary.warm} {locale === 'es' ? 'volvió a abrir' : 're-opened'}
            </p>
            {summary.hidden && (
              <p
                className="text-[11px] text-white/35"
                title={
                  locale === 'es'
                    ? 'Ocultos: escáneres de correo que abren cada enlace al llegar, aperturas solo en la primera hora (precarga de Apple Mail), contactos equivocados, bajas, marcados como no reales y duplicados.'
                    : 'Hidden: mail scanners that open every link on arrival, opens only in the first hour (Apple Mail preloading), wrong contacts, unsubscribes, leads marked Not real, and duplicates.'
                }
              >
                {locale === 'es' ? 'Ocultos' : 'Hidden'}: 🤖 {summary.hidden.scanner} {locale === 'es' ? 'escáner' : 'scanner'} · ⏱{' '}
                {summary.hidden.unconfirmed} {locale === 'es' ? 'sin confirmar' : 'unconfirmed'} · ✉️ {summary.hidden.bad_contact}{' '}
                {locale === 'es' ? 'contacto erróneo' : 'wrong contact'} · 🚫 {summary.hidden.unsubscribed + summary.hidden.dismissed}{' '}
                {locale === 'es' ? 'baja / no real' : 'unsub / not real'}
              </p>
            )}
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-white/5 bg-black/25 p-8 text-center text-sm text-white/40">
          {locale === 'es'
            ? 'Nadie ha interactuado con los correos todavía. Cuando alguien abra o haga clic, aparecerá aquí.'
            : 'No email engagement yet. When a business opens or clicks, they show up here — call the clickers first.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] font-black uppercase tracking-wider text-white/40">
                <th className="py-2 pr-3">{locale === 'es' ? 'Negocio' : 'Business'}</th>
                <th className="py-2 px-3">{locale === 'es' ? 'Interés' : 'Signal'}</th>
                <th className="py-2 px-3 text-center">{locale === 'es' ? 'Abrió' : 'Opens'}</th>
                <th className="py-2 px-3 text-center">{locale === 'es' ? 'Clics' : 'Clicks'}</th>
                <th className="py-2 px-3">{locale === 'es' ? 'Última actividad' : 'Last activity'}</th>
                <th className="py-2 pl-3 text-right">{locale === 'es' ? 'Seguimiento' : 'Follow up'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.id}>
                <tr className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-2.5 pr-3">
                    {r.listing_id ? (
                      <a href={withLocale(locale, `/directory/${r.listing_id}`)} target="_blank" className="font-bold text-white underline hover:text-brand-neon">
                        {r.business}
                      </a>
                    ) : (
                      <span className="font-bold text-white">{r.business}</span>
                    )}
                    {r.email && <span className="block text-[11px] text-white/40">{r.email}</span>}
                  </td>
                  <td className="py-2.5 px-3">
                    {r.heat === 'verified' ? (
                      <span
                        className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-400"
                        title={locale === 'es' ? 'Hizo clic y usó la página: es una persona.' : 'Clicked through and used the page — a person.'}
                      >
                        ✅ {locale === 'es' ? 'Verificado' : 'Verified'}
                      </span>
                    ) : r.heat === 'hot' ? (
                      <span className="rounded bg-red-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-400">🔥 {locale === 'es' ? 'Caliente' : 'Hot'}</span>
                    ) : (
                      <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-400">👀 {locale === 'es' ? 'Tibio' : 'Warm'}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold">{r.opens}</td>
                  <td className="py-2.5 px-3 text-center font-bold">{r.clicks}</td>
                  <td className="py-2.5 px-3 text-white/60">{r.last_activity ? new Date(r.last_activity).toLocaleString() : '—'}</td>
                  <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => dismiss(r)}
                      disabled={dismissing === r.id}
                      title={locale === 'es' ? 'Ocultar: no es una persona real o no es el negocio correcto' : 'Hide: not a real person, or not the right business'}
                      className="mr-2 rounded border border-white/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white/50 hover:border-red-400/50 hover:text-red-300 disabled:opacity-40"
                    >
                      {dismissing === r.id ? '…' : locale === 'es' ? 'No es real' : 'Not real'}
                    </button>
                    <button
                      onClick={() => getFollowup(r)}
                      className="rounded border border-brand-neon/40 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-brand-neon hover:bg-brand-neon/10"
                    >
                      {followups[r.id]?.loading ? '…' : followups[r.id] ? (locale === 'es' ? 'Cerrar' : 'Close') : locale === 'es' ? 'Redactar' : 'Draft'}
                    </button>
                  </td>
                </tr>
                {followups[r.id] && !followups[r.id].loading && (
                  <tr className="bg-black/30">
                    <td colSpan={6} className="px-4 py-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                          <div className="mb-1 flex items-center justify-between">
                            <p className="text-[10px] font-black uppercase tracking-wider text-brand-neon">{locale === 'es' ? 'Correo de seguimiento' : 'Follow-up email'}</p>
                            <button onClick={() => copy(`${r.id}-e`, `${followups[r.id].email_subject}\n\n${followups[r.id].email_body}`)} className="text-[10px] font-bold uppercase tracking-wider text-white/50 hover:text-white">
                              {copied === `${r.id}-e` ? '✓' : locale === 'es' ? 'Copiar' : 'Copy'}
                            </button>
                          </div>
                          <p className="text-xs font-bold text-white">{followups[r.id].email_subject}</p>
                          <p className="mt-1 whitespace-pre-line text-xs text-white/70">{followups[r.id].email_body}</p>
                          {r.email && (
                            <a href={`mailto:${r.email}?subject=${encodeURIComponent(followups[r.id].email_subject || '')}&body=${encodeURIComponent(followups[r.id].email_body || '')}`}
                              className="mt-2 inline-block rounded bg-brand-neon px-3 py-1 text-[10px] font-black uppercase tracking-wider text-black hover:bg-cyan-300">
                              {locale === 'es' ? 'Abrir en correo' : 'Open in email'}
                            </a>
                          )}
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                          <div className="mb-1 flex items-center justify-between">
                            <p className="text-[10px] font-black uppercase tracking-wider text-brand-gold">{locale === 'es' ? 'Guion de llamada' : 'Call script'}</p>
                            <button onClick={() => copy(`${r.id}-c`, followups[r.id].call_script || '')} className="text-[10px] font-bold uppercase tracking-wider text-white/50 hover:text-white">
                              {copied === `${r.id}-c` ? '✓' : locale === 'es' ? 'Copiar' : 'Copy'}
                            </button>
                          </div>
                          <p className="text-sm italic text-white/80">&ldquo;{followups[r.id].call_script}&rdquo;</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
              </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[11px] text-white/30">
        {locale === 'es'
          ? '✅ Verificado es prueba: la persona usó la página. 🔥 y 👀 son muy probables pero no seguros — los reclamos de corporativos (helpdesk@, QA@) rara vez son el dueño local.'
          : '✅ Verified is proof: the person used the page. 🔥 and 👀 are likely but not certain — corporate inboxes (helpdesk@, qa@) are rarely the local owner.'}
      </p>
    </section>
  )
}
