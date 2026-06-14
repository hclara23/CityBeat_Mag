'use client'

import { useState } from 'react'

export function NewsletterForm({
  locale,
  emailPlaceholder,
  joinText
}: {
  locale: string
  emailPlaceholder: string
  joinText: string
}) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setStatus('loading')

    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, locale })
      })

      if (!res.ok) {
        throw new Error('Failed to subscribe')
      }

      setStatus('success')
      setEmail('')
    } catch (err) {
      console.error(err)
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="mt-6 rounded-md border border-brand-neon/30 bg-brand-neon/10 px-4 py-4 text-center">
        <p className="text-brand-neon font-black uppercase tracking-wider text-sm">
          {locale === 'es' ? '¡Suscrito con éxito!' : 'Successfully subscribed!'}
        </p>
      </div>
    )
  }

  return (
    <form className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={handleSubmit}>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={emailPlaceholder}
        className="rounded-md border border-white/15 bg-black/40 px-4 py-3 text-white outline-none focus:border-brand-neon"
      />
      <button 
        type="submit" 
        disabled={status === 'loading'}
        className="rounded-md bg-brand-neon px-5 py-3 text-sm font-black uppercase tracking-wider text-black disabled:opacity-50"
      >
        {status === 'loading' ? '...' : joinText}
      </button>
      {status === 'error' && (
        <p className="col-span-full text-red-500 text-sm mt-1">
          {locale === 'es' ? 'Ocurrió un error. Inténtalo de nuevo.' : 'An error occurred. Please try again.'}
        </p>
      )}
    </form>
  )
}
