'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SiteHeader } from '@/components/citybeat/SiteHeader'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'
import { getUser } from '@citybeat/lib/firebase/auth-client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Listing {
  id: string
  name: string
  description: string | null
  category: string
  address: string | null
  phone: string | null
  website: string | null
  rating: number | null
  user_ratings_total: number | null
  tier: 'basic' | 'premium'
  claim_status: 'unclaimed' | 'pending_approval' | 'approved'
  is_published: boolean
  is_sponsored: boolean
  image_url: string | null
  gallery_urls: string[] | null
  social_links: { facebook?: string; instagram?: string; twitter?: string } | null
  hours: Record<string, string> | null
  owner_id: string | null
  created_at: string
  updated_at: string
  profiles?: { email: string; full_name: string | null; phone_number: string | null } | null
}

const BLANK_FORM = {
  name: '',
  category: 'Restaurant',
  address: '',
  phone: '',
  website: '',
  description: '',
  tier: 'basic' as 'basic' | 'premium',
  claim_status: 'unclaimed' as Listing['claim_status'],
  is_published: true,
  is_sponsored: false,
  image_url: '',
}

const CATEGORIES = ['Restaurant', 'Cafe', 'Coffee Shop', 'Bar', 'Bakery', 'Food Truck', 'Other']
const TIERS = ['basic', 'premium']
const CLAIM_STATUSES = ['unclaimed', 'pending_approval', 'approved']

// ─── Badge helpers ─────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: string }) {
  return tier === 'premium' ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-brand-neon/15 text-brand-neon border border-brand-neon/30">
      ★ Premium
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-white/5 text-white/40 border border-white/10">
      Basic
    </span>
  )
}

function ClaimBadge({ status }: { status: string }) {
  if (status === 'approved') return (
    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-green-500/15 text-green-400 border border-green-500/30">✓ Verified</span>
  )
  if (status === 'pending_approval') return (
    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">⏳ Pending</span>
  )
  return (
    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-white/5 text-white/40 border border-white/10">Unclaimed</span>
  )
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditModal({
  listing,
  onClose,
  onSave,
}: {
  listing: Listing
  onClose: () => void
  onSave: (id: string, updates: Partial<Listing>) => Promise<void>
}) {
  const [form, setForm] = useState({
    name: listing.name,
    category: listing.category,
    address: listing.address || '',
    phone: listing.phone || '',
    website: listing.website || '',
    description: listing.description || '',
    image_url: listing.image_url || '',
    tier: listing.tier,
    claim_status: listing.claim_status,
    is_published: listing.is_published,
    is_sponsored: listing.is_sponsored,
    gallery_urls: (listing.gallery_urls || []).join('\n'),
    facebook: listing.social_links?.facebook || '',
    instagram: listing.social_links?.instagram || '',
    twitter: listing.social_links?.twitter || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await onSave(listing.id, {
        name: form.name,
        category: form.category,
        address: form.address || null,
        phone: form.phone || null,
        website: form.website || null,
        description: form.description || null,
        image_url: form.image_url || null,
        tier: form.tier,
        claim_status: form.claim_status,
        is_published: form.is_published,
        is_sponsored: form.is_sponsored,
        gallery_urls: form.gallery_urls.split('\n').map(u => u.trim()).filter(Boolean),
        social_links: {
          facebook: form.facebook || undefined,
          instagram: form.instagram || undefined,
          twitter: form.twitter || undefined,
        },
      })
      onClose()
    } catch (e: any) {
      setError(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const field = (label: string, key: keyof typeof form, type = 'text', mono = false) => (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-wider text-white/50 mb-1">{label}</label>
      <input
        type={type}
        value={form[key] as string}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
        className={`w-full rounded px-3 py-2 border border-white/15 bg-black/40 text-sm text-white focus:border-brand-neon focus:outline-none transition ${mono ? 'font-mono text-xs' : ''}`}
      />
    </div>
  )

  const selectField = (label: string, key: keyof typeof form, options: string[]) => (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-wider text-white/50 mb-1">{label}</label>
      <select
        value={form[key] as string}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
        className="w-full rounded px-3 py-2 border border-white/15 bg-brand-dark text-sm text-white focus:border-brand-neon focus:outline-none transition"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )

  const toggle = (label: string, desc: string, key: 'is_published' | 'is_sponsored') => (
    <label className="flex items-center justify-between p-3 rounded border border-white/10 bg-white/5 cursor-pointer hover:border-white/20 transition">
      <div>
        <p className="text-xs font-bold text-white">{label}</p>
        <p className="text-[10px] text-white/40 mt-0.5">{desc}</p>
      </div>
      <div
        onClick={() => setForm({ ...form, [key]: !form[key] })}
        className={`w-11 h-6 rounded-full transition-colors duration-200 flex items-center px-1 ${form[key] ? 'bg-brand-neon' : 'bg-white/15'}`}
      >
        <div className={`w-4 h-4 rounded-full bg-black transition-transform duration-200 ${form[key] ? 'translate-x-5' : 'translate-x-0'}`} />
      </div>
    </label>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/15 bg-brand-dark shadow-2xl">
        <div className="sticky top-0 bg-brand-dark border-b border-white/10 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="font-display text-lg font-black text-white uppercase tracking-wide">Edit Listing</h2>
            <p className="text-[10px] text-white/40 mt-0.5 font-mono">{listing.id}</p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white text-2xl leading-none transition">×</button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded bg-brand-magenta/10 border border-brand-magenta/30 text-brand-magenta text-xs font-bold">⚠ {error}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('Business Name', 'name')}
            {selectField('Category', 'category', CATEGORIES)}
            {field('Address', 'address')}
            {field('Phone', 'phone', 'tel')}
            {field('Website', 'website', 'url')}
            {field('Cover Image URL', 'image_url', 'url')}
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-white/50 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full rounded px-3 py-2 border border-white/15 bg-black/40 text-sm text-white focus:border-brand-neon focus:outline-none transition resize-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-white/50 mb-1">Gallery Image URLs (one per line)</label>
            <textarea
              value={form.gallery_urls}
              onChange={e => setForm({ ...form, gallery_urls: e.target.value })}
              rows={3}
              placeholder="https://..."
              className="w-full rounded px-3 py-2 border border-white/15 bg-black/40 text-sm text-white font-mono focus:border-brand-neon focus:outline-none transition resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {field('Facebook URL', 'facebook', 'url')}
            {field('Instagram URL', 'instagram', 'url')}
            {field('Twitter URL', 'twitter', 'url')}
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/10">
            {selectField('Tier', 'tier', TIERS)}
            {selectField('Claim Status', 'claim_status', CLAIM_STATUSES)}
          </div>

          <div className="space-y-2 pt-2 border-t border-white/10">
            {toggle('Published', 'Visible to the public in the directory', 'is_published')}
            {toggle('Sponsored', 'Appears at the very top of search results with gold badge', 'is_sponsored')}
          </div>
        </div>

        <div className="sticky bottom-0 bg-brand-dark border-t border-white/10 px-6 py-4 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded border border-white/15 text-white/70 text-xs font-bold uppercase tracking-wider hover:bg-white/5 transition">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded bg-brand-neon text-black text-xs font-black uppercase tracking-wider hover:bg-cyan-300 transition disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Add Modal ────────────────────────────────────────────────────────────────

function AddModal({
  onClose,
  onAdd,
}: {
  onClose: () => void
  onAdd: (data: typeof BLANK_FORM) => Promise<void>
}) {
  const [form, setForm] = useState({ ...BLANK_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleAdd = async () => {
    if (!form.name || !form.category) { setError('Name and category are required'); return }
    setSaving(true); setError('')
    try {
      await onAdd(form)
      onClose()
    } catch (e: any) {
      setError(e.message || 'Failed to add listing')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-brand-dark shadow-2xl">
        <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-black text-white uppercase tracking-wide">Add New Listing</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white text-2xl leading-none transition">×</button>
        </div>
        <div className="p-6 space-y-4">
          {error && <div className="p-3 rounded bg-brand-magenta/10 border border-brand-magenta/30 text-brand-magenta text-xs font-bold">⚠ {error}</div>}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-white/50 mb-1">Business Name *</label>
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full rounded px-3 py-2 border border-white/15 bg-black/40 text-sm text-white focus:border-brand-neon focus:outline-none transition" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-white/50 mb-1">Category *</label>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              className="w-full rounded px-3 py-2 border border-white/15 bg-brand-dark text-sm text-white focus:border-brand-neon focus:outline-none transition">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-white/50 mb-1">Phone</label>
              <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded px-3 py-2 border border-white/15 bg-black/40 text-sm text-white focus:border-brand-neon focus:outline-none transition" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-white/50 mb-1">Website</label>
              <input type="url" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })}
                className="w-full rounded px-3 py-2 border border-white/15 bg-black/40 text-sm text-white focus:border-brand-neon focus:outline-none transition" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-white/50 mb-1">Address</label>
            <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
              className="w-full rounded px-3 py-2 border border-white/15 bg-black/40 text-sm text-white focus:border-brand-neon focus:outline-none transition" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-white/50 mb-1">Tier</label>
              <select value={form.tier} onChange={e => setForm({ ...form, tier: e.target.value as 'basic' | 'premium' })}
                className="w-full rounded px-3 py-2 border border-white/15 bg-brand-dark text-sm text-white focus:border-brand-neon focus:outline-none transition">
                <option value="basic">Basic</option>
                <option value="premium">Premium</option>
              </select>
            </div>
            <div className="flex items-center gap-3 pt-5">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-white">
                <input type="checkbox" checked={form.is_sponsored} onChange={e => setForm({ ...form, is_sponsored: e.target.checked })}
                  className="w-4 h-4 accent-brand-gold" />
                Sponsored
              </label>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 px-6 py-4 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded border border-white/15 text-white/70 text-xs font-bold uppercase tracking-wider hover:bg-white/5 transition">Cancel</button>
          <button onClick={handleAdd} disabled={saving} className="px-5 py-2 rounded bg-brand-neon text-black text-xs font-black uppercase tracking-wider hover:bg-cyan-300 transition disabled:opacity-50">
            {saving ? 'Adding...' : '+ Add Listing'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminDirectoryPage() {
  const router = useRouter()
  const locale = useLocale() as 'en' | 'es'
  const [isAdmin, setIsAdmin] = useState(false)
  const [listings, setListings] = useState<Listing[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [accessError, setAccessError] = useState('')
  const [search, setSearch] = useState('')
  const [filterTier, setFilterTier] = useState('')
  const [filterClaim, setFilterClaim] = useState('')
  const [filterSponsored, setFilterSponsored] = useState('')
  const [filterPublished, setFilterPublished] = useState('')
  const [editingListing, setEditingListing] = useState<Listing | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadListings = useCallback(async (params: {
    search?: string; tier?: string; claim?: string; sponsored?: string; published?: string
  } = {}) => {
    setIsLoading(true)
    try {
      const qs = new URLSearchParams()
      if (params.search) qs.set('search', params.search)
      if (params.tier) qs.set('tier', params.tier)
      if (params.claim) qs.set('claim_status', params.claim)
      if (params.sponsored) qs.set('is_sponsored', params.sponsored)
      if (params.published) qs.set('is_published', params.published)
      const res = await fetch(`/api/admin/directory?${qs}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load directory listings')
      }
      setListings(data.listings || [])
    } catch (e) {
      console.error('Failed to load directory listings', e)
      setNotice(e instanceof Error ? e.message : 'Failed to load directory listings')
    } finally { setIsLoading(false) }
  }, [])

  useEffect(() => {
    let cancelled = false

    const checkAdminAccess = async () => {
      setAccessError('')
      try {
        const { user, error } = await getUser()
        if (cancelled) return

        if (error || !user) {
          router.replace(withLocale(locale, '/login'))
          return
        }

        const res = await fetch('/api/profile', { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return

        if (res.status === 401) {
          router.replace(withLocale(locale, '/login'))
          return
        }

        if (!res.ok) {
          throw new Error(data.error || 'Failed to verify admin access')
        }

        if (!data.profile?.is_editor && !data.profile?.can_manage_platform) {
          router.replace(withLocale(locale, '/creator'))
          return
        }

        setIsAdmin(true)
        await loadListings()
      } catch (e) {
        console.error('Failed to verify directory admin access', e)
        if (!cancelled) {
          setAccessError(e instanceof Error ? e.message : 'Failed to verify admin access')
          setIsLoading(false)
        }
      }
    }

    checkAdminAccess()
    return () => { cancelled = true }
  }, [router, locale, loadListings])

  // Debounced search
  useEffect(() => {
    if (!isAdmin) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      loadListings({ search, tier: filterTier, claim: filterClaim, sponsored: filterSponsored, published: filterPublished })
    }, 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [isAdmin, search, filterTier, filterClaim, filterSponsored, filterPublished, loadListings])

  const handleSave = async (id: string, updates: Partial<Listing>) => {
    const res = await fetch(`/api/admin/directory/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Save failed') }
    const data = await res.json()
    setListings(prev => prev.map(l => l.id === id ? { ...l, ...data.listing } : l))
  }

  const handleAdd = async (form: typeof BLANK_FORM) => {
    const res = await fetch('/api/admin/directory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to add') }
    const data = await res.json()
    setListings(prev => [data.listing, ...prev])
  }

  const handleDelete = async (listing: Listing) => {
    if (!window.confirm(`Permanently delete "${listing.name}"? This cannot be undone.`)) return
    setActionLoading(listing.id)
    try {
      const res = await fetch(`/api/admin/directory/${listing.id}`, { method: 'DELETE' })
      if (!res.ok) { alert('Delete failed'); return }
      setListings(prev => prev.filter(l => l.id !== listing.id))
    } finally { setActionLoading(null) }
  }

  const quickToggle = async (listing: Listing, field: 'is_published' | 'is_sponsored' | 'tier') => {
    setActionLoading(`${listing.id}-${field}`)
    try {
      const value = field === 'tier'
        ? (listing.tier === 'basic' ? 'premium' : 'basic')
        : !listing[field]
      await handleSave(listing.id, { [field]: value })
    } finally { setActionLoading(null) }
  }

  const handlePublishAll = async () => {
    if (unpublished === 0) return
    if (!window.confirm(`Publish all ${unpublished} unlisted directory listing${unpublished === 1 ? '' : 's'}?`)) return

    setActionLoading('publish-all')
    setNotice('')
    try {
      const res = await fetch('/api/admin/directory/publish-all', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Publish all failed')

      setListings(prev => prev.map(listing => ({ ...listing, is_published: true })))
      setNotice(`Published ${data.published || 0} listing${data.published === 1 ? '' : 's'}.`)
    } catch (e: any) {
      setNotice(e.message || 'Publish all failed')
    } finally {
      setActionLoading(null)
    }
  }

  // Stats
  const total = listings.length
  const unclaimed = listings.filter(l => l.claim_status === 'unclaimed').length
  const premium = listings.filter(l => l.tier === 'premium').length
  const sponsored = listings.filter(l => l.is_sponsored).length
  const unpublished = listings.filter(l => !l.is_published).length

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-brand-dark text-white citybeat-app">
        <SiteHeader />
        <main className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4 py-12">
          <div className="w-full rounded-xl border border-white/10 bg-white/5 p-8 text-center">
            {accessError ? (
              <>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-magenta">Admin access error</p>
                <h1 className="mt-3 font-display text-3xl font-black uppercase tracking-tight">Directory Manager</h1>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/60">
                  {accessError}. Refresh the page or sign in again. If this keeps happening, the profile service needs attention.
                </p>
                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                  <button
                    onClick={() => window.location.reload()}
                    className="rounded-lg bg-brand-neon px-5 py-3 text-xs font-black uppercase tracking-wider text-black transition hover:bg-cyan-300"
                  >
                    Retry
                  </button>
                  <Link
                    href={withLocale(locale, '/login')}
                    className="rounded-lg border border-white/15 px-5 py-3 text-xs font-black uppercase tracking-wider text-white/70 transition hover:bg-white/5"
                  >
                    Sign In
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-neon">Checking access</p>
                <h1 className="mt-3 font-display text-3xl font-black uppercase tracking-tight">Directory Manager</h1>
                <p className="mt-3 text-sm text-white/50">Verifying your admin permissions...</p>
              </>
            )}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-dark text-white citybeat-app">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-10">

        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="mb-3">
              <Link href={withLocale(locale, '/admin')} className="text-sm font-bold uppercase tracking-wider text-brand-neon hover:text-cyan-300 transition">
                ← Admin Control
              </Link>
            </div>
            <h1 className="font-display text-4xl font-black tracking-tight uppercase">Directory Manager</h1>
            <p className="mt-1 text-white/50 text-sm">Add, edit, upgrade, verify, and delete business listings</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handlePublishAll}
              disabled={unpublished === 0 || actionLoading === 'publish-all'}
              className="flex-shrink-0 inline-flex items-center justify-center gap-2 rounded-lg border border-brand-neon/60 px-5 py-3 text-sm font-black uppercase tracking-wider text-brand-neon hover:bg-brand-neon/10 transition disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/30 disabled:hover:bg-transparent"
            >
              {actionLoading === 'publish-all' ? 'Publishing...' : 'Publish All'}
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex-shrink-0 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-neon px-5 py-3 text-sm font-black uppercase tracking-wider text-black hover:bg-cyan-300 transition shadow-[0_4px_16px_rgba(0,240,255,0.25)]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
              Add Listing
            </button>
          </div>
        </div>

        {notice && (
          <div className="mb-6 rounded-lg border border-brand-neon/30 bg-brand-neon/10 px-4 py-3 text-sm font-bold text-brand-neon">
            {notice}
          </div>
        )}

        {/* Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
          {[
            { label: 'Total Listings', value: total, color: 'text-white' },
            { label: 'Unclaimed', value: unclaimed, color: 'text-brand-gold' },
            { label: 'Premium', value: premium, color: 'text-brand-neon' },
            { label: 'Sponsored', value: sponsored, color: 'text-brand-gold' },
            { label: 'Unlisted', value: unpublished, color: 'text-brand-magenta' },
          ].map(stat => (
            <div key={stat.label} className="citybeat-panel rounded-xl p-4 border border-white/10">
              <p className="text-[10px] font-black uppercase tracking-wider text-white/40">{stat.label}</p>
              <p className={`text-3xl font-black mt-1 ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="citybeat-panel rounded-xl p-4 border border-white/10 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2 relative">
              <svg className="absolute left-3 top-2.5 h-4 w-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search name, address, category..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded border border-white/15 bg-black/40 text-sm text-white placeholder-white/30 focus:border-brand-neon focus:outline-none transition"
              />
            </div>
            <select value={filterTier} onChange={e => setFilterTier(e.target.value)}
              className="rounded border border-white/15 bg-brand-dark text-sm text-white/70 px-3 py-2 focus:border-brand-neon focus:outline-none transition">
              <option value="">All Tiers</option>
              <option value="basic">Basic</option>
              <option value="premium">Premium</option>
            </select>
            <select value={filterClaim} onChange={e => setFilterClaim(e.target.value)}
              className="rounded border border-white/15 bg-brand-dark text-sm text-white/70 px-3 py-2 focus:border-brand-neon focus:outline-none transition">
              <option value="">All Claim Status</option>
              <option value="unclaimed">Unclaimed</option>
              <option value="pending_approval">Pending</option>
              <option value="approved">Verified</option>
            </select>
            <select value={filterSponsored} onChange={e => setFilterSponsored(e.target.value)}
              className="rounded border border-white/15 bg-brand-dark text-sm text-white/70 px-3 py-2 focus:border-brand-neon focus:outline-none transition">
              <option value="">Sponsored: All</option>
              <option value="true">Sponsored Only</option>
              <option value="false">Not Sponsored</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="citybeat-panel rounded-2xl border border-white/10 overflow-hidden">
          {isLoading ? (
            <div className="py-24 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-neon mx-auto mb-3" />
              <p className="text-white/40 text-sm">Loading listings...</p>
            </div>
          ) : listings.length === 0 ? (
            <div className="py-24 text-center">
              <p className="text-white/30 text-4xl mb-3">🏪</p>
              <p className="text-white/40">No listings found matching your filters.</p>
              <button onClick={() => { setSearch(''); setFilterTier(''); setFilterClaim(''); setFilterSponsored(''); setFilterPublished('') }}
                className="mt-4 text-brand-neon text-xs font-bold uppercase tracking-wider hover:underline">
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] font-black uppercase tracking-wider text-brand-neon bg-black/20">
                    <th className="py-3 px-4">Business</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Tier</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Owner</th>
                    <th className="py-3 px-4 text-center">Pub</th>
                    <th className="py-3 px-4 text-center">Spon.</th>
                    <th className="py-3 px-4">Rating</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map(listing => (
                    <tr key={listing.id} className="border-b border-white/5 hover:bg-white/3 transition-colors group">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {listing.is_sponsored && (
                            <span className="text-brand-gold text-xs" title="Sponsored">★</span>
                          )}
                          <div>
                            <p className="font-bold text-sm text-white group-hover:text-brand-neon transition truncate max-w-[180px]">
                              {listing.name}
                            </p>
                            {listing.address && (
                              <p className="text-[10px] text-white/35 truncate max-w-[180px] mt-0.5">{listing.address}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[9px] font-black uppercase tracking-wider text-brand-neon bg-brand-neon/10 px-2 py-0.5 rounded">
                          {listing.category}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => quickToggle(listing, 'tier')}
                          disabled={actionLoading === `${listing.id}-tier`}
                          title="Click to toggle tier"
                          className="disabled:opacity-50"
                        >
                          <TierBadge tier={listing.tier} />
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <ClaimBadge status={listing.claim_status} />
                      </td>
                      <td className="py-3 px-4">
                        {listing.profiles ? (
                          <div>
                            <p className="text-xs text-white/70 truncate max-w-[150px]">{listing.profiles.full_name || listing.profiles.email}</p>
                            <p className="text-[9px] text-white/30 truncate max-w-[150px]">{listing.profiles.email}</p>
                          </div>
                        ) : (
                          <span className="text-[10px] text-white/25 italic">No owner</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => quickToggle(listing, 'is_published')}
                          disabled={actionLoading === `${listing.id}-is_published`}
                          title={listing.is_published ? 'Published — click to unpublish' : 'Hidden — click to publish'}
                          className="text-lg disabled:opacity-50 transition-transform hover:scale-110"
                        >
                          {listing.is_published ? '🟢' : '🔴'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => quickToggle(listing, 'is_sponsored')}
                          disabled={actionLoading === `${listing.id}-is_sponsored`}
                          title={listing.is_sponsored ? 'Sponsored — click to remove' : 'Not sponsored — click to sponsor'}
                          className="text-lg disabled:opacity-50 transition-transform hover:scale-110"
                        >
                          {listing.is_sponsored ? '⭐' : '☆'}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        {listing.rating ? (
                          <div>
                            <span className="text-brand-gold font-bold text-xs">★ {listing.rating.toFixed(1)}</span>
                            <span className="text-white/30 text-[9px] ml-1">({listing.user_ratings_total})</span>
                          </div>
                        ) : (
                          <span className="text-white/20 text-[10px]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 justify-end">
                          <Link
                            href={`/${locale}/directory/${listing.id}`}
                            target="_blank"
                            title="View public listing"
                            className="p-1.5 rounded border border-white/10 hover:border-white/30 text-white/50 hover:text-white transition text-xs"
                          >
                            👁
                          </Link>
                          <button
                            onClick={() => setEditingListing(listing)}
                            title="Edit listing"
                            className="p-1.5 rounded border border-white/10 hover:border-brand-neon/50 text-white/50 hover:text-brand-neon transition text-xs"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(listing)}
                            disabled={actionLoading === listing.id}
                            title="Delete listing"
                            className="p-1.5 rounded border border-white/10 hover:border-brand-magenta/50 text-white/50 hover:text-brand-magenta transition text-xs disabled:opacity-50"
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-white/5 px-4 py-3 text-[11px] text-white/30 font-mono">
                Showing {listings.length} listing{listings.length !== 1 ? 's' : ''}
              </div>
            </div>
          )}
        </div>

      </main>

      {editingListing && (
        <EditModal
          listing={editingListing}
          onClose={() => setEditingListing(null)}
          onSave={handleSave}
        />
      )}

      {showAddModal && (
        <AddModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAdd}
        />
      )}
    </div>
  )
}
