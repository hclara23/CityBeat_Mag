'use client'

import { useState } from 'react'

// "Request a quote / contact business" lead-capture form for directory listings.
export function QuoteForm({ listingId, locale = 'en' }: { listingId: string; locale?: 'en' | 'es' }) {
  const isEs = locale === 'es'
  const [form, setForm] = useState({ name: '', contact: '', message: '' })
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.name.trim() || !form.contact.trim()) {
      return setError(isEs ? 'Nombre y contacto son obligatorios.' : 'Name and contact are required.')
    }
    setBusy(true)
    try {
      const res = await fetch('/api/leads/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, ...form }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not send')
      setDone(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const input = 'mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white placeholder-white/30'

  if (done) {
    return (
      <div className="rounded-xl border border-brand-neon/30 bg-brand-neon/5 p-5 text-sm text-white/70">
        {isEs ? '¡Enviado! El negocio se pondrá en contacto contigo.' : "Sent! The business will get back to you."}
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-white/10 bg-white/5 p-5">
      <p className="font-display text-lg font-bold text-white">{isEs ? 'Solicitar información' : 'Request a quote'}</p>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      <div className="mt-3 grid gap-3">
        <input className={input} placeholder={isEs ? 'Tu nombre' : 'Your name'} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className={input} placeholder={isEs ? 'Email o teléfono' : 'Email or phone'} value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
        <textarea className={input} rows={3} placeholder={isEs ? 'Mensaje (opcional)' : 'Message (optional)'} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
      </div>
      <button type="submit" disabled={busy} className="mt-3 w-full rounded-md bg-brand-neon px-4 py-2.5 text-sm font-black uppercase tracking-wider text-black hover:bg-cyan-300 disabled:opacity-50">
        {busy ? (isEs ? 'Enviando…' : 'Sending…') : isEs ? 'Enviar' : 'Send request'}
      </button>
    </form>
  )
}
