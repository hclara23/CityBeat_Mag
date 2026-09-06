'use client'

import { useState } from 'react'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { useLocale } from '@/components/TranslationProvider'

// The page a customer looks for when something has gone wrong with their money.
//
// There wasn't one. Four different addresses were published across the site with
// nothing explaining which to use, and no way for someone outside to tell which
// were monitored. A guess that lands in an unread mailbox is indistinguishable
// from being ignored — which is the worst thing to hand someone who has just been
// charged. The form persists the message before anything else can fail, so it
// cannot be lost to a bounce.
//
// Bilingual because this market is ~90% Spanish-speaking, and a support page that
// only works in English is not a support page for most of the people who need it.

const COPY = {
  en: {
    eyebrow: 'Contact',
    title: 'Talk to a person',
    sub: 'A real person reads every message. If it is about a payment, we treat it as urgent.',
    topic: 'What is this about?',
    topics: {
      billing: 'A payment or my subscription',
      listing: 'My business listing',
      advertising: 'Advertising with CityBeat',
      press: 'Press or a story',
      other: 'Something else',
    },
    name: 'Your name',
    email: 'Your email',
    message: 'What can we help with?',
    placeholder: 'Tell us what happened. Include anything that identifies the charge or the listing if you can.',
    send: 'Send message',
    sending: 'Sending…',
    sentTitle: 'Message received.',
    sentBody: 'We have it. If it is about a payment, someone is already being notified.',
    urgent: 'Payments are treated as urgent — this notifies someone immediately.',
    fallback: 'Prefer email? Write to hello@citybeatmag.co.',
    required: 'We need your email and a message.',
  },
  es: {
    eyebrow: 'Contacto',
    title: 'Habla con una persona',
    sub: 'Una persona real lee cada mensaje. Si se trata de un pago, lo tratamos como urgente.',
    topic: '¿De qué se trata?',
    topics: {
      billing: 'Un pago o mi suscripción',
      listing: 'La ficha de mi negocio',
      advertising: 'Anunciarme en CityBeat',
      press: 'Prensa o una nota',
      other: 'Otra cosa',
    },
    name: 'Tu nombre',
    email: 'Tu correo',
    message: '¿En qué te podemos ayudar?',
    placeholder: 'Cuéntanos qué pasó. Si puedes, incluye algo que identifique el cargo o la ficha.',
    send: 'Enviar mensaje',
    sending: 'Enviando…',
    sentTitle: 'Mensaje recibido.',
    sentBody: 'Ya lo tenemos. Si se trata de un pago, ya se notificó a alguien.',
    urgent: 'Los pagos se tratan como urgentes — esto notifica a alguien de inmediato.',
    fallback: '¿Prefieres correo? Escribe a hello@citybeatmag.co.',
    required: 'Necesitamos tu correo y un mensaje.',
  },
} as const

export default function ContactPage() {
  const locale = useLocale() === 'es' ? 'es' : 'en'
  const t = COPY[locale]

  const [topic, setTopic] = useState<keyof typeof t.topics>('billing')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !message.trim()) {
      setError(t.required)
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, name, email, message, website, locale }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not send your message')
      setSent(true)
    } catch (err: any) {
      setError(err?.message || 'Could not send your message')
    } finally {
      setBusy(false)
    }
  }

  const field =
    'w-full rounded-md border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-neon'

  return (
    <CityBeatShell locale={locale}>
      <div className="citybeat-app min-h-screen py-12">
        <div className="container-wide max-w-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-neon">{t.eyebrow}</p>
          <h1 className="mt-1 font-display text-3xl font-black uppercase text-white">{t.title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/60">{t.sub}</p>

          {sent ? (
            <div className="citybeat-panel mt-8 rounded-2xl border border-emerald-500/30 p-6">
              <p className="font-bold text-emerald-300">{t.sentTitle}</p>
              <p className="mt-2 text-sm text-white/70">{t.sentBody}</p>
            </div>
          ) : (
            <form onSubmit={submit} className="citybeat-panel mt-8 space-y-4 rounded-2xl border border-white/10 p-6">
              {error && (
                <p className="rounded border border-brand-magenta/40 bg-brand-magenta/10 p-3 text-sm text-brand-magenta">
                  {error}
                </p>
              )}

              <label className="block">
                <span className="text-xs font-black uppercase tracking-wider text-white/50">{t.topic}</span>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value as keyof typeof t.topics)}
                  className={`${field} mt-1.5`}
                >
                  {Object.entries(t.topics).map(([key, label]) => (
                    <option key={key} value={key} className="bg-brand-dark">
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              {topic === 'billing' && <p className="text-xs text-brand-gold">{t.urgent}</p>}

              <label className="block">
                <span className="text-xs font-black uppercase tracking-wider text-white/50">{t.name}</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className={`${field} mt-1.5`} autoComplete="name" />
              </label>

              <label className="block">
                <span className="text-xs font-black uppercase tracking-wider text-white/50">{t.email}</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`${field} mt-1.5`}
                  autoComplete="email"
                  required
                />
              </label>

              <label className="block">
                <span className="text-xs font-black uppercase tracking-wider text-white/50">{t.message}</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  placeholder={t.placeholder}
                  className={`${field} mt-1.5 resize-y`}
                  required
                />
              </label>

              {/* Honeypot: never shown, never focusable by a keyboard user. */}
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="hidden"
              />

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-md bg-brand-neon px-4 py-3 text-xs font-black uppercase tracking-wider text-black transition hover:bg-cyan-300 disabled:opacity-50"
              >
                {busy ? t.sending : t.send}
              </button>

              <p className="text-center text-[11px] text-white/40">{t.fallback}</p>
            </form>
          )}
        </div>
      </div>
    </CityBeatShell>
  )
}
