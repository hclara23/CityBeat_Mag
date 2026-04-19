'use client'

import { useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import { SiteHeader } from '@/components/citybeat/SiteHeader'
import { SiteFooter } from '@/components/citybeat/SiteFooter'
import { useLocale } from '@/components/TranslationProvider'

const CATEGORIES = [
  { value: 'news',     en: 'News',     es: 'Noticias' },
  { value: 'culture',  en: 'Culture',  es: 'Cultura'  },
  { value: 'events',   en: 'Events',   es: 'Eventos'  },
  { value: 'business', en: 'Business', es: 'Negocios' },
]

const copy = {
  en: {
    hero: 'Share Your Story',
    heroDek: 'CityBeat is built on the voices of El Paso. Submit an article, a tip, or a photo story and our editors will review it for publication.',
    guidelines: [
      'Original, unpublished work only',
      'Covers El Paso County, Ciudad Juárez, or the broader borderlands',
      'Factual reporting or first-person community perspective',
      'No promotional content or press releases',
    ],
    guidelinesTitle: 'Submission guidelines',
    nameLabel: 'Your Name *',
    namePlaceholder: 'How your byline will appear',
    emailLabel: 'Email Address *',
    emailPlaceholder: 'For editorial follow-up (not published)',
    titleLabel: 'Article Title *',
    titlePlaceholder: 'A clear, specific headline',
    categoryLabel: 'Category',
    categoryPlaceholder: 'Choose a section',
    excerptLabel: 'Summary (optional)',
    excerptPlaceholder: '2–3 sentences that describe your piece',
    bodyLabel: 'Your Article *',
    bodyPlaceholder: 'Write your piece here. Separate paragraphs with a blank line.\n\nMinimum 100 characters. Lead with the most important information.',
    imageLabel: 'Photo / Image (optional)',
    imageDrag: 'Drag & drop a photo here',
    imageOr: 'or',
    imageBrowse: 'browse to upload',
    imageHint: 'JPEG, PNG, or WebP · Max 10 MB',
    imageChange: 'Change photo',
    tagsLabel: 'Tags (optional)',
    tagsPlaceholder: 'e.g. el-paso, downtown, arts (comma-separated)',
    agreeLabel: 'I confirm this is my original work and I have the rights to any images submitted.',
    submit: 'Submit for Review',
    submitting: 'Submitting…',
    uploading: 'Uploading photo…',
    successTitle: 'Thank you for your submission!',
    successBody: 'Our editorial team will review your piece. We\'ll be in touch at the email you provided.',
    successCta: 'Submit another piece',
    errorGeneric: 'Something went wrong. Please try again.',
  },
  es: {
    hero: 'Comparte Tu Historia',
    heroDek: 'CityBeat se construye con las voces de El Paso. Envía un artículo, una pista o una historia fotográfica y nuestros editores la revisarán para publicarla.',
    guidelines: [
      'Solo trabajo original no publicado',
      'Cubre El Paso County, Ciudad Juárez o la región fronteriza',
      'Reportaje factual o perspectiva comunitaria en primera persona',
      'Sin contenido promocional ni comunicados de prensa',
    ],
    guidelinesTitle: 'Lineamientos de envío',
    nameLabel: 'Tu Nombre *',
    namePlaceholder: 'Cómo aparecerá tu firma',
    emailLabel: 'Correo Electrónico *',
    emailPlaceholder: 'Para seguimiento editorial (no se publica)',
    titleLabel: 'Título del Artículo *',
    titlePlaceholder: 'Un titular claro y específico',
    categoryLabel: 'Categoría',
    categoryPlaceholder: 'Elige una sección',
    excerptLabel: 'Resumen (opcional)',
    excerptPlaceholder: '2–3 oraciones que describan tu pieza',
    bodyLabel: 'Tu Artículo *',
    bodyPlaceholder: 'Escribe tu pieza aquí. Separa párrafos con una línea en blanco.\n\nMínimo 100 caracteres. Comienza con la información más importante.',
    imageLabel: 'Foto / Imagen (opcional)',
    imageDrag: 'Arrastra y suelta una foto aquí',
    imageOr: 'o',
    imageBrowse: 'explora para subir',
    imageHint: 'JPEG, PNG o WebP · Máx 10 MB',
    imageChange: 'Cambiar foto',
    tagsLabel: 'Etiquetas (opcional)',
    tagsPlaceholder: 'ej: el-paso, centro, artes (separadas por coma)',
    agreeLabel: 'Confirmo que este es mi trabajo original y tengo los derechos de las imágenes enviadas.',
    submit: 'Enviar para Revisión',
    submitting: 'Enviando…',
    uploading: 'Subiendo foto…',
    successTitle: '¡Gracias por tu envío!',
    successBody: 'Nuestro equipo editorial revisará tu pieza. Nos pondremos en contacto al correo que proporcionaste.',
    successCta: 'Enviar otra pieza',
    errorGeneric: 'Algo salió mal. Por favor intenta de nuevo.',
  },
}

type FieldErrors = Record<string, string>
type Status = 'idle' | 'uploading' | 'submitting' | 'success'

export default function ContributePage() {
  const locale = useLocale() as 'en' | 'es'
  const t = copy[locale]
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [tags, setTags] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)

  const [status, setStatus] = useState<Status>('idle')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState('')

  const pickImage = useCallback((file: File) => {
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }, [])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) pickImage(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) pickImage(file)
  }

  const clearField = (field: string) =>
    setFieldErrors((prev) => { const next = { ...prev }; delete next[field]; return next })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError('')
    setFieldErrors({})

    const fd = new FormData()
    fd.append('name', name)
    fd.append('email', email)
    fd.append('title', title)
    fd.append('bodyText', bodyText)
    fd.append('excerpt', excerpt)
    fd.append('category', category)
    fd.append('tags', tags)
    fd.append('agreeTerms', String(agreeTerms))
    fd.append('website', '') // honeypot — must stay empty
    if (imageFile) fd.append('image', imageFile)

    setStatus('submitting')

    try {
      const res = await fetch('/api/contribute', { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 422 && data.fields) {
          setFieldErrors(data.fields)
          setStatus('idle')
          return
        }
        throw new Error(data.error || t.errorGeneric)
      }

      setStatus('success')
    } catch (err) {
      setServerError(err instanceof Error ? err.message : t.errorGeneric)
      setStatus('idle')
    }
  }

  const reset = () => {
    setName(''); setEmail(''); setTitle(''); setCategory('')
    setExcerpt(''); setBodyText(''); setTags(''); setAgreeTerms(false)
    setImageFile(null); setImagePreview('')
    setStatus('idle'); setFieldErrors({}); setServerError('')
  }

  const busy = status !== 'idle'

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-brand-dark text-white">
        <SiteHeader />
        <main className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
          <div className="max-w-md">
            <div className="mb-6 text-6xl">🎉</div>
            <h1 className="font-display text-4xl font-black tracking-tight text-brand-neon">
              {t.successTitle}
            </h1>
            <p className="mt-4 leading-relaxed text-white/60">{t.successBody}</p>
            <button
              type="button"
              onClick={reset}
              className="mt-8 rounded-md border border-white/20 px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-white/70 transition hover:border-white/40 hover:text-white"
            >
              {t.successCta}
            </button>
          </div>
        </main>
        <SiteFooter locale={locale} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-dark text-white">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-4 py-14">
        {/* Hero */}
        <div className="mb-12 border-b border-white/10 pb-10">
          <h1 className="font-display text-5xl font-black tracking-tighter">
            {t.hero}
          </h1>
          <p className="mt-4 max-w-xl leading-relaxed text-white/60">{t.heroDek}</p>

          {/* Guidelines */}
          <div className="mt-8 rounded-xl border border-brand-neon/20 bg-brand-neon/5 px-6 py-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-neon">
              {t.guidelinesTitle}
            </p>
            <ul className="flex flex-col gap-2">
              {t.guidelines.map((g, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/60">
                  <span className="mt-0.5 text-brand-neon">✓</span>
                  {g}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-7">
          {/* Honeypot — hidden from humans, must not be filled */}
          <input type="text" name="website" tabIndex={-1} aria-hidden aria-label="Leave this field empty" className="hidden" />

          {/* Name + Email */}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t.nameLabel} error={fieldErrors.name}>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); clearField('name') }}
                placeholder={t.namePlaceholder}
                disabled={busy}
                className={inputCls(fieldErrors.name)}
              />
            </Field>
            <Field label={t.emailLabel} error={fieldErrors.email}>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clearField('email') }}
                placeholder={t.emailPlaceholder}
                disabled={busy}
                className={inputCls(fieldErrors.email)}
              />
            </Field>
          </div>

          {/* Title */}
          <Field label={t.titleLabel} error={fieldErrors.title}>
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); clearField('title') }}
              placeholder={t.titlePlaceholder}
              disabled={busy}
              className={`${inputCls(fieldErrors.title)} text-lg font-semibold`}
            />
          </Field>

          {/* Category + Tags */}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t.categoryLabel}>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={busy}
                aria-label={t.categoryLabel}
                className="w-full rounded-lg border border-white/15 bg-brand-charcoal px-4 py-3 text-white outline-none transition focus:border-brand-neon disabled:opacity-50"
              >
                <option value="">{t.categoryPlaceholder}</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c[locale]}</option>
                ))}
              </select>
            </Field>
            <Field label={t.tagsLabel}>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder={t.tagsPlaceholder}
                disabled={busy}
                className={inputCls()}
              />
            </Field>
          </div>

          {/* Excerpt */}
          <Field label={t.excerptLabel}>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder={t.excerptPlaceholder}
              disabled={busy}
              rows={3}
              className="w-full resize-none rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/20 outline-none transition focus:border-brand-neon disabled:opacity-50"
            />
          </Field>

          {/* Image upload */}
          <Field label={t.imageLabel}>
            {imagePreview ? (
              <div className="relative h-56 overflow-hidden rounded-xl">
                <Image
                  src={imagePreview}
                  alt="Preview"
                  fill
                  unoptimized
                  sizes="(max-width: 768px) 100vw, 768px"
                  className="object-cover"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  className="absolute bottom-3 right-3 rounded-md bg-black/70 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white backdrop-blur transition hover:bg-black/90 disabled:opacity-40"
                >
                  {t.imageChange}
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-12 text-center transition ${
                  isDragOver
                    ? 'border-brand-neon bg-brand-neon/5'
                    : 'border-white/15 hover:border-white/30'
                }`}
              >
                <span className="text-3xl">📷</span>
                <p className="text-sm text-white/50">{t.imageDrag}</p>
                <p className="text-xs text-white/30">
                  {t.imageOr}{' '}
                  <span className="text-brand-neon underline underline-offset-2">{t.imageBrowse}</span>
                </p>
                <p className="text-xs text-white/20">{t.imageHint}</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileChange}
              aria-label={t.imageLabel}
              className="hidden"
            />
          </Field>

          {/* Body */}
          <Field label={t.bodyLabel} error={fieldErrors.bodyText}>
            <textarea
              value={bodyText}
              onChange={(e) => { setBodyText(e.target.value); clearField('bodyText') }}
              placeholder={t.bodyPlaceholder}
              disabled={busy}
              rows={20}
              className={`w-full resize-y rounded-lg border bg-white/5 px-4 py-3 text-sm leading-relaxed text-white placeholder-white/20 outline-none transition focus:border-brand-neon disabled:opacity-50 ${
                fieldErrors.bodyText ? 'border-red-500' : 'border-white/15'
              }`}
            />
            <p className="mt-1 text-right text-xs text-white/30">{bodyText.length} chars</p>
          </Field>

          {/* Agreement */}
          <Field error={fieldErrors.agreeTerms}>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => { setAgreeTerms(e.target.checked); clearField('agreeTerms') }}
                disabled={busy}
                className="mt-0.5 h-4 w-4 flex-shrink-0 accent-brand-neon"
              />
              <span className="text-sm leading-relaxed text-white/60">{t.agreeLabel}</span>
            </label>
          </Field>

          {/* Server error */}
          {serverError && (
            <p className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{serverError}</p>
          )}

          {/* Submit */}
          <div className="border-t border-white/10 pt-6">
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-brand-neon py-3.5 text-sm font-black uppercase tracking-widest text-black transition hover:bg-cyan-300 disabled:opacity-50 sm:w-auto sm:px-10"
            >
              {status === 'submitting' ? t.submitting : t.submit}
            </button>
          </div>
        </form>
      </main>

      <SiteFooter locale={locale} />
    </div>
  )
}

// — helpers —

function inputCls(error?: string) {
  return `w-full rounded-lg border bg-white/5 px-4 py-3 text-white placeholder-white/20 outline-none transition focus:border-brand-neon disabled:opacity-50 ${
    error ? 'border-red-500' : 'border-white/15'
  }`
}

function Field({
  label,
  error,
  children,
}: {
  label?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      {label && (
        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/60">
          {label}
        </label>
      )}
      {children}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}
