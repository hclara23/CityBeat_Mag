'use client'

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { useLocale } from '@/components/TranslationProvider'
import { intakeCompletion, type IntakeField, type IntakeSchema } from '@/lib/sales-intake'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const controlClass =
  'mt-1.5 w-full border border-white/15 bg-black/35 px-3 py-2.5 text-white outline-none transition placeholder:text-white/25 focus:border-brand-neon/70 focus:ring-2 focus:ring-brand-neon/10'

function formatMoney(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100)
}

export default function CustomerFulfillmentWizard({ params }: { params: { orderId: string } }) {
  const locale = useLocale() as 'en' | 'es'
  const [accessToken, setAccessToken] = useState('')
  const [order, setOrder] = useState<any>(null)
  const [schema, setSchema] = useState<IntakeSchema | null>(null)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [step, setStep] = useState(0)
  const [completion, setCompletion] = useState(0)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [uploadingField, setUploadingField] = useState('')
  const hydrated = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    const access = query.get('access') || ''
    setAccessToken(access)
    fetch(`/api/sales/orders/${encodeURIComponent(params.orderId)}/intake?${query.toString()}`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || 'Could not open this order.')
        setOrder(data.order)
        setSchema(data.schema)
        setValues(data.order?.intake_data || {})
        setStep(Math.min(data.schema.sections.length - 1, Math.max(0, data.order?.intake_current_step || 0)))
        setCompletion(data.completion || 0)
        if (
          data.order?.intake_status === 'submitted' &&
          ['in_review', 'fulfilled'].includes(data.order?.fulfillment_status)
        ) setSubmitted(true)
        hydrated.current = true

        // The Session id was needed only for the Stripe/webhook race. Remove it
        // from the visible URL after verification; the opaque order token remains.
        if (query.has('session_id')) {
          query.delete('session_id')
          window.history.replaceState({}, '', `${window.location.pathname}?${query.toString()}`)
        }
      })
      .catch((loadError) => setError(loadError?.message || 'Could not open this order.'))
      .finally(() => setLoading(false))
  }, [params.orderId])

  const apiUrl = useCallback(
    (resource: 'intake' | 'assets') =>
      `/api/sales/orders/${encodeURIComponent(params.orderId)}/${resource}?access=${encodeURIComponent(accessToken)}`,
    [params.orderId, accessToken]
  )

  const save = useCallback(
    async (nextValues: Record<string, unknown>, nextStep: number, quiet = false) => {
      if (!accessToken || !schema || submitted) return true
      if (!quiet) setSaveState('saving')
      try {
        const response = await fetch(apiUrl('intake'), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: nextValues, currentStep: nextStep }),
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || 'Could not save your progress.')
        setCompletion(data.completion ?? intakeCompletion(schema, nextValues))
        setSaveState('saved')
        return true
      } catch (saveError: any) {
        setSaveState('error')
        if (!quiet) setError(saveError?.message || 'Could not save your progress.')
        return false
      }
    },
    [accessToken, apiUrl, schema, submitted]
  )

  useEffect(() => {
    if (!hydrated.current || !schema || submitted) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveState('saving')
    saveTimer.current = setTimeout(() => void save(values, step, true), 650)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [values, step, schema, submitted, save])

  const section = schema?.sections[step]
  const localCompletion = useMemo(() => (schema ? intakeCompletion(schema, values) : completion), [schema, values, completion])

  function change(fieldId: string, value: unknown) {
    setError('')
    setSaveState('saving')
    setValues((current) => ({ ...current, [fieldId]: value }))
  }

  async function upload(field: IntakeField, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploadingField(field.id)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const response = await fetch(apiUrl('assets'), { method: 'POST', body: form })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.asset?.url) throw new Error(data.error || 'Could not upload this image.')
      if (field.type === 'images') {
        const current = Array.isArray(values[field.id]) ? (values[field.id] as string[]) : []
        change(field.id, [...current, data.asset.url].slice(0, 8))
      } else {
        change(field.id, data.asset.url)
      }
    } catch (uploadError: any) {
      setError(uploadError?.message || 'Could not upload this image.')
    } finally {
      setUploadingField('')
    }
  }

  function removeImage(fieldId: string, url: string) {
    const current = Array.isArray(values[fieldId]) ? (values[fieldId] as string[]) : []
    change(fieldId, current.filter((item) => item !== url))
  }

  async function continueForward() {
    const saved = await save(values, step)
    if (saved && schema) {
      setStep((current) => Math.min(schema.sections.length - 1, current + 1))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  async function submit() {
    if (!schema) return
    setError('')
    setSaveState('saving')
    try {
      const response = await fetch(apiUrl('intake'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (Array.isArray(data.missing) && data.missing.length) {
          const missing = new Set<string>(data.missing)
          const target = schema.sections.findIndex((candidate) => candidate.fields.some((field) => missing.has(field.id)))
          if (target >= 0) setStep(target)
        }
        throw new Error(data.error || 'Complete the required fields before submitting.')
      }
      setCompletion(100)
      setSaveState('saved')
      setSubmitted(true)
    } catch (submitError: any) {
      setSaveState('error')
      setError(submitError?.message || 'Could not submit your brief.')
    }
  }

  if (loading) {
    return <CityBeatShell locale={locale}><main className="container-wide flex min-h-[60vh] items-center justify-center text-sm font-black uppercase tracking-[0.2em] text-white/40">Opening your paid order...</main></CityBeatShell>
  }

  if (error && (!order || !schema)) {
    return (
      <CityBeatShell locale={locale}>
        <main className="container-wide flex min-h-[65vh] items-center justify-center py-16">
          <div className="max-w-lg border border-brand-magenta/30 bg-brand-magenta/10 p-7">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-magenta">Order access</p>
            <h1 className="mt-2 font-display text-3xl font-black text-white">We could not open this brief.</h1>
            <p className="mt-3 leading-6 text-white/65">{error}</p>
            <p className="mt-4 text-sm text-white/40">Contact CityBeat and include order reference {params.orderId}.</p>
          </div>
        </main>
      </CityBeatShell>
    )
  }

  if (submitted) {
    return (
      <CityBeatShell locale={locale}>
        <main className="container-wide flex min-h-[70vh] items-center justify-center py-16">
          <div className="max-w-2xl border border-brand-neon/30 bg-brand-neon/[0.07] p-8 text-center sm:p-12">
            <div className="mx-auto flex h-14 w-14 items-center justify-center bg-brand-neon text-2xl font-black text-black">OK</div>
            <p className="mt-6 text-xs font-black uppercase tracking-[0.26em] text-brand-neon">Payment and brief complete</p>
            <h1 className="mt-2 font-display text-4xl font-black text-white">Your order is ready for CityBeat.</h1>
            <p className="mx-auto mt-4 max-w-xl leading-7 text-white/60">Our team has the information and files needed to begin {order?.product_name || 'your order'}. We will use {order?.contact_email} if anything needs clarification.</p>
            <p className="mt-6 text-xs text-white/35">Order reference: {params.orderId}</p>
          </div>
        </main>
      </CityBeatShell>
    )
  }

  return (
    <CityBeatShell locale={locale}>
      <main className="container-wide max-w-6xl py-8 sm:py-12">
        <header className="border-y border-white/10 bg-white/[0.025] px-5 py-6 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-neon">Payment received / private order brief</p>
              <h1 className="mt-2 font-display text-3xl font-black text-white sm:text-4xl">{schema?.title}</h1>
              <p className="mt-2 text-sm text-white/50">Your answers save automatically. A private resume link was sent to {order?.contact_email}.</p>
            </div>
            <div className="border-l-2 border-brand-magenta pl-4 text-right">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/40">{order?.product_name}</p>
              <p className="mt-1 font-display text-2xl font-black text-white">{formatMoney(order?.amount_paid || order?.amount)}</p>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-brand-neon">Paid</p>
            </div>
          </div>
        </header>

        <div className="mt-5 h-1 bg-white/10" aria-label={`${localCompletion}% complete`}>
          <div className="h-full bg-brand-neon transition-all duration-500" style={{ width: `${localCompletion}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.15em]">
          <span className="text-white/35">{localCompletion}% of required details complete</span>
          <span className={saveState === 'error' ? 'text-red-300' : 'text-brand-neon/70'}>
            {saveState === 'saving' ? 'Saving...' : saveState === 'error' ? 'Not saved - retrying' : 'Progress saved'}
          </span>
        </div>

        <div className="mt-7 grid gap-7 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav aria-label="Order brief steps" className="space-y-px">
            {schema?.sections.map((item, index) => (
              <button
                type="button"
                key={item.id}
                onClick={async () => { await save(values, step, true); setStep(index); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                className={`w-full border-l-2 px-4 py-3 text-left transition ${index === step ? 'border-brand-neon bg-brand-neon/10' : 'border-white/10 bg-white/[0.025] hover:border-white/30'}`}
              >
                <span className={`block text-[9px] font-black uppercase tracking-[0.2em] ${index === step ? 'text-brand-neon' : 'text-white/30'}`}>{item.eyebrow}</span>
                <span className="mt-1 block text-sm font-bold text-white/80">{item.title}</span>
              </button>
            ))}
            <div className="mt-4 border border-white/10 bg-black/25 p-4 text-xs leading-5 text-white/40">
              <strong className="block text-white/70">Private and secure</strong>
              This link opens your order brief. Card information remains with Stripe and is never stored here.
            </div>
          </nav>

          <section className="border border-white/10 bg-white/[0.025] p-5 sm:p-8">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-magenta">{section?.eyebrow}</p>
            <h2 className="mt-1 font-display text-3xl font-black text-white">{section?.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">{section?.description}</p>

            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              {section?.fields.map((field) => {
                const value = values[field.id]
                const wide = field.type === 'textarea' || field.type === 'image' || field.type === 'images'
                return (
                  <div key={field.id} className={wide ? 'sm:col-span-2' : ''}>
                    <label className="block text-xs font-black uppercase tracking-[0.13em] text-white/65">
                      {field.label}{field.required && <span className="ml-1 text-brand-magenta">*</span>}
                      {field.type === 'textarea' ? (
                        <textarea className={`${controlClass} min-h-28 resize-y normal-case tracking-normal`} value={String(value || '')} maxLength={field.maxLength} placeholder={field.placeholder} onChange={(event) => change(field.id, event.target.value)} />
                      ) : field.type === 'select' ? (
                        <select className={`${controlClass} normal-case tracking-normal`} value={String(value || '')} onChange={(event) => change(field.id, event.target.value)}>
                          <option value="">Choose one</option>
                          {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      ) : field.type === 'checkbox' ? (
                        <span className="mt-2 flex items-center gap-3 border border-white/10 bg-black/25 px-3 py-3 normal-case tracking-normal">
                          <input type="checkbox" checked={value === true} onChange={(event) => change(field.id, event.target.checked)} className="h-5 w-5 accent-cyan-300" /> Yes
                        </span>
                      ) : field.type === 'image' || field.type === 'images' ? (
                        <span className="mt-2 block border border-dashed border-white/20 bg-black/25 p-4 normal-case tracking-normal">
                          <span className="flex flex-wrap gap-3">
                            {(field.type === 'images' ? (Array.isArray(value) ? value : []) : value ? [value] : []).map((url: any) => (
                              <span key={url} className="relative block h-28 w-28 overflow-hidden bg-black">
                                <Image src={url} alt="Uploaded order asset" fill unoptimized className="object-cover" />
                                {field.type === 'images' && <button type="button" onClick={() => removeImage(field.id, url)} className="absolute right-1 top-1 bg-black/80 px-2 py-1 text-[9px] font-black uppercase text-white">Remove</button>}
                              </span>
                            ))}
                          </span>
                          <span className="mt-3 flex flex-wrap items-center gap-3">
                            <span className="bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-black">{uploadingField === field.id ? 'Uploading...' : value && field.type === 'image' ? 'Replace image' : 'Choose image'}</span>
                            <span className="text-xs text-white/35">JPEG, PNG, WebP, or GIF / 10 MB max</span>
                          </span>
                          <input className="absolute h-px w-px overflow-hidden opacity-0" type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={Boolean(uploadingField)} onChange={(event) => upload(field, event)} />
                        </span>
                      ) : (
                        <input className={`${controlClass} normal-case tracking-normal`} type={field.type} value={String(value || '')} maxLength={field.maxLength} placeholder={field.placeholder} onChange={(event) => change(field.id, event.target.value)} />
                      )}
                    </label>
                    {field.help && <p className="mt-1 text-xs text-white/35">{field.help}</p>}
                  </div>
                )
              })}
            </div>

            {error && <p role="alert" className="mt-6 border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
              <button type="button" disabled={step === 0} onClick={() => { setStep((current) => Math.max(0, current - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="border border-white/20 px-4 py-2.5 text-xs font-black uppercase tracking-[0.13em] text-white/60 hover:text-white disabled:invisible">Back</button>
              {schema && step < schema.sections.length - 1 ? (
                <button type="button" onClick={continueForward} className="bg-brand-neon px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-black hover:bg-cyan-300">Save and continue</button>
              ) : (
                <button type="button" onClick={submit} disabled={saveState === 'saving' || Boolean(uploadingField)} className="bg-brand-neon px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-black hover:bg-cyan-300 disabled:opacity-50">{schema?.completionLabel}</button>
              )}
            </div>
          </section>
        </div>
      </main>
    </CityBeatShell>
  )
}
