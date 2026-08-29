'use client'

import { useMemo, useState } from 'react'
import { useLocale } from '@/components/TranslationProvider'
import { SALES_PRODUCTS, salesProductAmount, getSalesProduct } from '@/lib/sales-products'
import { useCart } from './CartProvider'

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

// The floating basket + slide-over. Reads the shared cart, previews the ONE
// consolidated Stripe session via the cart plan (so a monthly+annual mix is caught
// BEFORE checkout), collects a contact email, and posts to /api/cart/checkout.
export function CartDrawer() {
  const locale = useLocale() as 'en' | 'es'
  const isEs = locale === 'es'
  const { items, count, plan, remove, clear, isOpen, setOpen } = useCart()
  const [email, setEmail] = useState('')
  const [business, setBusiness] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const rows = useMemo(
    () =>
      items.map((it) => {
        const p = getSalesProduct(it.productId)
        const amount = p ? salesProductAmount(p, it.customAmount) ?? 0 : 0
        return {
          productId: it.productId,
          name: p ? SALES_PRODUCTS[p.id].shortName : it.productId,
          amount,
          interval: p?.interval || null,
        }
      }),
    [items]
  )

  const total = plan.ok ? plan.total : rows.reduce((s, r) => s + r.amount, 0)
  const mixed = !plan.ok && (plan as any).reason === 'mixed_recurring_intervals'
  const hasRecurring = plan.ok && plan.hasRecurring
  const ridesFirstInvoice = plan.ok && plan.warnings.includes('one_time_items_billed_on_first_invoice')

  const checkout = async () => {
    setError('')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError(isEs ? 'Ingresa un correo válido.' : 'Enter a valid email.')
      return
    }
    if (!plan.ok) {
      setError(
        mixed
          ? isEs
            ? 'No puedes combinar un plan mensual y uno anual en un solo pago. Quita uno y págalo por separado.'
            : 'A monthly and an annual plan can’t be combined into one payment. Remove one and check it out separately.'
          : isEs
            ? 'Revisa tu carrito.'
            : 'Please review your cart.'
      )
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/cart/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          contactEmail: email.trim(),
          businessName: business.trim(),
          locale,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) throw new Error(data.error || (isEs ? 'No se pudo iniciar el pago.' : 'Could not start checkout.'))
      window.location.href = data.url // to Stripe hosted Checkout
    } catch (e: any) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <>
      {/* Floating basket — only once there's something in it, so it never competes
          with the chat launcher on an empty cart. Sits above the chat button. */}
      {count > 0 && !isOpen && (
        <button
          onClick={() => setOpen(true)}
          aria-label={isEs ? `Ver carrito (${count})` : `View cart (${count})`}
          className="fixed bottom-24 right-5 z-50 flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-black text-black shadow-xl transition hover:bg-white/90"
        >
          <span aria-hidden="true">🛒</span>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-neon px-1 text-xs">{count}</span>
        </button>
      )}

      {isOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={isEs ? 'Carrito' : 'Cart'}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col overflow-hidden border-l border-white/10 bg-brand-charcoal shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="font-display text-xl font-black text-white">{isEs ? 'Tu carrito' : 'Your cart'}</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label={isEs ? 'Cerrar' : 'Close'}
                className="-mr-2 flex h-10 w-10 items-center justify-center rounded-md text-white/50 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {rows.length === 0 ? (
                <p className="text-sm text-white/50">{isEs ? 'Tu carrito está vacío.' : 'Your cart is empty.'}</p>
              ) : (
                rows.map((r) => (
                  <div key={r.productId} className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                    <div>
                      <p className="text-sm font-bold text-white">{r.name}</p>
                      <p className="text-xs text-white/50">
                        {money(r.amount)}
                        {r.interval ? (isEs ? (r.interval === 'year' ? '/año' : '/mes') : `/${r.interval === 'year' ? 'yr' : 'mo'}`) : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => remove(r.productId)}
                      aria-label={isEs ? `Quitar ${r.name}` : `Remove ${r.name}`}
                      className="shrink-0 text-xs font-bold text-white/40 underline hover:text-white/70"
                    >
                      {isEs ? 'Quitar' : 'Remove'}
                    </button>
                  </div>
                ))
              )}

              {mixed && (
                <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">
                  {isEs
                    ? 'Tienes un plan mensual y uno anual. Un solo pago admite un solo ciclo — quita uno para continuar.'
                    : 'You have a monthly and an annual plan. One payment can hold only one billing cycle — remove one to continue.'}
                </div>
              )}
              {ridesFirstInvoice && (
                <p className="text-xs text-white/40">
                  {isEs
                    ? 'Los productos de pago único se cobran en tu primera factura de suscripción.'
                    : 'One-time items are billed on your first subscription invoice.'}
                </p>
              )}
            </div>

            {rows.length > 0 && (
              <div className="space-y-3 border-t border-white/10 p-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">
                    {hasRecurring ? (isEs ? 'Total hoy' : 'Total today') : isEs ? 'Total' : 'Total'}
                  </span>
                  <span className="font-black text-white">{money(total)}</span>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isEs ? 'Correo electrónico' : 'Email address'}
                  aria-label={isEs ? 'Correo electrónico' : 'Email address'}
                  className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-neon"
                />
                <input
                  value={business}
                  onChange={(e) => setBusiness(e.target.value)}
                  placeholder={isEs ? 'Nombre del negocio (opcional)' : 'Business name (optional)'}
                  aria-label={isEs ? 'Nombre del negocio' : 'Business name'}
                  className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-neon"
                />
                {error && <p className="text-xs text-red-300">{error}</p>}
                <button
                  onClick={checkout}
                  disabled={busy || !plan.ok}
                  className="w-full rounded-md bg-brand-neon px-4 py-3 text-sm font-black uppercase tracking-wider text-black transition hover:bg-cyan-300 disabled:opacity-50"
                >
                  {busy ? (isEs ? 'Redirigiendo…' : 'Redirecting…') : isEs ? 'Pagar' : 'Checkout'}
                </button>
                <button onClick={clear} className="w-full text-xs text-white/40 underline hover:text-white/60">
                  {isEs ? 'Vaciar carrito' : 'Clear cart'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
