'use client'

import { useEffect, useState } from 'react'
import { useLocale } from '@/components/TranslationProvider'
import { withLocale } from '@/components/citybeat/content'
import { PAYOUT_POLICY_EN, PAYOUT_POLICY_ES } from '@/lib/commission-schedule'

function money(cents: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format((cents || 0) / 100)
}

const SERVICE_LABEL: Record<string, { en: string; es: string }> = {
  directory: { en: 'Directory', es: 'Directorio' },
  ad_campaign: { en: 'Ad campaign', es: 'Campaña publicitaria' },
  sponsored_post: { en: 'Sponsored post', es: 'Publicación patrocinada' },
  manual: { en: 'Manual payout', es: 'Pago manual' },
}

// The signed-in user's payout table — every commission transfer we've sent them,
// with the running total. Shown on the editor/admin dashboard.
export function MyEarnings() {
  const locale = useLocale() as 'en' | 'es'
  const isEs = locale === 'es'
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    fetch('/api/platform/connect/balance', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null))
  }, [])

  if (!data) return null
  const transfers: any[] = (data.transfers || []).filter((t: any) => (t.amount || 0) > 0)
  const upcoming: any[] = (data.upcoming || []).filter((t: any) => (t.amount || 0) > 0)
  const commission = data.commission || { held: 0, due: 0, paid: 0, owed_back: 0 }
  const total = commission.paid || transfers.reduce((s: number, t: any) => s + (t.amount || 0), 0)
  const policy = isEs ? PAYOUT_POLICY_ES : PAYOUT_POLICY_EN
  const svc = (s: string) => (SERVICE_LABEL[s] ? (isEs ? SERVICE_LABEL[s].es : SERVICE_LABEL[s].en) : s)
  const roleLabel = (r: string) => (r === 'editor' ? (isEs ? 'Editor' : 'Editor') : r === 'rep' ? (isEs ? 'Venta' : 'Sale') : '')
  const fmtDay = (day: string | null) => {
    if (!day) return null
    // A YYYY-MM-DD cycle date is a calendar day, not an instant — parse the parts
    // directly so it can't shift a day under the viewer's own time zone.
    const [y, m, d] = day.split('-').map(Number)
    if (!y || !m || !d) return null
    return new Date(y, m - 1, d).toLocaleDateString(isEs ? 'es-MX' : 'en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <section className="mb-10 rounded-xl border border-brand-neon/25 bg-brand-neon/[0.04] p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">{isEs ? 'Mis ganancias' : 'My earnings'}</h2>
          <p className="mt-1 text-sm text-white/45">
            {isEs ? 'Comisiones ganadas, retenidas y pagadas.' : 'Commission earned, held, and paid.'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/40">{isEs ? 'Total pagado' : 'Total paid'}</p>
          <p className="text-3xl font-black text-brand-neon">{money(total)}</p>
        </div>
      </div>

      {/* The three states that matter to a rep: what's coming, what's cleared the
          refund window, and anything owed back after a refund. */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-black/20 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300/80">
            {isEs ? 'En retención' : 'On hold'}
          </p>
          <p className="mt-1 text-2xl font-black text-white">{money(commission.held)}</p>
          <p className="mt-1 text-xs text-white/40">
            {isEs ? 'Dentro del periodo de reembolso de 7 días' : 'Inside the 7-day refund window'}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-neon/80">
            {isEs ? 'Próximo pago' : 'Next payout'}
          </p>
          <p className="mt-1 text-2xl font-black text-white">{money(commission.due)}</p>
          <p className="mt-1 text-xs text-white/40">
            {isEs ? 'Listo para el próximo ciclo (día 1 o 15)' : 'Ready for the next cycle (1st or 15th)'}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
            {isEs ? 'Por devolver' : 'Owed back'}
          </p>
          <p className={`mt-1 text-2xl font-black ${commission.owed_back > 0 ? 'text-red-300' : 'text-white/30'}`}>
            {money(commission.owed_back)}
          </p>
          <p className="mt-1 text-xs text-white/40">
            {isEs ? 'Se descuenta de tu siguiente pago' : 'Deducted from your next payout'}
          </p>
        </div>
      </div>

      {upcoming.length > 0 && (
        <div className="mb-5 overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-[10px] font-black uppercase tracking-wider text-white/40">
                <th className="px-4 py-2">{isEs ? 'Origen' : 'Source'}</th>
                <th className="px-4 py-2">{isEs ? 'Estado' : 'Status'}</th>
                <th className="px-4 py-2">{isEs ? 'Se paga' : 'Pays on'}</th>
                <th className="px-4 py-2 text-right">{isEs ? 'Monto' : 'Amount'}</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((t) => (
                <tr key={t.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5 text-white/80">{svc(t.service)}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                        t.commission_state === 'due'
                          ? 'bg-brand-neon/15 text-brand-neon'
                          : t.commission_state === 'failed'
                            ? 'bg-red-400/15 text-red-300'
                            : 'bg-amber-400/15 text-amber-300'
                      }`}
                    >
                      {t.commission_state === 'due'
                        ? isEs ? 'Listo' : 'Ready'
                        : t.commission_state === 'failed'
                          ? isEs ? 'Reintentando' : 'Retrying'
                          : isEs ? 'Retenido' : 'Held'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-white/60">{fmtDay(t.payout_date) || '—'}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-white">{money(t.amount, t.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!data.connected ? (
        <p className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-white/60">
          {isEs ? 'Conecta tu banco para recibir pagos. ' : 'Connect your bank to receive payouts. '}
          <a href={withLocale(locale, '/account/payments')} className="font-bold text-brand-neon underline">
            {isEs ? 'Conectar banco' : 'Connect bank'}
          </a>
        </p>
      ) : transfers.length === 0 ? (
        <p className="rounded-lg border border-white/10 bg-black/20 p-6 text-center text-sm text-white/45">
          {isEs ? 'Aún no hay comisiones. Aparecerán aquí cuando se procese una venta.' : 'No commissions yet. They appear here as sales are processed.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-[10px] font-black uppercase tracking-wider text-white/40">
                <th className="px-4 py-2">{isEs ? 'Fecha' : 'Date'}</th>
                <th className="px-4 py-2">{isEs ? 'Origen' : 'Source'}</th>
                <th className="px-4 py-2 text-center">%</th>
                <th className="px-4 py-2 text-right">{isEs ? 'Monto' : 'Amount'}</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => {
                const date = t.created_at?._seconds ? new Date(t.created_at._seconds * 1000) : null
                return (
                  <tr key={t.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-2.5 text-white/60">
                      {date ? date.toLocaleDateString(isEs ? 'es-MX' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-white/80">
                      {svc(t.service)}
                      {t.role && <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white/50">{roleLabel(t.role)}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center text-white/50">{typeof t.percent === 'number' ? `${t.percent}%` : '—'}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-white">{money(t.amount, t.currency)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Payout terms, stated up front rather than buried: a rep must never be
          surprised by the hold window or by a clawback after a refund. */}
      <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4 text-sm">
        <p className="font-bold text-white/80">{policy.headline}</p>
        <ul className="mt-2 ml-4 list-disc space-y-1 leading-relaxed text-white/55">
          <li>{policy.hold}</li>
          <li>{policy.cycle}</li>
          <li className="text-amber-200/80">{policy.clawback}</li>
        </ul>
      </div>

      {/* Transparency: what your share is, and what the platform's cut actually pays for. */}
      <details className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-white/60">
        <summary className="cursor-pointer font-bold text-white/80">
          {isEs ? 'Cómo funcionan tus ganancias' : 'How your earnings work'}
        </summary>
        <div className="mt-3 space-y-2 leading-relaxed">
          <p>
            {isEs
              ? 'Ganas tu parte de Editor en cada venta: 65% de un anuncio/patrocinado y 45% de una ficha de directorio que cierres tú; 20% / 25% de una venta que traiga un vendedor; y 40% de una venta de directorio automática o directa.'
              : 'You earn your Editor share on every sale: 65% of an ad/sponsored sale and 45% of a directory listing you close yourself; 20% / 25% of a sale a rep brings in; and 40% of a directory sale that comes in automatically or on its own.'}
          </p>
          <p>
            {isEs ? 'El resto no es ganancia extra de la plataforma:' : "The rest isn't the platform pocketing profit:"}
          </p>
          <ul className="ml-4 list-disc space-y-1 text-white/55">
            <li>
              <strong className="text-white/80">{isEs ? 'La parte de la App' : 'The App share'}</strong>{' '}
              {isEs
                ? 'cubre el costo de operar la plataforma: alojamiento, comisiones de Stripe, correo, y las herramientas de automatización.'
                : 'covers the cost of running the platform — hosting, Stripe fees, email, and the automation tools.'}
            </li>
            <li>
              <strong className="text-white/80">{isEs ? 'La parte del Desarrollador' : 'The Developer share'}</strong>{' '}
              {isEs ? 'es la parte del dueño que construye y mantiene el sitio.' : "is the owner's cut for building and running the site."}
            </li>
          </ul>
        </div>
      </details>
    </section>
  )
}
