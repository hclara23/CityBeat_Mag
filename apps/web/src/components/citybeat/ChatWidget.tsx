'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from '@/components/TranslationProvider'

type Msg = { role: 'user' | 'assistant'; content: string }

// The bot can steer the browser by emitting a `[[nav:/path]]` directive. We only
// ever follow it for a strict allowlist of PUBLIC internal routes — never admin/
// account/api/dashboard, and never an external URL — so a hallucinated or
// injected directive can't send the user somewhere unsafe.
const NAV_ALLOW =
  /^\/(directory|ads|jobs|contribute|events|stories|best|deals|leaderboard|guide|this-weekend|topics)(\/[a-z0-9\-_/]*)?$/i

function parseNav(text: string): { clean: string; nav: string | null } {
  const m = text.match(/\[\[\s*nav:\s*(\/[^\]]+?)\s*\]\]/i)
  if (!m) return { clean: text, nav: null }
  const clean = text.replace(m[0], '').replace(/\n{3,}/g, '\n\n').trim()
  // Drop any locale prefix the model added; we re-add the current one on navigate.
  const bare = m[1].trim().replace(/^\/(en|es)(?=\/|$)/, '') || '/'
  const nav = NAV_ALLOW.test(bare) ? bare : null
  return { clean, nav }
}

function linkify(text: string, locale: string) {
  // Render markdown links [Label](/path) — the concierge cites businesses that
  // way — plus bare /paths, as locale-aware anchors. Paths already carrying a
  // locale prefix are used as-is (no /en/en/ double-prefixing).
  const withLocale = (href: string) => (/^\/(en|es)(\/|$)/.test(href) ? href : `/${locale}${href}`)
  const parts = text.split(/(\[[^\]]+\]\(\/[^)\s]+\)|\/[a-z][a-z0-9/_-]*)/g)
  return parts.map((p, i) => {
    const md = p.match(/^\[([^\]]+)\]\((\/[^)\s]+)\)$/)
    if (md) {
      return (
        <a key={i} href={withLocale(md[2])} className="text-brand-neon underline">
          {md[1]}
        </a>
      )
    }
    if (/^\/[a-z]/.test(p)) {
      return (
        <a key={i} href={withLocale(p)} className="text-brand-neon underline">
          {p}
        </a>
      )
    }
    return <span key={i}>{p}</span>
  })
}

export function ChatWidget() {
  const locale = useLocale() as 'en' | 'es'
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const sessionId = useRef<string>(Math.random().toString(36).slice(2))
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const openBtnRef = useRef<HTMLButtonElement>(null)

  const greeting =
    locale === 'es'
      ? '¡Hola! 👋 Soy tu guía de CityBeat. Conozco El Paso y todo lo que ofrecemos — desde hacer que encuentren tu negocio hasta publicidad, empleos y eventos. Dime qué necesitas y te llevo directo ahí. ¿En qué te ayudo?'
      : "Hi! 👋 I'm your CityBeat guide. I know El Paso and everything we offer — from getting your business found to advertising, jobs, and events. Tell me what you need and I'll take you right to it. What can I help with?"

  useEffect(() => {
    if (open && messages.length === 0) setMessages([{ role: 'assistant', content: greeting }])
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Proactively greet first-time visitors: pop the assistant open once per browser
  // session, a few seconds after landing, so it introduces itself and offers help.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (sessionStorage.getItem('cb_chat_greeted')) return
      const t = setTimeout(() => {
        setOpen(true)
        try {
          sessionStorage.setItem('cb_chat_greeted', '1')
        } catch {
          /* ignore */
        }
      }, 3500)
      return () => clearTimeout(t)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  // Modal-style overlay keyboard behavior: focus the input on open, close on
  // Escape and return focus to the launcher button (WCAG 2.1.2 / 4.1.2).
  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        openBtnRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  const dialogTitle = locale === 'es' ? 'Asistente de CityBeat' : 'CityBeat assistant'

  const send = async () => {
    const text = input.trim()
    if (!text || busy) return
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next)
    setInput('')
    setBusy(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, sessionId: sessionId.current }),
      })
      const data = await res.json()
      const { clean, nav } = parseNav(data.reply || '…')
      setMessages((m) => [...m, { role: 'assistant', content: clean || '…' }])
      if (nav) {
        // Take the user to the page the bot referenced — after a short beat so
        // they can read the message first. Keeps the chat open across the nav.
        setTimeout(() => router.push(`/${locale}${nav}`), 700)
      }
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Connection issue — please try again.' }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {!open && (
        <button
          ref={openBtnRef}
          onClick={() => setOpen(true)}
          aria-label={locale === 'es' ? 'Abrir chat de CityBeat' : 'Open CityBeat chat'}
          className="fixed bottom-5 right-5 z-50 rounded-full bg-brand-neon px-5 py-4 text-sm font-black uppercase tracking-wider text-black shadow-xl transition hover:bg-cyan-300"
        >
          {locale === 'es' ? '¿Anunciar?' : 'Advertise?'}
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="citybeat-chat-title"
          className="fixed bottom-5 right-5 z-50 flex h-[30rem] max-h-[calc(100dvh-2.5rem)] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-white/15 bg-brand-charcoal shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-white/10 bg-brand-dark px-4 py-3">
            <span id="citybeat-chat-title" className="font-display text-lg font-black text-white">
              <span className="sr-only">{dialogTitle}</span>
              <span aria-hidden="true">
                city<span className="italic text-brand-neon">BEat</span>
              </span>
            </span>
            <button
              onClick={() => setOpen(false)}
              aria-label={locale === 'es' ? 'Cerrar chat' : 'Close chat'}
              className="text-white/50 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div ref={scrollRef} aria-live="polite" aria-atomic="false" className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                <span
                  className={`inline-block max-w-[85%] rounded-xl px-3 py-2 text-sm leading-5 ${
                    m.role === 'user' ? 'bg-brand-neon text-black' : 'bg-white/10 text-white/90'
                  }`}
                >
                  {m.role === 'assistant' ? linkify(m.content, locale) : m.content}
                </span>
              </div>
            ))}
            {busy && <div className="text-left text-xs text-white/40">…</div>}
          </div>

          <div className="flex items-center gap-2 border-t border-white/10 p-3">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              aria-label={locale === 'es' ? 'Escribe un mensaje' : 'Type a message'}
              placeholder={locale === 'es' ? 'Escribe un mensaje…' : 'Type a message…'}
              className="flex-1 rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-neon"
            />
            <button
              onClick={send}
              disabled={busy}
              aria-label={locale === 'es' ? 'Enviar mensaje' : 'Send message'}
              className="rounded-md bg-brand-neon px-3 py-2 text-sm font-black text-black transition hover:bg-cyan-300 disabled:opacity-50"
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
