'use client'

import { useEffect, useState } from 'react'
import { DIRECTORY_PLANS, type PlanId } from '@/lib/pricing'
import { useLocale } from '@/components/TranslationProvider'

interface Listing {
  id: string
  name: string
  tier: string
  pending_tier: string | null
  claim_status: string
  plan: string | null
}

// Upgrade options offered in the dashboard — annual (best value) first.
const BOOST_PLANS: PlanId[] = ['premium_annual', 'premium_monthly', 'featured_monthly']

const TIER_LABEL: Record<string, string> = {
  basic: 'Basic',
  premium: 'Premium — priority placement',
  featured: 'Featured — top of category + homepage',
}

export function MyListingsBoost() {
  const locale = useLocale()
  const isEs = locale === 'es'
  const [listings, setListings] = useState<Listing[] | null>(null)
  const [busy, setBusy] = useState<string>('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/directory/mine')
      .then((r) => (r.ok ? r.json() : { listings: [] }))
      .then((d) => setListings(d.listings || []))
      .catch(() => setListings([]))
  }, [])

  const boost = async (listingId: string, plan: PlanId) => {
    setBusy(`${listingId}:${plan}`)
    setError('')
    try {
      const res = await fetch('/api/directory/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, plan }),
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

      <div className="grid gap-4">
        {listings.map((listing) => {
          const isFeatured = listing.tier === 'featured'
          return (
            <div key={listing.id} className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{listing.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {TIER_LABEL[listing.tier] || 'Basic'}
                    {listing.pending_tier ? ` · upgrade to ${listing.pending_tier} pending approval` : ''}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${isFeatured ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-700'}`}>
                  {listing.tier.toUpperCase()}
                </span>
              </div>

              {/* Direct entry to the listing's inline CMS (opens edit mode). */}
              <a
                href={`/${locale}/directory/${listing.id}?edit=1`}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700"
              >
                {isEs ? '✎ Editar mi ficha' : '✎ Manage my listing'}
              </a>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-200 pt-4">
                {BOOST_PLANS.map((planId) => {
                  const plan = DIRECTORY_PLANS[planId]
                  // Don't offer to "boost" to the tier they already have on a monthly plan.
                  const sameTier = plan.tier === listing.tier
                  const key = `${listing.id}:${planId}`
                  const isAnnual = plan.interval === 'year'
                  return (
                    <button
                      key={planId}
                      disabled={busy === key || (sameTier && listing.tier === 'featured')}
                      onClick={() => boost(listing.id, planId)}
                      className={`rounded-md px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50 ${isAnnual ? 'bg-cyan-600 hover:bg-cyan-700' : 'bg-red-600 hover:bg-red-700'}`}
                    >
                      {busy === key ? 'Starting…' : `${plan.label} · ${plan.priceLabel}`}
                      {isAnnual && plan.savingsLabel ? ' — 2 mo free' : ''}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
