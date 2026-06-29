'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { withLocale } from '@/components/citybeat/content'
import { useLocale } from '@/components/TranslationProvider'

export default function SubmitEvent() {
  const locale = useLocale() as 'en' | 'es'
  const isEs = locale === 'es'
  const [form, setForm] = useState({
    title: '', start_date: '', venue: '', description: '', ticket_url: '', image_url: '', submitter_email: '',
  })
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.title.trim() || !form.start_date) {
      setError(isEs ? 'El título y la fecha son obligatorios.' : 'Title and date are required.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/events/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not submit')
      setDone(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const input = 'mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white placeholder-white/30'

  return (
    <CityBeatShell locale={locale}>
      <section className="container-wide max-w-xl py-14">
        <Link href={withLocale(locale, '/events')} className="text-xs font-black uppercase tracking-[0.24em] text-brand-neon hover:underline">
          {isEs ? '← Eventos' : '← Events'}
        </Link>
        <h1 className="mt-4 font-display text-4xl font-black tracking-tight text-white">
          {isEs ? 'Enviar un evento' : 'Submit an event'}
        </h1>
        <p className="mt-2 text-white/60">
          {isEs
            ? 'Comparte un evento local. Lo revisaremos y publicaremos en CityBeat.'
            : "Share a local event. We'll review it and publish it on CityBeat."}
        </p>

        {done ? (
          <div className="mt-8 rounded-xl border border-brand-neon/30 bg-brand-neon/5 p-6">
            <p className="font-display text-lg font-bold text-white">{isEs ? '¡Gracias!' : 'Thank you!'}</p>
            <p className="mt-1 text-sm text-white/60">
              {isEs ? 'Tu evento fue enviado para revisión.' : 'Your event was submitted for review.'}
            </p>
            <Link href={withLocale(locale, '/events')} className="mt-4 inline-block text-sm font-bold text-brand-neon hover:underline">
              {isEs ? 'Ver eventos →' : 'Browse events →'}
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            {error && <p className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</p>}
            <label className="block text-sm text-white/70">
              {isEs ? 'Título del evento *' : 'Event title *'}
              <input className={input} value={form.title} onChange={set('title')} placeholder={isEs ? 'Mercado nocturno' : 'Night Market'} />
            </label>
            <label className="block text-sm text-white/70">
              {isEs ? 'Fecha y hora *' : 'Date & time *'}
              <input type="datetime-local" className={input} value={form.start_date} onChange={set('start_date')} />
            </label>
            <label className="block text-sm text-white/70">
              {isEs ? 'Lugar' : 'Venue'}
              <input className={input} value={form.venue} onChange={set('venue')} placeholder={isEs ? 'Plaza de los Lagartos, El Paso' : 'San Jacinto Plaza, El Paso'} />
            </label>
            <label className="block text-sm text-white/70">
              {isEs ? 'Descripción' : 'Description'}
              <textarea className={input} rows={4} value={form.description} onChange={set('description')} />
            </label>
            <label className="block text-sm text-white/70">
              {isEs ? 'Enlace de boletos / info' : 'Tickets / info link'}
              <input className={input} value={form.ticket_url} onChange={set('ticket_url')} placeholder="https://" />
            </label>
            <label className="block text-sm text-white/70">
              {isEs ? 'URL de imagen' : 'Image URL'}
              <input className={input} value={form.image_url} onChange={set('image_url')} placeholder="https://" />
            </label>
            <label className="block text-sm text-white/70">
              {isEs ? 'Tu email (opcional)' : 'Your email (optional)'}
              <input type="email" className={input} value={form.submitter_email} onChange={set('submitter_email')} />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-brand-neon px-5 py-3 text-sm font-black uppercase tracking-wider text-black hover:bg-cyan-300 disabled:opacity-50"
            >
              {busy ? (isEs ? 'Enviando…' : 'Submitting…') : isEs ? 'Enviar para revisión' : 'Submit for review'}
            </button>
          </form>
        )}
      </section>
    </CityBeatShell>
  )
}
