'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'
import { orderStatusHeadline, orderStatusSteps } from '@/lib/order-status'

// Customer order-status page. Reached from the confirmation email with the
// ?access= token. Shows a plain timeline (paid → details → review → live) so a
// buyer can see exactly where their order stands — previously there was no
// answer to "where is my order" anywhere in the product.
export default function OrderStatusPage({ params }: { params: { orderId: string } }) {
  const locale = useLocale() as 'en' | 'es'
  const isEs = locale === 'es'
  const [order, setOrder] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  // Completing a brief (/fulfill) requires the access token — the session-id-only
  // receipt link authorizes viewing status but not editing, so hide Finish links
  // (which would 401) when the token is absent.
  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    // Forward the whole query string so the API sees both ?access= (Stripe redirect)
    // and ?session_id= (confirmation-email receipt link) auth paths.
    const qs = window.location.search || ''
    setHasAccess(Boolean(new URLSearchParams(qs).get('access')))
    fetch(`/api/sales/orders/${params.orderId}/status${qs}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(data.error || 'Could not load this order')
        setOrder(data.order)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [params.orderId])

  return (
    <CityBeatShell locale={locale}>
      <section className="container-wide max-w-2xl py-16">
        {loading ? (
          <p className="text-white/50">{isEs ? 'Cargando…' : 'Loading…'}</p>
        ) : error ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-white/70">{error}</p>
            <p className="mt-3 text-sm text-white/40">
              {isEs ? 'Responde a tu correo de confirmación y te ayudamos.' : 'Reply to your confirmation email and we will help.'}
            </p>
          </div>
        ) : order ? (
          <>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-neon">
              {isEs ? 'Estado del pedido' : 'Order status'}
            </p>
            <h1 className="mt-2 font-display text-4xl font-black tracking-tight text-white">
              {orderStatusHeadline(order, locale)}
            </h1>
            <p className="mt-2 text-white/55">
              {order.product_name}
              {order.business_name ? ` · ${order.business_name}` : ''}
            </p>

            <ol className="mt-10 space-y-5">
              {orderStatusSteps(order).map((s) => (
                <li key={s.key} className="flex items-start gap-4">
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                      s.state === 'done'
                        ? 'bg-brand-neon text-black'
                        : s.state === 'current'
                          ? 'border-2 border-brand-neon text-brand-neon'
                          : 'border border-white/20 text-white/30'
                    }`}
                  >
                    {s.state === 'done' ? '✓' : ''}
                  </span>
                  <div>
                    <p className={`font-bold ${s.state === 'upcoming' ? 'text-white/40' : 'text-white'}`}>
                      {isEs ? s.labelEs : s.labelEn}
                    </p>
                    {s.state === 'current' && s.key === 'brief' && order.payment_status === 'paid' && hasAccess && (
                      <Link
                        href={withLocale(locale, `/fulfill/${params.orderId}${window.location.search}`)}
                        className="mt-1 inline-block text-sm font-bold text-brand-neon underline"
                      >
                        {isEs ? 'Completar ahora →' : 'Finish now →'}
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            {Array.isArray(order.siblings) && order.siblings.length > 0 && (
              <div className="mt-10 rounded-xl border border-white/10 bg-white/5 p-6">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-neon">
                  {isEs ? 'También en esta compra' : 'Also in this purchase'}
                </p>
                <p className="mt-1 text-sm text-white/50">
                  {isEs
                    ? 'Pagaste todo junto. Completa los detalles de cada producto aquí.'
                    : 'You paid for these together. Finish the details for each one here.'}
                </p>
                <ul className="mt-4 space-y-3">
                  {order.siblings.map((sib: any) => {
                    const done = sib.intake_status === 'submitted' || sib.intake_status === 'complete'
                    return (
                      <li key={sib.id} className="flex items-center justify-between gap-3 border-t border-white/10 pt-3 first:border-t-0 first:pt-0">
                        <span className="text-sm font-bold text-white/80">{sib.product_name}</span>
                        {done ? (
                          <span className="text-xs font-bold text-brand-neon">{isEs ? 'Completado ✓' : 'Done ✓'}</span>
                        ) : hasAccess ? (
                          <Link
                            href={withLocale(locale, `/fulfill/${sib.id}${window.location.search}`)}
                            className="shrink-0 text-sm font-bold text-brand-neon underline"
                          >
                            {isEs ? 'Completar →' : 'Finish →'}
                          </Link>
                        ) : (
                          <span className="shrink-0 text-xs text-white/40">{isEs ? 'Pendiente' : 'Pending'}</span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            <p className="mt-10 border-t border-white/10 pt-6 text-sm text-white/40">
              {isEs
                ? '¿Preguntas? Responde a tu correo de CityBeat y te contactamos.'
                : 'Questions? Reply to your CityBeat email and we will get back to you.'}
            </p>
          </>
        ) : null}
      </section>
    </CityBeatShell>
  )
}
