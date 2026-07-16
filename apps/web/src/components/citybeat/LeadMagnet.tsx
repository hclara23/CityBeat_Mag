'use client'

import { useState } from 'react'
import { useLocale } from '@/components/TranslationProvider'

// Email-capture lead magnet: converts anonymous visitors into a first-party
// email list (which the business currently lacks). The "guide" is the weekly
// events digest they'll receive — honest value in exchange for the address.
export function LeadMagnet({ source = 'weekend_guide' }: { source?: string }) {
  const locale = useLocale() as 'en' | 'es'
  const isEs = locale === 'es'
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.includes('@')) return
    setState('loading')
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, locale, source }),
      })
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="rounded-2xl border border-brand-neon/30 bg-gradient-to-br from-brand-neon/10 to-transparent p-6 sm:p-8">
      {state === 'done' ? (
        <div className="text-center">
          <p className="text-3xl">✅</p>
          <h3 className="mt-2 font-display text-xl font-black uppercase tracking-wide text-white">
            {isEs ? '¡Listo! Revisa tu correo' : "You're in! Check your inbox"}
          </h3>
          <p className="mt-2 text-sm text-white/70">
            {isEs
              ? 'Recibirás la Guía del Fin de Semana de El Paso cada semana — los mejores eventos, directo a tu correo.'
              : "You'll get the El Paso Weekend Guide every week — the best events, straight to your inbox."}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-neon">
            {isEs ? 'Guía gratis' : 'Free guide'}
          </p>
          <h3 className="mt-1 font-display text-2xl font-black uppercase leading-tight tracking-tight text-white">
            {isEs ? 'La Guía del Fin de Semana de El Paso' : 'The El Paso Weekend Guide'}
          </h3>
          <p className="mt-2 text-sm text-white/70">
            {isEs
              ? 'Los mejores eventos de El Paso, Las Cruces y Juárez cada semana — directo a tu correo. Gratis.'
              : 'The best events across El Paso, Las Cruces & Juárez every week — straight to your inbox. Free.'}
          </p>
          <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={isEs ? 'tu@correo.com' : 'you@email.com'}
              className="flex-1 rounded-md border border-white/15 bg-black/30 px-4 py-3 text-sm text-white placeholder-white/40 focus:border-brand-neon focus:outline-none"
            />
            <button
              type="submit"
              disabled={state === 'loading'}
              className="rounded-md bg-brand-neon px-5 py-3 text-sm font-black uppercase tracking-wider text-black transition hover:bg-cyan-300 disabled:opacity-50"
            >
              {state === 'loading' ? (isEs ? 'Enviando…' : 'Sending…') : isEs ? 'Enviarme la guía' : 'Send me the guide'}
            </button>
          </form>
          {state === 'error' && (
            <p className="mt-2 text-xs text-red-400">{isEs ? 'Algo salió mal. Intenta de nuevo.' : 'Something went wrong. Try again.'}</p>
          )}
          <p className="mt-2 text-[11px] text-white/40">
            {isEs ? 'Sin spam. Cancela cuando quieras.' : 'No spam. Unsubscribe anytime.'}
          </p>
        </>
      )}
    </div>
  )
}
