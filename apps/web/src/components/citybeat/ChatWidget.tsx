'use client'

import { useState, useRef, useEffect } from 'react'
import { useLocale } from '@/components/TranslationProvider'

type Msg = { role: 'user' | 'assistant'; content: string }

function linkify(text: string, locale: string) {
  // Turn /directory, /ads, /contribute, etc. into clickable locale links.
  const parts = text.split(/(\/[a-z][a-z0-9/_-]*)/g)
  return parts.map((p, i) => {
    if (/^\/[a-z]/.test(p)) {
      const href = `/${locale}${p}`
      return (
        <a key={i} href={href} className="text-brand-neon underline">
          {p}
        </a>
      )
    }
    return <span key={i}>{p}</span>
  })
}

export function ChatWidget() {
  const locale = useLocale() as 'en' | 'es'
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const sessionId = useRef<string>(Math.random().toString(36).slice(2))
  const scrollRef = useRef<HTMLDivElement>(null)

  const greeting =
    locale === 'es'
      ? '¡Hola! ¿Tienes un negocio en El Paso o Juárez? Puedo ayudarte a reclamar tu ficha o anunciarte.'
      : 'Hi! Have a business in El Paso or Juárez? I can help you claim your listing or advertise.'

  useEffect(() => {
    if (open && messages.length === 0) setMessages([{ role: 'assistant', content: greeting }])
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

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
      setMessages((m) => [...m, { role: 'assistant', content: data.reply || '…' }])
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
          onClick={() => setOpen(true)}
          aria-label="Open chat"
          className="fixed bottom-5 right-5 z-50 rounded-full bg-brand-neon px-5 py-4 text-sm font-black uppercase tracking-wider text-black shadow-xl transition hover:bg-cyan-300"
        >
          {locale === 'es' ? '¿Anunciar?' : 'Advertise?'}
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[30rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-white/15 bg-brand-charcoal shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 bg-brand-dark px-4 py-3">
            <span className="font-display text-lg font-black text-white">
              city<span className="italic text-brand-neon">BEat</span>
            </span>
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-white/50 hover:text-white">✕</button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
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
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder={locale === 'es' ? 'Escribe un mensaje…' : 'Type a message…'}
              className="flex-1 rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-neon"
            />
            <button onClick={send} disabled={busy} className="rounded-md bg-brand-neon px-3 py-2 text-sm font-black text-black disabled:opacity-50">
              →
            </button>
          </div>
        </div>
      )}
    </>
  )
}
