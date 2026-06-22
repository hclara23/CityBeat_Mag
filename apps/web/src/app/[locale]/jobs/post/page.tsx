'use client'

import { useState } from 'react'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { useLocale } from '@/components/TranslationProvider'

export default function PostJobPage() {
  const locale = useLocale() as 'en' | 'es'
  const [form, setForm] = useState({ title: '', company_name: '', location: '', description: '', apply_url: '', contact_email: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.title || !form.company_name || !form.description) {
      setError(locale === 'es' ? 'Título, empresa y descripción son obligatorios.' : 'Title, company and description are required.')
      return
    }
    setSubmitting(true)
    try {
      // 1) Create the draft job.
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not create job')

      // 2) Start checkout; the webhook publishes the job on payment.
      const co = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: data.jobId, type: 'job', returnUrl: `${window.location.origin}/${locale}/jobs` }),
      })
      const coData = await co.json()
      if (!co.ok) throw new Error(coData.error || 'Could not start checkout')
      window.location.href = coData.url
    } catch (err: any) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  const t = (en: string, es: string) => (locale === 'es' ? es : en)

  return (
    <CityBeatShell locale={locale}>
      <section className="container-wide max-w-2xl py-14">
        <h1 className="font-display text-4xl font-black tracking-tight text-white">{t('Post a Job', 'Publicar empleo')}</h1>
        <p className="mt-2 text-white/55">{t('Reach the El Paso & Juárez community. $50 — live for 30 days.', 'Llega a la comunidad de El Paso y Juárez. $50 — activo por 30 días.')}</p>
        {error && <div className="mt-6 rounded-md bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
        <form onSubmit={submit} className="mt-8 space-y-4">
          {[
            { k: 'title', label: t('Job title', 'Puesto'), req: true },
            { k: 'company_name', label: t('Company', 'Empresa'), req: true },
            { k: 'location', label: t('Location', 'Ubicación') },
            { k: 'apply_url', label: t('Application URL', 'URL de aplicación') },
            { k: 'contact_email', label: t('Contact email', 'Correo de contacto') },
          ].map((f) => (
            <label key={f.k} className="block text-sm text-white/70">
              {f.label}{f.req ? ' *' : ''}
              <input value={(form as any)[f.k]} onChange={set(f.k)}
                className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white outline-none focus:border-brand-neon" />
            </label>
          ))}
          <label className="block text-sm text-white/70">
            {t('Description', 'Descripción')} *
            <textarea value={form.description} onChange={set('description')} rows={6}
              className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white outline-none focus:border-brand-neon" />
          </label>
          <button type="submit" disabled={submitting}
            className="rounded-md bg-brand-neon px-6 py-3 text-sm font-black uppercase tracking-wider text-black transition hover:bg-cyan-300 disabled:opacity-60">
            {submitting ? t('Starting checkout…', 'Iniciando pago…') : t('Continue to payment ($50)', 'Continuar al pago ($50)')}
          </button>
        </form>
      </section>
    </CityBeatShell>
  )
}
