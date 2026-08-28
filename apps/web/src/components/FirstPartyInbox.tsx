'use client'

// First-party in-app notification inbox. Works entirely from CityBeat's own
// user_notifications records — no external provider required. Email (and any
// configured provider) are delivery channels layered on the same records.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from '@/components/TranslationProvider'

type Notification = {
  id: string
  type: string
  title: string
  title_es?: string
  body?: string
  body_es?: string
  link?: string | null
  read_at?: string | null
  created_at?: string
}

const TYPE_ICON: Record<string, string> = {
  review: '⭐',
  lead: '📬',
  claim_approved: '✅',
  manager_added: '👥',
  report: '📈',
  article_submission: '📰',
}

export function FirstPartyInbox() {
  const router = useRouter()
  const locale = (useLocale() || 'en') as 'en' | 'es'
  const isEs = locale === 'es'
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLButtonElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setItems(data.notifications || [])
      setUnread(data.unread || 0)
    } catch {
      // Inbox is best-effort chrome — never break the header.
    } finally {
      // Gate the empty state so the panel doesn't flash "No notifications yet"
      // before the first fetch resolves.
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Keep the badge current while staff work in the dashboard. Opening the
  // inbox still refreshes immediately; this catches submissions hands-free.
  useEffect(() => {
    const interval = window.setInterval(() => void load(), 60_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  // Close on outside click or Escape (returning focus to the bell for keyboard
  // users — WCAG 2.1.1 / 4.1.2).
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        bellRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const markAllRead = async () => {
    setUnread(0)
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || 'now' })))
    void fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'read_all' }),
    }).catch(() => {})
  }

  const openItem = (n: Notification) => {
    if (!n.read_at) {
      setUnread((u) => Math.max(0, u - 1))
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: 'now' } : x)))
      void fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'read', id: n.id }),
      }).catch(() => {})
    }
    setOpen(false)
    if (n.link) router.push(`/${locale}${n.link}`)
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        ref={bellRef}
        type="button"
        onClick={() => {
          setOpen((v) => !v)
          if (!open) void load()
        }}
        aria-label={
          unread > 0
            ? isEs
              ? `Notificaciones, ${unread} sin leer`
              : `Notifications, ${unread} unread`
            : isEs
              ? 'Notificaciones'
              : 'Notifications'
        }
        aria-expanded={open}
        aria-haspopup="true"
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/70 transition hover:border-brand-neon/60 hover:text-brand-neon"
      >
        <svg aria-hidden="true" className="h-4.5 w-4.5" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-magenta px-1 text-[9px] font-black text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-white/15 bg-brand-dark shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">
              {isEs ? 'Notificaciones' : 'Notifications'}
            </p>
            {unread > 0 && (
              <button type="button" onClick={markAllRead} className="text-[10px] font-bold text-brand-neon hover:underline">
                {isEs ? 'Marcar leídas' : 'Mark all read'}
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {!loaded ? (
              <p className="px-4 py-8 text-center text-xs text-white/40">{isEs ? 'Cargando…' : 'Loading…'}</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-white/40">
                {isEs ? 'Sin notificaciones todavía.' : 'No notifications yet.'}
              </p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openItem(n)}
                  className={`block w-full border-b border-white/5 px-4 py-3 text-left transition hover:bg-white/5 ${
                    n.read_at ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 text-sm">{TYPE_ICON[n.type] || '🔔'}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-bold text-white">
                        {(isEs && n.title_es) || n.title}
                      </span>
                      {((isEs && n.body_es) || n.body) && (
                        <span className="mt-0.5 block text-[11px] leading-4 text-white/50 line-clamp-2">
                          {(isEs && n.body_es) || n.body}
                        </span>
                      )}
                      {n.created_at && (
                        <span className="mt-1 block text-[9px] uppercase tracking-wider text-white/30">
                          {new Date(n.created_at).toLocaleDateString(isEs ? 'es-MX' : 'en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      )}
                    </span>
                    {!n.read_at && <span className="ml-auto mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-neon" />}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
