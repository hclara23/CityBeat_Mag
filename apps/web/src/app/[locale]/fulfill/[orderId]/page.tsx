'use client'

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { useLocale } from '@/components/TranslationProvider'
import { intakeCompletion, type IntakeField, type IntakeSchema } from '@/lib/sales-intake'
import { FULFILL_COPY, localizeIntakeSchema } from '../intake-i18n'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const controlClass =
  'mt-1.5 w-full rounded-md border border-white/15 bg-black/35 px-3 py-2.5 text-white outline-none transition placeholder:text-white/25 focus:border-brand-neon/70 focus:ring-2 focus:ring-brand-neon/10'

function formatMoney(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100)
}

export default function CustomerFulfillmentWizard({ params }: { params: { orderId: string } }) {
  const locale = useLocale() as 'en' | 'es'
  // The intake API mails a Spanish buyer an /es/fulfill link on purpose (it
  // reads order.locale, stamped at checkout), and this page rendered a wholly
  // English form: the customer had paid, could not finish the brief, and the
  // resume email is stamped sent exactly once. Chrome copy comes from
  // FULFILL_COPY; the product-specific field copy is translated below.
  const t = FULFILL_COPY[locale] || FULFILL_COPY.en
  // Server error strings from the intake API are English-only. Preferring them
  // over the translated fallback (`data.error || t.errorOpen`) meant a Spanish
  // buyer - who was deliberately emailed an /es/ link because order.locale said
  // so - hit an English error in the middle of a form they had already paid for,
  // with a resume email that is only ever sent once.
  //
  // For /es the translated message wins. The server detail is not discarded: it
  // still reaches the error reporter, where it is useful to whoever debugs it,
  // rather than to a customer who may not read it.
  const [accessToken, setAccessToken] = useState('')
  const [order, setOrder] = useState<any>(null)
  const [sourceSchema, setSourceSchema] = useState<IntakeSchema | null>(null)
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

  // Display only. Field ids and select option values are what the server
  // sanitizer matches on, so localizeIntakeSchema leaves both untouched —
  // translating either would silently discard the customer's answers.
  const schema = useMemo(
    () => (sourceSchema ? localizeIntakeSchema(sourceSchema, locale) : null),
    [sourceSchema, locale]
  )

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    const access = query.get('access') || ''
    setAccessToken(access)
    fetch(`/api/sales/orders/${encodeURIComponent(params.orderId)}/intake?${query.toString()}`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(locale === 'es' ? t.errorOpen : data.error || t.errorOpen)
        setOrder(data.order)
        setSourceSchema(data.schema)
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
      .catch((loadError) => setError(locale === 'es' ? t.errorOpen : loadError?.message || t.errorOpen))
      .finally(() => setLoading(false))
  }, [params.orderId, locale, t.errorOpen])

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
        if (!response.ok) throw new Error(locale === 'es' ? t.errorSave : data.error || t.errorSave)
        setCompletion(data.completion ?? intakeCompletion(schema, nextValues))
        setSaveState('saved')
        return true
      } catch (saveError: any) {
        setSaveState('error')
        if (!quiet) setError(locale === 'es' ? t.errorSave : saveError?.message || t.errorSave)
        return false
      }
    },
    [accessToken, apiUrl, locale, schema, submitted, t.errorSave]
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
      if (!response.ok || !data.asset?.url) throw new Error(locale === 'es' ? t.errorUpload : data.error || t.errorUpload)
      if (field.type === 'images') {
        const current = Array.isArray(values[field.id]) ? (values[field.id] as string[]) : []
        change(field.id, [...current, data.asset.url].slice(0, 8))
      } else {
        change(field.id, data.asset.url)
      }
    } catch (uploadError: any) {
      setError(locale === 'es' ? t.errorUpload : uploadError?.message || t.errorUpload)
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
        throw new Error(data.error || t.errorRequired)
      }
      setCompletion(100)
      setSaveState('saved')
      setSubmitted(true)
    } catch (submitError: any) {
      setSaveState('error')
      setError(submitError?.message || t.errorSubmit)
    }
  }

  if (loading) {
    return <CityBeatShell locale={locale}><main className="container-wide flex min-h-[60vh] items-center justify-center text-sm font-black uppercase tracking-[0.2em] text-white/40">{t.loading}</main></CityBeatShell>
  }

  if (error && (!order || !schema)) {
    return (
      <CityBeatShell locale={locale}>
        <main className="container-wide flex min-h-[65vh] items-center justify-center py-16">
          <div className="max-w-lg border border-brand-magenta/30 bg-brand-magenta/10 p-7">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-magenta">{t.accessEyebrow}</p>
            <h1 className="mt-2 font-display text-3xl font-black text-white">{t.accessTitle}</h1>
            <p className="mt-3 leading-6 text-white/65">{error}</p>
            {/* Name the support address instead of "contact CityBeat": a paid
                customer who cannot open their brief and has nowhere to write is
                exactly how a fulfillment problem becomes a card dispute. */}
            <p className="mt-4 text-sm text-white/40">{t.accessHelp(params.orderId)}</p>
          </div>
        </main>
      </CityBeatShell>
    )
  }

  if (submitted) {
    return (
      <CityBeatShell locale={locale}>
        <main className="container-wide flex min-h-[70vh] items-center justify-center py-16">
          <div className="max-w-2xl rounded-2xl border border-brand-neon/30 bg-brand-neon/[0.07] p-8 text-center sm:p-12">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-neon text-2xl font-black text-black">✓</div>
            <p className="mt-6 text-xs font-black uppercase tracking-[0.26em] text-brand-neon">{t.doneEyebrow}</p>
            <h1 className="mt-2 font-display text-4xl font-black text-white">{t.doneTitle}</h1>
            <p className="mx-auto mt-4 max-w-xl leading-7 text-white/60">
              {t.doneBody(order?.product_name || (locale === 'es' ? 'tu pedido' : 'your order'), order?.contact_email)}
            </p>
            <p className="mt-6 text-xs text-white/35">{t.orderReference}: {params.orderId}</p>
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
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-neon">{t.headerEyebrow}</p>
              <h1 className="mt-2 font-display text-3xl font-black text-white sm:text-4xl">{schema?.title}</h1>
              <p className="mt-2 text-sm text-white/50">{t.autosave(order?.contact_email)}</p>
            </div>
            <div className="border-l-2 border-brand-magenta pl-4 text-right">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/40">{order?.product_name}</p>
              <p className="mt-1 font-display text-2xl font-black text-white">{formatMoney(order?.amount_paid || order?.amount)}</p>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-brand-neon">{t.paid}</p>
            </div>
          </div>
        </header>

        <div className="mt-5 h-1 bg-white/10" aria-label={t.progressLabel(localCompletion)}>
          <div className="h-full bg-brand-neon transition-all duration-500" style={{ width: `${localCompletion}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.15em]">
          <span className="text-white/35">{t.progressText(localCompletion)}</span>
          <span className={saveState === 'error' ? 'text-red-300' : 'text-brand-neon/70'}>
            {saveState === 'saving' ? t.saving : saveState === 'error' ? t.saveFailed : t.saved}
          </span>
        </div>

        <div className="mt-7 grid gap-7 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav aria-label={t.stepsNav} className="space-y-px">
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
              <strong className="block text-white/70">{t.privateTitle}</strong>
              {t.privateBody}
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
                          <option value="">{t.chooseOne}</option>
                          {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      ) : field.type === 'checkbox' ? (
                        <span className="mt-2 flex items-center gap-3 border border-white/10 bg-black/25 px-3 py-3 normal-case tracking-normal">
                          <input type="checkbox" checked={value === true} onChange={(event) => change(field.id, event.target.checked)} className="h-5 w-5 accent-cyan-300" /> {t.yes}
                        </span>
                      ) : field.type === 'image' || field.type === 'images' ? (
                        <span className="mt-2 block border border-dashed border-white/20 bg-black/25 p-4 normal-case tracking-normal">
                          <span className="flex flex-wrap gap-3">
                            {(field.type === 'images' ? (Array.isArray(value) ? value : []) : value ? [value] : []).map((url: any) => (
                              <span key={url} className="relative block h-28 w-28 overflow-hidden bg-black">
                                <Image src={url} alt={t.uploadedAlt} fill unoptimized className="object-cover" />
                                {field.type === 'images' && <button type="button" onClick={() => removeImage(field.id, url)} className="absolute right-1 top-1 bg-black/80 px-2 py-1 text-[9px] font-black uppercase text-white">{t.remove}</button>}
                              </span>
                            ))}
                          </span>
                          <span className="mt-3 flex flex-wrap items-center gap-3">
                            <span className="bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-black">{uploadingField === field.id ? t.uploading : value && field.type === 'image' ? t.replaceImage : t.chooseImage}</span>
                            <span className="text-xs text-white/35">{t.imageHint}</span>
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
              <button type="button" disabled={step === 0} onClick={() => { setStep((current) => Math.max(0, current - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="border border-white/20 px-4 py-2.5 text-xs font-black uppercase tracking-[0.13em] text-white/60 hover:text-white disabled:invisible">{t.back}</button>
              {schema && step < schema.sections.length - 1 ? (
                <button type="button" onClick={continueForward} className="bg-brand-neon px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-black hover:bg-cyan-300">{t.saveAndContinue}</button>
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
