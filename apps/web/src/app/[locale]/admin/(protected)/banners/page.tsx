'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { SiteHeader } from '@/components/citybeat/SiteHeader'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'

interface Banner {
  id: string
  sponsor_name: string | null
  title: string | null
  description: string | null
  image_url: string | null
  link_url: string | null
  placement: 'home_top' | 'directory' | 'sidebar'
  locale: 'all' | 'en' | 'es'
  priority: number
  is_active: boolean
}

const BLANK = {
  sponsor_name: '',
  title: '',
  description: '',
  image_url: '',
  link_url: '',
  placement: 'home_top' as Banner['placement'],
  locale: 'all' as Banner['locale'],
  priority: 0,
  is_active: true,
}

const PLACEMENTS: Banner['placement'][] = ['home_top', 'directory', 'sidebar']
const PLACEMENT_LABEL: Record<Banner['placement'], string> = {
  home_top: 'Homepage (top)',
  directory: 'Directory page',
  sidebar: 'Sidebar',
}

export default function AdminBannersPage() {
  const locale = useLocale()
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ ...BLANK })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/banners', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401 || res.status === 403) {
        setError('Godmode (developer) access required to manage banners.')
        setBanners([])
        return
      }
      if (!res.ok) throw new Error(data.error || 'Failed to load banners')
      setBanners(data.banners || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load banners')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload/image', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setForm((f) => ({ ...f, image_url: data.url }))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const resetForm = () => {
    setForm({ ...BLANK })
    setEditingId(null)
  }

  const save = async () => {
    setSaving(true)
    try {
      const url = editingId ? `/api/admin/banners/${editingId}` : '/api/admin/banners'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Save failed')
      resetForm()
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (b: Banner) => {
    await fetch(`/api/admin/banners/${b.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !b.is_active }),
    })
    await load()
  }

  const remove = async (b: Banner) => {
    if (!confirm(`Delete banner "${b.sponsor_name || b.title || b.id}"?`)) return
    await fetch(`/api/admin/banners/${b.id}`, { method: 'DELETE' })
    if (editingId === b.id) resetForm()
    await load()
  }

  const edit = (b: Banner) => {
    setEditingId(b.id)
    setForm({
      sponsor_name: b.sponsor_name || '',
      title: b.title || '',
      description: b.description || '',
      image_url: b.image_url || '',
      link_url: b.link_url || '',
      placement: b.placement,
      locale: b.locale,
      priority: b.priority || 0,
      is_active: b.is_active,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const inputClass =
    'w-full rounded-md p-2.5 border border-white/15 bg-black/40 text-white text-sm focus:border-brand-neon focus:outline-none transition'

  return (
    <div className="citybeat-app min-h-screen">
      <SiteHeader />
      <div className="container-wide py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-neon">Godmode</p>
            <h1 className="font-display text-3xl font-black uppercase text-white">Ad Banner Manager</h1>
          </div>
          <Link href={withLocale(locale, '/admin')} className="text-xs font-bold uppercase tracking-wider text-white/60 hover:text-white">
            ← Admin
          </Link>
        </div>

        {error ? (
          <div className="citybeat-panel rounded-2xl p-8 border border-brand-magenta/30 text-center">
            <p className="text-brand-magenta font-bold">{error}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-8">
            {/* Create / Edit form */}
            <div className="citybeat-panel rounded-2xl p-6 border border-white/10 h-fit">
              <h2 className="font-display text-lg font-bold uppercase text-white mb-4">
                {editingId ? 'Edit Banner' : 'New Banner'}
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-neon mb-1">Sponsor name</label>
                  <input className={inputClass} value={form.sponsor_name} onChange={(e) => setForm({ ...form, sponsor_name: e.target.value })} placeholder="Mountain Star Credit Union" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-neon mb-1">Title</label>
                  <input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Banking Built for El Paso" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-neon mb-1">Description</label>
                  <textarea rows={3} className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-neon mb-1">Link URL</label>
                  <input className={inputClass} value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="https://..." />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-neon mb-1">Image</label>
                  <div className="flex items-center gap-3">
                    <label className="rounded bg-white/10 hover:bg-white/15 text-white font-bold uppercase tracking-wider text-[11px] px-3 py-2 cursor-pointer transition">
                      {uploading ? 'Uploading…' : '📷 Upload'}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
                    </label>
                    {form.image_url && <span className="text-[10px] text-brand-neon truncate">image set ✓</span>}
                  </div>
                  <input className={`${inputClass} mt-2`} value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="or paste an image URL" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-neon mb-1">Placement</label>
                    <select className={inputClass} value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value as Banner['placement'] })}>
                      {PLACEMENTS.map((p) => <option key={p} value={p}>{PLACEMENT_LABEL[p]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-neon mb-1">Locale</label>
                    <select className={inputClass} value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value as Banner['locale'] })}>
                      <option value="all">All</option>
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 items-end">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-brand-neon mb-1">Priority</label>
                    <input type="number" className={inputClass} value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-white/80 pb-2.5">
                    <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="accent-brand-neon" />
                    Active
                  </label>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={save} disabled={saving} className="flex-1 rounded bg-brand-neon text-black font-black uppercase tracking-wider text-xs py-3 hover:bg-cyan-300 transition disabled:opacity-50">
                    {saving ? 'Saving…' : editingId ? 'Update Banner' : 'Create Banner'}
                  </button>
                  {editingId && (
                    <button onClick={resetForm} className="rounded border border-white/20 text-white/70 font-bold uppercase tracking-wider text-xs px-4 hover:bg-white/5 transition">
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Banner list */}
            <div className="space-y-3">
              {loading ? (
                <p className="text-white/50 text-sm">Loading…</p>
              ) : banners.length === 0 ? (
                <p className="text-white/50 text-sm">No banners yet. Create one on the left.</p>
              ) : (
                banners.map((b) => (
                  <div key={b.id} className="citybeat-panel rounded-xl p-4 border border-white/10 flex items-center gap-4">
                    {b.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.image_url} alt="" className="w-24 h-16 object-cover rounded flex-shrink-0" />
                    ) : (
                      <div className="w-24 h-16 rounded bg-white/5 flex-shrink-0 flex items-center justify-center text-white/30 text-xs">no image</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-wider text-brand-neon truncate">{b.sponsor_name || '—'}</span>
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${b.is_active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-white/40'}`}>
                          {b.is_active ? 'Active' : 'Off'}
                        </span>
                      </div>
                      <p className="text-sm text-white/85 truncate">{b.title || '(no title)'}</p>
                      <p className="text-[10px] text-white/40 mt-0.5">{PLACEMENT_LABEL[b.placement] || b.placement} · {b.locale} · priority {b.priority}{b.link_url ? '' : ' · no link'}</p>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <button onClick={() => edit(b)} className="text-[10px] font-bold uppercase tracking-wider text-white/70 hover:text-white">Edit</button>
                      <button onClick={() => toggleActive(b)} className="text-[10px] font-bold uppercase tracking-wider text-brand-neon hover:text-cyan-300">{b.is_active ? 'Disable' : 'Enable'}</button>
                      <button onClick={() => remove(b)} className="text-[10px] font-bold uppercase tracking-wider text-brand-magenta hover:text-red-400">Delete</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
