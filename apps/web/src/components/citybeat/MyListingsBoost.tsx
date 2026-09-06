'use client'

import { useEffect, useState } from 'react'
import { DIRECTORY_PLANS, type PlanId } from '@/lib/pricing'
import { useLocale } from '@/components/TranslationProvider'
import { billingTerms } from '@/lib/billing-terms'

interface Listing {
  id: string
  name: string
  tier: string
  pending_tier: string | null
  claim_status: string
  plan: string | null
  has_subscription?: boolean
}

// Upgrade options offered in the dashboard — annual (best value) first.
const BOOST_PLANS: PlanId[] = ['premium_annual', 'premium_monthly', 'featured_monthly', 'sponsored_monthly']

const TIER_LABEL: Record<string, { en: string; es: string }> = {
  basic: { en: 'Basic', es: 'Básico' },
  premium: { en: 'Premium — priority placement', es: 'Premium — ubicación prioritaria' },
  featured: { en: 'Featured — top of category + homepage', es: 'Destacado — arriba de la categoría + portada' },
}

export function MyListingsBoost() {
  const locale = useLocale()
  const isEs = locale === 'es'
  // Same words the claim page and the cart show before a card is charged. The
  // dashboard buttons below start (or change) a real Stripe subscription and
  // disclosed none of it — "I didn't know it renewed" is the dispute we cannot
  // win without showing what the customer was told.
  const terms = billingTerms(locale)
  const [listings, setListings] = useState<Listing[] | null>(null)
  const [busy, setBusy] = useState<string>('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    fetch('/api/directory/mine')
      .then((r) => (r.ok ? r.json() : { listings: [] }))
      .then((d) => setListings(d.listings || []))
      .catch(() => setListings([]))
  }, [])

  const boost = async (listing: Listing, plan: PlanId) => {
    setBusy(`${listing.id}:${plan}`)
    setError('')
    setNotice('')
    try {
      if (listing.has_subscription) {
        // Already paying: change the EXISTING subscription in place (Stripe
        // prorates). Opening a second checkout used to double-bill forever.
        const res = await fetch('/api/directory/change-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listingId: listing.id, plan }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Could not change the plan')
        setNotice(
          isEs
            ? 'Plan actualizado. Stripe prorratea la diferencia en tu próxima factura.'
            : 'Plan updated. Stripe prorates the difference on your next invoice.'
        )
        setListings((prev) =>
          (prev || []).map((l) => (l.id === listing.id ? { ...l, tier: data.tier, plan: data.plan, pending_tier: null } : l))
        )
        setBusy('')
        return
      }
      const res = await fetch('/api/directory/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: listing.id, plan }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not start checkout')
      window.location.href = data.url
    } catch (e: any) {
      setError(e.message)
      setBusy('')
    }
  }

  if (listings === null) return null
  if (listings.length === 0) return null

  return (
    <div className="mb-12">
      <h2 className="text-2xl font-bold mb-2">{isEs ? 'Mis fichas del directorio' : 'My directory listings'}</h2>
      <p className="text-sm text-gray-500 mb-6">
        {isEs
          ? 'Administra el contenido de tu ficha (foto, descripción, horario) o súbela de nivel para aparecer más arriba. Los cambios se aplican al aprobarse.'
          : 'Manage your listing content (photo, description, hours) or boost it to rank higher in directory search. Changes take effect once approved.'}
      </p>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {notice && <p className="mb-4 text-sm text-emerald-600">{notice}</p>}

      <div className="grid gap-4">
        {listings.map((listing) => {
          const isFeatured = listing.tier === 'featured'
          return (
            <div key={listing.id} className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{listing.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {(TIER_LABEL[listing.tier] || TIER_LABEL.basic)[isEs ? 'es' : 'en']}
                    {listing.pending_tier
                      ? isEs
                        ? ` · mejora a ${listing.pending_tier} pendiente de aprobación`
                        : ` · upgrade to ${listing.pending_tier} pending approval`
                      : ''}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${isFeatured ? 'bg-brand-gold/15 text-brand-gold' : 'bg-white/10 text-white/70'}`}>
                  {listing.tier.toUpperCase()}
                </span>
              </div>

              {/* Entry to the dedicated owner CMS (source of truth for listing management). */}
              <a
                href={`/${locale}/dashboard/listings/${listing.id}`}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700"
              >
                {isEs ? '✎ Administrar mi ficha' : '✎ Manage my listing'}
              </a>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-200 pt-4">
                {BOOST_PLANS.map((planId) => {
                  const plan = DIRECTORY_PLANS[planId]
                  const samePlan = listing.plan === planId
                  const sameTier = plan.tier === listing.tier
                  const key = `${listing.id}:${planId}`
                  const isAnnual = plan.interval === 'year'
                  return (
                    <button
                      key={planId}
                      // Never sell someone the exact plan they already have —
                      // re-buying it used to open a duplicate subscription.
                      disabled={busy === key || samePlan || (sameTier && listing.tier === 'featured')}
                      onClick={() => boost(listing, planId)}
                      className={`rounded-md px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50 ${isAnnual ? 'bg-cyan-600 hover:bg-cyan-700' : 'bg-red-600 hover:bg-red-700'}`}
                    >
                      {busy === key ? (isEs ? 'Iniciando…' : 'Starting…') : `${plan.label} · ${plan.priceLabel}`}
                      {isAnnual && plan.savingsLabel ? (isEs ? ' — 2 meses gratis' : ' — 2 mo free') : ''}
                    </button>
                  )
                })}
              </div>

              {/* Recurring-billing disclosure, in the customer's language, at
                  ordinary body size — the card networks require the terms and
                  the cancellation path to be shown BEFORE the purchase starts,
                  and every button above starts or changes a subscription. */}
              <div className="mt-4 rounded-md border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-600">
                <p className="font-semibold uppercase tracking-wide text-gray-500">
                  {isEs ? 'Antes de pagar' : 'Before you pay'}
                </p>
                <ul className="mt-1.5 space-y-1">
                  <li>{terms.renewal}</li>
                  <li>{terms.cancel}</li>
                  <li>{terms.whatHappens}</li>
                  <li>{terms.refunds}</li>
                  {/* Only true for a listing that is already paying: the boost
                      calls /api/directory/change-plan, which edits the existing
                      subscription instead of opening a second one. */}
                  {listing.has_subscription && (
                    <li>
                      {isEs
                        ? 'Cambiar de plan actualiza tu suscripción actual: Stripe prorratea la diferencia en tu próxima factura y no se crea una segunda suscripción.'
                        : 'Changing plan updates your existing subscription: Stripe prorates the difference on your next invoice, and no second subscription is opened.'}
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
