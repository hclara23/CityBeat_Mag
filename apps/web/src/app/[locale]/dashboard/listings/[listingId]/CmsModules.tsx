'use client'

// Owner-CMS content-module editors: services/products, posts & offers, business
// attributes, action links, special hours, review replies, and team management.
// All persistence flows through the parent's entitlement-gated autosave (PATCH)
// except reviews + team, which use their dedicated audited routes.

import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import {
  ACTION_LINK_KEYS,
  ACTION_LINK_LABELS,
  ATTRIBUTE_DEFS,
  elPasoDayKey,
  postStatus,
  type ActionLinks,
  type ListingPost,
  type ListingServiceItem,
  type SpecialHour,
} from '@/lib/listing-content'

const inputClass =
  'w-full rounded-md p-2.5 border border-white/15 bg-black/40 text-white text-sm focus:border-brand-neon focus:outline-none transition'
const smallLabel = 'block text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1'

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// ── Services / Products (same shape) ─────────────────────────────────────────

export function ItemsEditor({
  items,
  onChange,
  isEs,
  kind,
  max,
}: {
  items: ListingServiceItem[]
  onChange: (next: ListingServiceItem[]) => void
  isEs: boolean
  kind: 'service' | 'product'
  max: number
}) {
  const empty = items.length === 0
  const addLabel =
    kind === 'service'
      ? isEs ? '+ Agregar servicio' : '+ Add service'
      : isEs ? '+ Agregar producto' : '+ Add product'

  const update = (id: string, patch: Partial<ListingServiceItem>) =>
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)))

  return (
    <div className="space-y-4">
      {empty && (
        <p className="text-sm text-white/45">
          {kind === 'service'
            ? isEs
              ? 'Publica tus servicios con precios para que los clientes lleguen listos para comprar.'
              : 'List your services with prices so customers arrive ready to buy.'
            : isEs
              ? 'Publica productos o tu menú para que los clientes sepan qué ofreces.'
              : 'List products or your menu so customers know what you offer.'}
        </p>
      )}
      {items.map((item) => (
        <div key={item.id} className="rounded-lg border border-white/10 bg-black/25 p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_120px]">
            <div>
              <label className={smallLabel}>{isEs ? 'Nombre (inglés)' : 'Name (English)'}</label>
              <input className={inputClass} value={item.name} maxLength={120} onChange={(e) => update(item.id, { name: e.target.value })} />
            </div>
            <div>
              <label className={smallLabel}>{isEs ? 'Nombre (español)' : 'Name (Spanish)'}</label>
              <input className={inputClass} value={item.name_es || ''} maxLength={120} onChange={(e) => update(item.id, { name_es: e.target.value })} />
            </div>
            <div>
              <label className={smallLabel}>{isEs ? 'Precio' : 'Price'}</label>
              <input className={inputClass} value={item.price_label || ''} maxLength={40} placeholder="$25" onChange={(e) => update(item.id, { price_label: e.target.value })} />
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className={smallLabel}>{isEs ? 'Descripción (inglés)' : 'Description (English)'}</label>
              <textarea rows={2} className={inputClass} value={item.description || ''} maxLength={400} onChange={(e) => update(item.id, { description: e.target.value })} />
            </div>
            <div>
              <label className={smallLabel}>{isEs ? 'Descripción (español)' : 'Description (Spanish)'}</label>
              <textarea rows={2} className={inputClass} value={item.description_es || ''} maxLength={400} onChange={(e) => update(item.id, { description_es: e.target.value })} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange(items.filter((it) => it.id !== item.id))}
            className="mt-3 text-[10px] font-black uppercase tracking-wider text-red-400/80 hover:text-red-300"
          >
            {isEs ? 'Eliminar' : 'Remove'}
          </button>
        </div>
      ))}
      {items.length < max && (
        <button
          type="button"
          onClick={() =>
            onChange([
              ...items,
              { id: newId(kind === 'service' ? 'svc' : 'prod'), name: '', name_es: '', price_label: '', description: '', description_es: '' },
            ])
          }
          className="rounded-md border border-brand-neon/40 px-4 py-2 text-xs font-black uppercase tracking-wider text-brand-neon transition hover:bg-brand-neon/10"
        >
          {addLabel}
        </button>
      )}
      <p className="text-[10px] text-white/30">
        {items.length} / {max}
      </p>
    </div>
  )
}

// ── Posts, offers & events ───────────────────────────────────────────────────

const POST_TYPES: { key: ListingPost['type']; en: string; es: string }[] = [
  { key: 'update', en: 'Update', es: 'Novedad' },
  { key: 'offer', en: 'Offer', es: 'Oferta' },
  { key: 'event', en: 'Event', es: 'Evento' },
]

export function PostsEditor({
  posts,
  onChange,
  isEs,
  max,
}: {
  posts: ListingPost[]
  onChange: (next: ListingPost[]) => void
  isEs: boolean
  max: number
}) {
  const update = (id: string, patch: Partial<ListingPost>) =>
    onChange(posts.map((p) => (p.id === id ? { ...p, ...patch } : p)))

  const statusChip = (post: ListingPost) => {
    const s = postStatus(post, elPasoDayKey(new Date()))
    const map = {
      active: { en: 'Live', es: 'Activo', cls: 'bg-brand-neon/15 text-brand-neon' },
      scheduled: { en: 'Scheduled', es: 'Programado', cls: 'bg-amber-400/15 text-amber-300' },
      expired: { en: 'Expired', es: 'Expirado', cls: 'bg-white/10 text-white/40' },
    }[s]
    return <span className={`rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${map.cls}`}>{isEs ? map.es : map.en}</span>
  }

  return (
    <div className="space-y-4">
      {posts.length === 0 && (
        <p className="text-sm text-white/45">
          {isEs
            ? 'Publica ofertas, eventos y novedades que aparecen en tu ficha pública.'
            : 'Publish offers, events, and updates that appear on your public listing.'}
        </p>
      )}
      {posts.map((post) => (
        <div key={post.id} className="rounded-lg border border-white/10 bg-black/25 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1.5">
              {POST_TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => update(post.id, { type: t.key })}
                  className={`rounded px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition ${
                    post.type === t.key ? 'bg-brand-neon text-black' : 'bg-white/5 text-white/50 hover:text-white'
                  }`}
                >
                  {isEs ? t.es : t.en}
                </button>
              ))}
            </div>
            {statusChip(post)}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={smallLabel}>{isEs ? 'Título (inglés)' : 'Title (English)'}</label>
              <input className={inputClass} value={post.title} maxLength={140} onChange={(e) => update(post.id, { title: e.target.value })} />
            </div>
            <div>
              <label className={smallLabel}>{isEs ? 'Título (español)' : 'Title (Spanish)'}</label>
              <input className={inputClass} value={post.title_es || ''} maxLength={140} onChange={(e) => update(post.id, { title_es: e.target.value })} />
            </div>
            <div>
              <label className={smallLabel}>{isEs ? 'Texto (inglés)' : 'Body (English)'}</label>
              <textarea rows={2} className={inputClass} value={post.body || ''} maxLength={1000} onChange={(e) => update(post.id, { body: e.target.value })} />
            </div>
            <div>
              <label className={smallLabel}>{isEs ? 'Texto (español)' : 'Body (Spanish)'}</label>
              <textarea rows={2} className={inputClass} value={post.body_es || ''} maxLength={1000} onChange={(e) => update(post.id, { body_es: e.target.value })} />
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label className={smallLabel}>{isEs ? 'Empieza' : 'Starts'}</label>
              <input type="date" className={inputClass} value={post.starts_at || ''} onChange={(e) => update(post.id, { starts_at: e.target.value || null })} />
            </div>
            <div>
              <label className={smallLabel}>{isEs ? 'Termina' : 'Ends'}</label>
              <input type="date" className={inputClass} value={post.ends_at || ''} onChange={(e) => update(post.id, { ends_at: e.target.value || null })} />
            </div>
            <div>
              <label className={smallLabel}>{isEs ? 'Enlace (opcional)' : 'Link (optional)'}</label>
              <input className={inputClass} value={post.cta_url || ''} maxLength={300} placeholder="https://…" onChange={(e) => update(post.id, { cta_url: e.target.value || null })} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange(posts.filter((p) => p.id !== post.id))}
            className="mt-3 text-[10px] font-black uppercase tracking-wider text-red-400/80 hover:text-red-300"
          >
            {isEs ? 'Eliminar' : 'Remove'}
          </button>
        </div>
      ))}
      {posts.length < max && (
        <button
          type="button"
          onClick={() =>
            onChange([
              ...posts,
              {
                id: newId('post'),
                type: 'update',
                title: '',
                title_es: '',
                body: '',
                body_es: '',
                starts_at: null,
                ends_at: null,
                cta_url: null,
                created_at: new Date().toISOString(),
              },
            ])
          }
          className="rounded-md border border-brand-neon/40 px-4 py-2 text-xs font-black uppercase tracking-wider text-brand-neon transition hover:bg-brand-neon/10"
        >
          {isEs ? '+ Nueva publicación' : '+ New post'}
        </button>
      )}
    </div>
  )
}

// ── Business attributes ──────────────────────────────────────────────────────

export function AttributesEditor({
  selected,
  onChange,
  isEs,
  disabled,
}: {
  selected: string[]
  onChange: (next: string[]) => void
  isEs: boolean
  disabled?: boolean
}) {
  const toggle = (key: string) =>
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key])
  return (
    <div className="flex flex-wrap gap-2">
      {ATTRIBUTE_DEFS.map((attr) => {
        const active = selected.includes(attr.key)
        return (
          <button
            key={attr.key}
            type="button"
            disabled={disabled}
            onClick={() => toggle(attr.key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              active
                ? 'border-brand-neon bg-brand-neon/15 text-brand-neon'
                : 'border-white/15 bg-white/5 text-white/55 hover:border-white/35 hover:text-white'
            } disabled:cursor-not-allowed`}
          >
            {active ? '✓ ' : ''}
            {isEs ? attr.es : attr.en}
          </button>
        )
      })}
    </div>
  )
}

// ── Action links ─────────────────────────────────────────────────────────────

export function ActionLinksEditor({
  links,
  onChange,
  isEs,
  disabled,
}: {
  links: ActionLinks
  onChange: (next: ActionLinks) => void
  isEs: boolean
  disabled?: boolean
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {ACTION_LINK_KEYS.map((key) => (
        <div key={key}>
          <label className={smallLabel}>{ACTION_LINK_LABELS[key][isEs ? 'es' : 'en']}</label>
          <input
            className={inputClass}
            disabled={disabled}
            value={links[key] || ''}
            maxLength={300}
            placeholder="https://…"
            onChange={(e) => {
              const next = { ...links }
              if (e.target.value.trim()) next[key] = e.target.value
              else delete next[key]
              onChange(next)
            }}
          />
        </div>
      ))}
    </div>
  )
}

// ── Special hours (holiday hours / temporary closures) ───────────────────────

export function SpecialHoursEditor({
  rows,
  onChange,
  isEs,
  max,
}: {
  rows: SpecialHour[]
  onChange: (next: SpecialHour[]) => void
  isEs: boolean
  max: number
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-white/45">
        {isEs
          ? 'Días festivos o cierres temporales — anulan el horario normal de esa fecha.'
          : 'Holidays or temporary closures — these override your standard hours for that date.'}
      </p>
      {rows.map((row, i) => (
        <div key={`${row.date}-${i}`} className="flex items-center gap-2">
          <input
            type="date"
            className={`${inputClass} w-40`}
            value={row.date}
            onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, date: e.target.value } : r)))}
          />
          <input
            className={inputClass}
            value={row.hours}
            maxLength={60}
            placeholder={isEs ? 'p. ej. Cerrado / 9 AM - 1 PM' : 'e.g. Closed / 9 AM - 1 PM'}
            onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, hours: e.target.value } : r)))}
          />
          <button
            type="button"
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
            className="flex-shrink-0 text-xs font-black text-red-400/80 hover:text-red-300"
            aria-label={isEs ? 'Eliminar' : 'Remove'}
          >
            ✕
          </button>
        </div>
      ))}
      {rows.length < max && (
        <button
          type="button"
          onClick={() => onChange([...rows, { date: '', hours: '' }])}
          className="rounded-md border border-white/20 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white/60 transition hover:border-brand-neon/50 hover:text-brand-neon"
        >
          {isEs ? '+ Agregar fecha' : '+ Add date'}
        </button>
      )}
    </div>
  )
}

// ── Reviews manager (list + reply) ───────────────────────────────────────────

type ReviewRow = {
  id: string
  rating: number
  comment?: string | null
  created_at?: string | null
  owner_response?: string | null
  profiles?: { full_name?: string | null } | null
}

export function ReviewsManager({ listingId, isEs }: { listingId: string; isEs: boolean }) {
  const [reviews, setReviews] = useState<ReviewRow[] | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState('')
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/directory/${listingId}/reviews`)
      const data = await res.json().catch(() => ({}))
      setReviews(res.ok ? data.reviews || [] : [])
    } catch {
      setReviews([])
    }
  }, [listingId])

  useEffect(() => {
    void load()
  }, [load])

  const reply = async (reviewId: string) => {
    setSaving(reviewId)
    setMsg('')
    try {
      const res = await fetch(`/api/directory/${listingId}/reviews/${reviewId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: drafts[reviewId] || '' }),
      })
      if (!res.ok) throw new Error()
      setMsg(isEs ? 'Respuesta publicada.' : 'Reply published.')
      await load()
    } catch {
      setMsg(isEs ? 'No se pudo publicar la respuesta.' : 'Could not publish the reply.')
    } finally {
      setSaving('')
    }
  }

  if (reviews === null) return <p className="text-sm text-white/40">{isEs ? 'Cargando reseñas…' : 'Loading reviews…'}</p>
  if (reviews.length === 0)
    return <p className="text-sm text-white/45">{isEs ? 'Aún no hay reseñas.' : 'No reviews yet.'}</p>

  return (
    <div className="space-y-5">
      {msg && <p className="text-xs font-bold text-brand-neon">{msg}</p>}
      {reviews.map((rev) => (
        <div key={rev.id} className="rounded-lg border border-white/10 bg-black/25 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-white">{rev.profiles?.full_name || (isEs ? 'Anónimo' : 'Anonymous')}</p>
            <span className="text-xs font-black text-brand-gold">{'★'.repeat(Math.max(1, Math.min(5, rev.rating || 0)))}</span>
          </div>
          {rev.comment && <p className="mt-2 text-sm leading-relaxed text-white/70">{rev.comment}</p>}
          <div className="mt-3 border-t border-white/5 pt-3">
            <label className={smallLabel}>{isEs ? 'Tu respuesta pública' : 'Your public reply'}</label>
            <textarea
              rows={2}
              className={inputClass}
              maxLength={1000}
              value={drafts[rev.id] ?? rev.owner_response ?? ''}
              onChange={(e) => setDrafts((d) => ({ ...d, [rev.id]: e.target.value }))}
            />
            <button
              type="button"
              disabled={saving === rev.id}
              onClick={() => reply(rev.id)}
              className="mt-2 rounded-md bg-brand-neon px-4 py-1.5 text-[10px] font-black uppercase tracking-wider text-black transition hover:bg-cyan-300 disabled:opacity-50"
            >
              {saving === rev.id ? (isEs ? 'Publicando…' : 'Publishing…') : isEs ? 'Publicar respuesta' : 'Publish reply'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Notification preferences ─────────────────────────────────────────────────

type NotifyPrefsState = { activity_email: boolean; monthly_report: boolean; sms_opt_in: boolean }

export function NotifyPrefsPanel({ isEs }: { isEs: boolean }) {
  const [prefs, setPrefs] = useState<NotifyPrefsState | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    fetch('/api/notifications/prefs')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d?.prefs) setPrefs(d.prefs)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const toggle = async (key: keyof NotifyPrefsState) => {
    if (!prefs) return
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    setSaving(true)
    try {
      await fetch('/api/notifications/prefs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: next[key] }),
      })
    } catch {
      setPrefs(prefs) // revert on failure
    } finally {
      setSaving(false)
    }
  }

  if (!prefs) return <p className="text-xs text-white/40">{isEs ? 'Cargando preferencias…' : 'Loading preferences…'}</p>

  const rows: { key: keyof NotifyPrefsState; en: string; es: string; note?: { en: string; es: string } }[] = [
    { key: 'activity_email', en: 'Email me about reviews, leads, and account activity', es: 'Enviarme correos de reseñas, clientes y actividad' },
    { key: 'monthly_report', en: 'Email me the monthly performance report', es: 'Enviarme el informe mensual de rendimiento' },
    {
      key: 'sms_opt_in',
      en: 'Text me urgent alerts (opt-in)',
      es: 'Enviarme alertas urgentes por SMS (requiere aceptación)',
      note: { en: 'Off unless you turn it on.', es: 'Desactivado a menos que lo actives.' },
    },
  ]

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <label key={row.key} className="flex cursor-pointer items-start justify-between gap-4">
          <span>
            <span className="block text-sm text-white/80">{isEs ? row.es : row.en}</span>
            {row.note && <span className="block text-[10px] text-white/35">{isEs ? row.note.es : row.note.en}</span>}
          </span>
          <input
            type="checkbox"
            checked={prefs[row.key]}
            disabled={saving}
            onChange={() => toggle(row.key)}
            className="mt-1 h-4 w-4 accent-brand-neon"
          />
        </label>
      ))}
    </div>
  )
}

// ── Listing analytics ────────────────────────────────────────────────────────

type StatTotals = {
  view: number
  click_website: number
  click_directions: number
  click_action: number
  lead: number
}

type AnalyticsData = {
  window_days: number
  current: StatTotals
  previous?: StatTotals
  series?: { day: string; view: number; lead: number; clicks: number }[]
  full: boolean
}

function pct(current: number, previous: number): string | null {
  if (previous <= 0) return current > 0 ? null : '0%'
  const p = Math.round(((current - previous) / previous) * 100)
  return `${p > 0 ? '+' : ''}${p}%`
}

function StatCard({
  label,
  value,
  change,
  isEs,
}: {
  label: string
  value: number
  change?: string | null
  isEs: boolean
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-4">
      <p className="text-[10px] font-black uppercase tracking-wider text-white/40">{label}</p>
      <p className="mt-1 font-display text-3xl font-black text-white">{value.toLocaleString()}</p>
      {change !== undefined && (
        <p className={`mt-1 text-xs font-bold ${change === null ? 'text-brand-neon' : change.startsWith('-') ? 'text-red-400' : 'text-brand-neon'}`}>
          {change === null ? (isEs ? 'Nuevo' : 'New') : `${change} ${isEs ? 'vs 30 días previos' : 'vs prior 30 days'}`}
        </p>
      )}
    </div>
  )
}

export function AnalyticsPanel({
  listingId,
  isEs,
  canExport,
}: {
  listingId: string
  isEs: boolean
  canExport: boolean
}) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    fetch(`/api/directory/${listingId}/analytics`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (active) setData(d)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [listingId])

  if (failed) return <p className="text-sm text-white/45">{isEs ? 'No se pudieron cargar las analíticas.' : 'Could not load analytics.'}</p>
  if (!data) return <p className="text-sm text-white/40">{isEs ? 'Cargando analíticas…' : 'Loading analytics…'}</p>

  const clicks = (t: StatTotals) => t.click_website + t.click_directions + t.click_action
  const cur = data.current
  const prev = data.previous
  const maxView = data.series ? Math.max(1, ...data.series.map((d) => d.view)) : 1

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={isEs ? 'Visitas (30 días)' : 'Views (30 days)'}
          value={cur.view}
          change={prev ? pct(cur.view, prev.view) : undefined}
          isEs={isEs}
        />
        <StatCard
          label={isEs ? 'Clics (web, mapa, acciones)' : 'Clicks (web, map, actions)'}
          value={clicks(cur)}
          change={prev ? pct(clicks(cur), clicks(prev)) : undefined}
          isEs={isEs}
        />
        <StatCard
          label={isEs ? 'Solicitudes de clientes' : 'Customer leads'}
          value={cur.lead}
          change={prev ? pct(cur.lead, prev.lead) : undefined}
          isEs={isEs}
        />
      </div>

      {data.full && data.series && (
        <div className="rounded-xl border border-white/10 bg-black/25 p-4">
          <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-white/40">
            {isEs ? 'Visitas diarias (30 días)' : 'Daily views (30 days)'}
          </p>
          <div className="flex h-28 items-end gap-[2px]" role="img" aria-label={isEs ? 'Gráfica de visitas diarias' : 'Daily views chart'}>
            {data.series.map((d) => (
              <div
                key={d.day}
                title={`${d.day}: ${d.view}`}
                className="flex-1 rounded-t-sm bg-brand-neon/70 transition hover:bg-brand-neon"
                style={{ height: `${Math.max(3, Math.round((d.view / maxView) * 100))}%` }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {canExport ? (
          <a
            href={`/api/directory/${listingId}/analytics?format=csv`}
            className="rounded-md border border-brand-neon/40 px-4 py-2 text-xs font-black uppercase tracking-wider text-brand-neon transition hover:bg-brand-neon/10"
          >
            {isEs ? '⬇ Exportar CSV' : '⬇ Export CSV'}
          </a>
        ) : (
          <p className="text-xs text-white/35">
            {isEs ? 'El historial completo y la exportación vienen con Premium.' : 'Full history and export come with Premium.'}
          </p>
        )}
        <p className="text-[10px] text-white/30">
          {isEs
            ? 'Sin identidad de visitantes — solo totales diarios. Tu propio tráfico no cuenta.'
            : 'No visitor identity — daily totals only. Your own traffic is excluded.'}
        </p>
      </div>
    </div>
  )
}

// ── Review-request QR (printable/shareable) ──────────────────────────────────

export function ReviewQr({ listingId, locale, isEs }: { listingId: string; locale: 'en' | 'es'; isEs: boolean }) {
  const [dataUrl, setDataUrl] = useState('')
  const [url, setUrl] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const target = `${window.location.origin}/${locale}/directory/${listingId}#reviews`
    setUrl(target)
    QRCode.toDataURL(target, { width: 320, margin: 2, errorCorrectionLevel: 'M' })
      .then(setDataUrl)
      .catch(() => setDataUrl(''))
  }, [listingId, locale])

  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-black/25 p-5">
      <h3 className="text-sm font-black uppercase tracking-wider text-brand-neon">
        {isEs ? 'Código QR para pedir reseñas' : 'Review-request QR'}
      </h3>
      <p className="mt-1 text-xs text-white/55">
        {isEs
          ? 'Imprímelo o compártelo. Tus clientes lo escanean y dejan una reseña en tu ficha.'
          : 'Print it or share it. Customers scan it and leave a review on your listing.'}
      </p>
      {dataUrl && (
        <div className="mt-3 flex flex-wrap items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUrl} alt="Review QR" className="h-32 w-32 rounded bg-white p-2" />
          <div className="flex flex-col gap-2 text-xs">
            <a
              href={dataUrl}
              download={`citybeat-review-qr.png`}
              className="rounded-md border border-brand-neon/40 px-3 py-1.5 font-black uppercase tracking-wider text-brand-neon hover:bg-brand-neon/10"
            >
              {isEs ? '⬇ Descargar PNG' : '⬇ Download PNG'}
            </a>
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-white/50 underline">
              {isEs ? 'Abrir enlace' : 'Open link'}
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Category benchmarks (Featured) ───────────────────────────────────────────

type Benchmark =
  | { available: false; reason: string; category: string }
  | {
      available: true
      category: string
      cohort: number
      avg_rating: number | null
      your_rating: number | null
      avg_reviews: number
      your_reviews: number
      avg_views30: number
      your_views30: number
      rating_percentile: number | null
    }

function BenchRow({ label, you, avg, isEs }: { label: string; you: number | string; avg: number | string; isEs: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-2 text-sm">
      <span className="text-white/60">{label}</span>
      <span className="flex gap-4">
        <span className="font-bold text-brand-neon">
          {isEs ? 'Tú' : 'You'}: {you}
        </span>
        <span className="text-white/50">
          {isEs ? 'Categoría' : 'Category'}: {avg}
        </span>
      </span>
    </div>
  )
}

export function BenchmarksPanel({ listingId, isEs, entitled }: { listingId: string; isEs: boolean; entitled: boolean }) {
  const [data, setData] = useState<Benchmark | null>(null)

  useEffect(() => {
    if (!entitled) return
    fetch(`/api/directory/${listingId}/benchmarks`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {})
  }, [listingId, entitled])

  if (!entitled) {
    return (
      <p className="text-sm text-white/45">
        {isEs
          ? 'Las comparativas con tu categoría vienen con Featured.'
          : 'Category benchmarks come with Featured.'}
      </p>
    )
  }
  if (!data) return <p className="text-sm text-white/40">{isEs ? 'Cargando comparativas…' : 'Loading benchmarks…'}</p>
  if (!data.available) {
    return (
      <p className="text-sm text-white/45">
        {isEs
          ? 'Aún no hay suficientes negocios en tu categoría para comparar de forma anónima.'
          : 'Not enough businesses in your category yet to compare anonymously.'}
      </p>
    )
  }

  return (
    <div>
      <p className="mb-3 text-xs text-white/40">
        {isEs ? `Comparado con ${data.cohort} negocios de tu categoría` : `Compared with ${data.cohort} businesses in your category`}
      </p>
      <BenchRow label={isEs ? 'Vistas (30 días)' : 'Views (30 days)'} you={data.your_views30} avg={data.avg_views30} isEs={isEs} />
      <BenchRow
        label={isEs ? 'Calificación' : 'Rating'}
        you={data.your_rating ?? '—'}
        avg={data.avg_rating ?? '—'}
        isEs={isEs}
      />
      <BenchRow label={isEs ? 'Reseñas' : 'Reviews'} you={data.your_reviews} avg={data.avg_reviews} isEs={isEs} />
      {data.rating_percentile != null && (
        <p className="mt-3 text-xs font-bold text-brand-neon">
          {isEs
            ? `Tu calificación supera al ${data.rating_percentile}% de tu categoría.`
            : `Your rating beats ${data.rating_percentile}% of your category.`}
        </p>
      )}
    </div>
  )
}

// ── Team & access (managers) ─────────────────────────────────────────────────

type ManagerRow = { user_id: string; email: string | null; name: string | null }

export function TeamManager({
  listingId,
  isEs,
  isOwner,
}: {
  listingId: string
  isEs: boolean
  isOwner: boolean
}) {
  const [managers, setManagers] = useState<ManagerRow[] | null>(null)
  const [limit, setLimit] = useState(0)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/directory/${listingId}/managers`)
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setManagers(data.managers || [])
        setLimit(data.limit || 0)
      } else {
        setManagers([])
      }
    } catch {
      setManagers([])
    }
  }, [listingId])

  useEffect(() => {
    void load()
  }, [load])

  const add = async () => {
    setBusy(true)
    setMsg('')
    try {
      const res = await fetch(`/api/directory/${listingId}/managers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg(
          data.code === 'no_account'
            ? isEs
              ? 'Esa persona aún no tiene cuenta de CityBeat. Pídele crear una cuenta gratis primero.'
              : "That person doesn't have a CityBeat account yet. Ask them to create a free account first."
            : data.code === 'seats_full'
              ? isEs
                ? 'Todos los lugares de tu plan están ocupados. Quita a alguien o mejora tu plan.'
                : 'All your plan seats are used. Remove someone or upgrade.'
              : data.error || (isEs ? 'No se pudo invitar.' : 'Could not invite.')
        )
        return
      }
      setEmail('')
      setMsg(isEs ? 'Administrador agregado.' : 'Manager added.')
      await load()
    } catch {
      setMsg(isEs ? 'No se pudo invitar.' : 'Could not invite.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (userId: string) => {
    setBusy(true)
    setMsg('')
    try {
      const res = await fetch(`/api/directory/${listingId}/managers`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) throw new Error()
      setMsg(isEs ? 'Administrador eliminado.' : 'Manager removed.')
      await load()
    } catch {
      setMsg(isEs ? 'No se pudo eliminar.' : 'Could not remove.')
    } finally {
      setBusy(false)
    }
  }

  if (managers === null) return <p className="text-sm text-white/40">{isEs ? 'Cargando equipo…' : 'Loading team…'}</p>

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/45">
        {isEs
          ? `Los administradores pueden editar tu ficha, pero no facturación ni el equipo. ${managers.length} / ${limit} lugares usados.`
          : `Managers can edit your listing but not billing or the team. ${managers.length} / ${limit} seats used.`}
      </p>
      {managers.length > 0 && (
        <ul className="space-y-2">
          {managers.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/25 px-4 py-2.5">
              <span className="truncate text-sm text-white/80">{m.name || m.email || m.user_id}</span>
              {isOwner && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove(m.user_id)}
                  className="text-[10px] font-black uppercase tracking-wider text-red-400/80 hover:text-red-300 disabled:opacity-50"
                >
                  {isEs ? 'Quitar' : 'Remove'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {isOwner ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="email"
            className={`${inputClass} max-w-xs`}
            placeholder={isEs ? 'correo@ejemplo.com' : 'email@example.com'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            type="button"
            disabled={busy || !email.trim()}
            onClick={add}
            className="rounded-md bg-brand-neon px-4 py-2 text-xs font-black uppercase tracking-wider text-black transition hover:bg-cyan-300 disabled:opacity-50"
          >
            {busy ? (isEs ? 'Invitando…' : 'Inviting…') : isEs ? 'Invitar' : 'Invite'}
          </button>
        </div>
      ) : (
        <p className="text-xs text-white/35">
          {isEs ? 'Solo el dueño puede administrar el equipo.' : 'Only the owner can manage the team.'}
        </p>
      )}
      {msg && <p className="text-xs font-bold text-brand-neon">{msg}</p>}
    </div>
  )
}
