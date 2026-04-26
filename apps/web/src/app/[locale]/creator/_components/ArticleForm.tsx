'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { withLocale } from '@/components/citybeat/content'
import { RichTextEditor } from './RichTextEditor'

const CATEGORIES = ['news', 'culture', 'events', 'business'] as const
type Category = typeof CATEGORIES[number]

const CATEGORY_LABELS: Record<Category, { en: string; es: string }> = {
  news:     { en: 'News',     es: 'Noticias' },
  culture:  { en: 'Culture',  es: 'Cultura'  },
  events:   { en: 'Events',   es: 'Eventos'  },
  business: { en: 'Business', es: 'Negocios' },
}

export interface ArticleFormValues {
  title: string
  authorName: string
  excerpt: string
  bodyText: string
  content: any
  category: Category | ''
  tags: string
  assetId: string
  imagePreviewUrl: string
}

interface ArticleFormProps {
  locale: 'en' | 'es'
  initialValues?: Partial<ArticleFormValues>
  articleId?: string
  mode: 'new' | 'edit'
}

const copy = {
  en: {
    newTitle: 'Write New Article',
    editTitle: 'Edit Article',
    backToDashboard: '← Dashboard',
    titleLabel: 'Title *',
    titlePlaceholder: 'Your article headline',
    authorLabel: 'Your Name',
    authorPlaceholder: 'How your byline will appear',
    categoryLabel: 'Category',
    categoryPlaceholder: 'Select a category',
    excerptLabel: 'Excerpt',
    excerptPlaceholder: 'A short summary (2–3 sentences) that draws readers in',
    bodyLabel: 'Article Body *',
    bodyPlaceholder: 'Write your article here. Separate paragraphs with a blank line.\n\nPro tip: lead with the most important information.',
    imageLabel: 'Featured Image',
    imageDrag: 'Drag & drop an image here',
    imageOr: 'or',
    imageBrowse: 'browse files',
    imageHint: 'JPEG, PNG, or WebP · Max 10 MB',
    imageChange: 'Change image',
    tagsLabel: 'Tags',
    tagsPlaceholder: 'el-paso, border, culture (comma-separated)',
    saveDraft: 'Save Draft',
    submit: 'Submit for Review',
    saving: 'Saving…',
    submitting: 'Submitting…',
    uploading: 'Uploading image…',
    titleRequired: 'Title is required.',
    bodyRequired: 'Article body is required.',
    successNew: 'Article saved! Redirecting to dashboard…',
    successEdit: 'Article updated!',
  },
  es: {
    newTitle: 'Escribir Nuevo Artículo',
    editTitle: 'Editar Artículo',
    backToDashboard: '← Panel',
    titleLabel: 'Título *',
    titlePlaceholder: 'El titular de tu artículo',
    authorLabel: 'Tu Nombre',
    authorPlaceholder: 'Cómo aparecerá tu firma',
    categoryLabel: 'Categoría',
    categoryPlaceholder: 'Selecciona una categoría',
    excerptLabel: 'Resumen',
    excerptPlaceholder: 'Un resumen breve (2–3 oraciones) que atraiga a los lectores',
    bodyLabel: 'Cuerpo del Artículo *',
    bodyPlaceholder: 'Escribe tu artículo aquí. Separa párrafos con una línea en blanco.\n\nConsejo: empieza con la información más importante.',
    imageLabel: 'Imagen Destacada',
    imageDrag: 'Arrastra y suelta una imagen aquí',
    imageOr: 'o',
    imageBrowse: 'explora archivos',
    imageHint: 'JPEG, PNG o WebP · Máx 10 MB',
    imageChange: 'Cambiar imagen',
    tagsLabel: 'Etiquetas',
    tagsPlaceholder: 'el-paso, frontera, cultura (separadas por coma)',
    saveDraft: 'Guardar Borrador',
    submit: 'Enviar para Revisión',
    saving: 'Guardando…',
    submitting: 'Enviando…',
    uploading: 'Subiendo imagen…',
    titleRequired: 'El título es obligatorio.',
    bodyRequired: 'El cuerpo del artículo es obligatorio.',
    successNew: '¡Artículo guardado! Redirigiendo al panel…',
    successEdit: '¡Artículo actualizado!',
  },
}

export function ArticleForm({ locale, initialValues, articleId, mode }: ArticleFormProps) {
  const router = useRouter()
  const t = copy[locale]
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [values, setValues] = useState<ArticleFormValues>({
    title: initialValues?.title ?? '',
    authorName: initialValues?.authorName ?? '',
    excerpt: initialValues?.excerpt ?? '',
    bodyText: initialValues?.bodyText ?? '',
    content: initialValues?.content ?? null,
    category: initialValues?.category ?? '',
    tags: initialValues?.tags ?? '',
    assetId: initialValues?.assetId ?? '',
    imagePreviewUrl: initialValues?.imagePreviewUrl ?? '',
  })

  const [errors, setErrors] = useState<Partial<Record<keyof ArticleFormValues, string>>>({})
  const [status, setStatus] = useState<'idle' | 'uploading' | 'saving' | 'submitting' | 'success'>('idle')
  const [isDragOver, setIsDragOver] = useState(false)
  const [feedback, setFeedback] = useState('')

  const set = (field: keyof ArticleFormValues) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setValues((prev) => ({ ...prev, [field]: e.target.value }))
    setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  const uploadImage = useCallback(async (file: File) => {
    setStatus('uploading')
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/creator/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setValues((prev) => ({
        ...prev,
        assetId: data.assetId,
        imagePreviewUrl: data.url,
      }))
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setStatus('idle')
    }
  }, [])

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) uploadImage(file)
    },
    [uploadImage]
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadImage(file)
  }

  const validate = (): boolean => {
    const errs: Partial<Record<keyof ArticleFormValues, string>> = {}
    if (!values.title.trim()) errs.title = t.titleRequired
    if (!values.content && !values.bodyText.trim()) errs.bodyText = t.bodyRequired
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (submitForReview: boolean) => {
    if (!validate()) return

    setStatus(submitForReview ? 'submitting' : 'saving')
    setFeedback('')

    const payload = {
      title: values.title.trim(),
      authorName: values.authorName.trim(),
      excerpt: values.excerpt.trim(),
      content: values.content,
      bodyText: values.bodyText.trim(),
      category: values.category,
      tags: values.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      assetId: values.assetId || undefined,
      submitForReview,
    }

    try {
      let res: Response
      if (mode === 'new') {
        res = await fetch('/api/creator/articles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch(`/api/creator/articles/${articleId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }

      setStatus('success')
      setFeedback(mode === 'new' ? t.successNew : t.successEdit)
      setTimeout(() => router.push(withLocale(locale, '/creator')), 1200)
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Something went wrong')
      setStatus('idle')
    }
  }

  const busy = status !== 'idle'

  return (
    <div className="min-h-screen bg-brand-dark text-white">
      <div className="mx-auto max-w-3xl px-4 py-10">
        {/* Back link */}
        <Link
          href={withLocale(locale, '/creator')}
          className="mb-8 inline-block text-sm text-white/40 transition hover:text-white/70"
        >
          {t.backToDashboard}
        </Link>

        <h1 className="mb-8 font-display text-4xl font-black tracking-tight">
          {mode === 'new' ? t.newTitle : t.editTitle}
        </h1>

        <div className="flex flex-col gap-6">
          {/* Title */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/60">
              {t.titleLabel}
            </label>
            <input
              type="text"
              value={values.title}
              onChange={set('title')}
              placeholder={t.titlePlaceholder}
              disabled={busy}
              className={`w-full rounded-lg border bg-white/5 px-4 py-3 text-lg font-semibold text-white placeholder-white/20 outline-none transition focus:border-brand-neon focus:bg-white/8 disabled:opacity-50 ${
                errors.title ? 'border-red-500' : 'border-white/15'
              }`}
            />
            {errors.title && <p className="mt-1 text-xs text-red-400">{errors.title}</p>}
          </div>

          {/* Author + Category row */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/60">
                {t.authorLabel}
              </label>
              <input
                type="text"
                value={values.authorName}
                onChange={set('authorName')}
                placeholder={t.authorPlaceholder}
                disabled={busy}
                className="w-full rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/20 outline-none transition focus:border-brand-neon disabled:opacity-50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/60">
                {t.categoryLabel}
              </label>
              <select
                value={values.category}
                onChange={set('category')}
                disabled={busy}
                className="w-full rounded-lg border border-white/15 bg-brand-charcoal px-4 py-3 text-white outline-none transition focus:border-brand-neon disabled:opacity-50"
              >
                <option value="">{t.categoryPlaceholder}</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c][locale]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Excerpt */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/60">
              {t.excerptLabel}
            </label>
            <textarea
              value={values.excerpt}
              onChange={set('excerpt')}
              placeholder={t.excerptPlaceholder}
              disabled={busy}
              rows={3}
              className="w-full resize-none rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/20 outline-none transition focus:border-brand-neon disabled:opacity-50"
            />
          </div>

          {/* Featured Image */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/60">
              {t.imageLabel}
            </label>
            {values.imagePreviewUrl ? (
              <div className="relative h-56 overflow-hidden rounded-xl">
                <Image
                  src={values.imagePreviewUrl}
                  alt="Featured"
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
                  {status === 'uploading' ? t.uploading : t.imageChange}
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-12 text-center transition ${
                  isDragOver
                    ? 'border-brand-neon bg-brand-neon/5'
                    : 'border-white/15 bg-white/3 hover:border-white/30'
                }`}
              >
                {status === 'uploading' ? (
                  <p className="text-sm text-white/50">{t.uploading}</p>
                ) : (
                  <>
                    <span className="text-3xl">🖼️</span>
                    <p className="text-sm text-white/50">{t.imageDrag}</p>
                    <p className="text-xs text-white/30">
                      {t.imageOr}{' '}
                      <span className="text-brand-neon underline underline-offset-2">{t.imageBrowse}</span>
                    </p>
                    <p className="text-xs text-white/20">{t.imageHint}</p>
                  </>
                )}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Body */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/60">
              {t.bodyLabel}
            </label>
            <RichTextEditor
              content={values.content || values.bodyText}
              onChange={(c) => setValues((v) => ({ ...v, content: c }))}
              placeholder={t.bodyPlaceholder}
            />
            {errors.bodyText && <p className="mt-1 text-xs text-red-400">{errors.bodyText}</p>}
          </div>

          {/* Tags */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-white/60">
              {t.tagsLabel}
            </label>
            <input
              type="text"
              value={values.tags}
              onChange={set('tags')}
              placeholder={t.tagsPlaceholder}
              disabled={busy}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/20 outline-none transition focus:border-brand-neon disabled:opacity-50"
            />
          </div>

          {/* Feedback */}
          {feedback && (
            <p className={`rounded-lg px-4 py-3 text-sm font-medium ${
              status === 'success'
                ? 'bg-brand-neon/10 text-brand-neon'
                : 'bg-red-500/10 text-red-400'
            }`}>
              {feedback}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-6 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={busy}
              className="rounded-md border border-white/20 px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-white/70 transition hover:border-white/40 hover:text-white disabled:opacity-40"
            >
              {status === 'saving' ? t.saving : t.saveDraft}
            </button>
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={busy}
              className="rounded-md bg-brand-neon px-6 py-2.5 text-sm font-black uppercase tracking-wider text-black transition hover:bg-cyan-300 disabled:opacity-40"
            >
              {status === 'submitting' ? t.submitting : t.submit}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
