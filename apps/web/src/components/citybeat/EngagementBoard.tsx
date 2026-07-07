'use client'

import { useEffect, useState } from 'react'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'

interface Row {
  id: string
  listing_id: string | null
  business: string
  email: string | null
  opens: number
  clicks: number
  status: string
  last_activity: string | null
  heat: 'hot' | 'warm' | 'cold'
}

// Warm-leads board for reps: businesses that opened or clicked outreach, hottest
// first. A click means genuine interest — call them today.
export function EngagementBoard() {
  const locale = useLocale() as 'en' | 'es'
  const [rows, setRows] = useState<Row[] | null>(null)
  const [summary, setSummary] = useState<{ engaged: number; hot: number; warm: number } | null>(null)

  useEffect(() => {
    fetch('/api/admin/outreach-engagement')
      .then((r) => (r.ok ? r.json() : { rows: [], summary: null }))
      .then((d) => {
        setRows(d.rows || [])
        setSummary(d.summary || null)
      })
      .catch(() => setRows([]))
  }, [])

  if (rows === null) return null

  return (
    <section className="citybeat-panel rounded-2xl border border-white/10 p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-xl font-bold uppercase tracking-wide text-brand-neon">
          {locale === 'es' ? 'Prospectos interesados' : 'Warm leads'}
        </h2>
        {summary && (
          <p className="text-xs text-white/50">
            🔥 {summary.hot} {locale === 'es' ? 'clic' : 'clicked'} · 👀 {summary.warm}{' '}
            {locale === 'es' ? 'abrió' : 'opened'}
          </p>
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
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
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
                    {r.heat === 'hot' ? (
                      <span className="rounded bg-red-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-400">🔥 {locale === 'es' ? 'Caliente' : 'Hot'}</span>
                    ) : (
                      <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-400">👀 {locale === 'es' ? 'Tibio' : 'Warm'}</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold">{r.opens}</td>
                  <td className="py-2.5 px-3 text-center font-bold">{r.clicks}</td>
                  <td className="py-2.5 px-3 text-white/60">{r.last_activity ? new Date(r.last_activity).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[11px] text-white/30">
        {locale === 'es'
          ? 'Nota: algunos "abrió" pueden ser escáneres de correo corporativo. Un clic es señal real de interés.'
          : 'Note: some opens can be corporate mail scanners. A click is the reliable buying signal.'}
      </p>
    </section>
  )
}
