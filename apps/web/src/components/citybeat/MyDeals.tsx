'use client'

import { useEffect, useState } from 'react'

interface Listing {
  id: string
  name: string
  tier: string
}
interface Deal {
  id: string
  title: string
  business_name?: string
  code?: string | null
  expires_at?: string | null
}

// Lets a directory owner on Premium/Featured post coupons/deals (shown on /deals).
export function MyDeals() {
  const [listings, setListings] = useState<Listing[] | null>(null)
  const [deals, setDeals] = useState<Deal[]>([])
  const [form, setForm] = useState({ listingId: '', title: '', description: '', code: '', expires_at: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const loadDeals = () =>
    fetch('/api/deals?mine=1').then((r) => (r.ok ? r.json() : { deals: [] })).then((d) => setDeals(d.deals || [])).catch(() => {})

  useEffect(() => {
    fetch('/api/directory/mine')
      .then((r) => (r.ok ? r.json() : { listings: [] }))
      .then((d) => {
        const paid = (d.listings || []).filter((l: any) => l.tier === 'premium' || l.tier === 'featured')
        setListings(paid)
        if (paid[0]) setForm((f) => ({ ...f, listingId: paid[0].id }))
      })
      .catch(() => setListings([]))
    loadDeals()
  }, [])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.listingId || !form.title.trim()) return setError('Pick a listing and enter a title.')
    setBusy(true)
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not post deal')
      setForm((f) => ({ ...f, title: '', description: '', code: '', expires_at: '' }))
      await loadDeals()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    await fetch(`/api/deals?id=${id}`, { method: 'DELETE' }).catch(() => {})
    setDeals((d) => d.filter((x) => x.id !== id))
  }

  // Only show the panel to owners who have a paid listing (deals are a Premium perk).
  if (listings === null || listings.length === 0) return null

  const field = 'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900'

  return (
    <div className="mb-12">
      <h2 className="text-2xl font-bold mb-2">Deals & coupons</h2>
      <p className="text-sm text-gray-500 mb-6">Post a deal for your business — it appears on the public Deals page and drives customers to you.</p>

      {deals.length > 0 && (
        <div className="mb-6 grid gap-2">
          {deals.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-gray-900">{d.title}</p>
                <p className="truncate text-xs text-gray-500">{d.business_name}{d.code ? ` · code ${d.code}` : ''}{d.expires_at ? ` · ends ${new Date(d.expires_at).toLocaleDateString()}` : ''}</p>
              </div>
              <button onClick={() => remove(d.id)} className="ml-3 shrink-0 text-sm text-red-600 hover:underline">Remove</button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={add} className="rounded-lg border border-gray-200 bg-gray-50 p-5">
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-gray-700">Listing
            <select className={field} value={form.listingId} onChange={(e) => setForm({ ...form, listingId: e.target.value })}>
              {listings.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
          <label className="text-sm text-gray-700">Title
            <input className={field} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="20% off lunch" />
          </label>
          <label className="text-sm text-gray-700 sm:col-span-2">Details
            <input className={field} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Valid Mon–Fri, dine-in only" />
          </label>
          <label className="text-sm text-gray-700">Promo code (optional)
            <input className={field} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="CITYBEAT20" />
          </label>
          <label className="text-sm text-gray-700">Expires (optional)
            <input type="date" className={field} value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
          </label>
        </div>
        <button type="submit" disabled={busy} className="mt-4 rounded-md bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
          {busy ? 'Posting…' : 'Post deal'}
        </button>
      </form>
    </div>
  )
}
