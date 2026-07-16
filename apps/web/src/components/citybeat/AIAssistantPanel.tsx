'use client'

import { useEffect, useState } from 'react'
import { useLocale } from '@/components/TranslationProvider'

interface Draft {
  id: string
  listing_id: string
  business_name: string | null
  deal: { title: string; description: string } | null
  captions: string[]
  review_replies: { review_id: string; reply: string }[]
  created_at: string | null
}

// Weekly AI-drafted marketing for the owner's paying listings: approve a deal,
// post review replies, copy social captions. Nothing publishes without a click.
export function AIAssistantPanel() {
  const isEs = useLocale() === 'es'
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('')

  const load = () =>
    fetch('/api/ai-workproduct')
      .then((r) => (r.ok ? r.json() : { drafts: [] }))
      .then((d) => setDrafts(d.drafts || []))
      .catch(() => setDrafts([]))

  useEffect(() => {
    load()
  }, [])

  const act = async (workId: string, action: string, reviewId?: string) => {
    setBusy(`${workId}:${action}:${reviewId || ''}`)
    setNote('')
    try {
      const res = await fetch('/api/ai-workproduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workId, action, reviewId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || (isEs ? 'Error' : 'Failed'))
      setNote(
        action === 'approve_deal'
          ? (isEs ? '¡Oferta publicada!' : 'Deal published!')
          : action === 'approve_reply'
            ? (isEs ? '¡Respuesta publicada!' : 'Reply posted!')
            : (isEs ? 'Descartado.' : 'Dismissed.'),
      )
      await load()
    } catch (e: any) {
      setNote(e.message)
    } finally {
      setBusy('')
    }
  }

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(() => setNote(isEs ? 'Texto copiado — pégalo en tu app social.' : 'Caption copied — paste it into your social app.'))
  }

  if (drafts === null || drafts.length === 0) return null

  return (
    <div className="mb-12">
      <h2 className="text-2xl font-bold mb-2">{isEs ? 'Tu asistente de marketing con IA' : 'Your AI marketing assistant'}</h2>
      <p className="text-sm text-gray-500 mb-6">
        {isEs
          ? 'Marketing nuevo redactado para tu negocio cada semana. Nada se publica hasta que lo apruebes.'
          : 'Fresh marketing drafted for your business each week. Nothing goes live until you approve it.'}
      </p>
      {note && <p className="mb-4 text-sm font-semibold text-cyan-700">{note}</p>}

      <div className="grid gap-4">
        {drafts.map((d) => (
          <div key={d.id} className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-gray-900">{d.business_name || (isEs ? 'Tu negocio' : 'Your business')}</p>
              <button
                onClick={() => act(d.id, 'dismiss')}
                disabled={busy.startsWith(d.id)}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                {isEs ? 'Descartar todo' : 'Dismiss all'}
              </button>
            </div>

            {d.deal && (
              <div className="mb-4 rounded-md border border-cyan-200 bg-cyan-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-cyan-700 mb-1">{isEs ? 'Oferta sugerida' : 'Suggested deal'}</p>
                <p className="font-bold text-gray-900">{d.deal.title}</p>
                {d.deal.description && <p className="text-sm text-gray-600 mt-1">{d.deal.description}</p>}
                <button
                  onClick={() => act(d.id, 'approve_deal')}
                  disabled={busy === `${d.id}:approve_deal:`}
                  className="mt-3 rounded bg-cyan-600 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-white hover:bg-cyan-700"
                >
                  {isEs ? 'Publicar oferta (dura 14 días)' : 'Publish deal (runs 14 days)'}
                </button>
              </div>
            )}

            {d.review_replies.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-2">{isEs ? 'Respuestas a reseñas' : 'Review replies'}</p>
                <div className="grid gap-2">
                  {d.review_replies.map((r) => (
                    <div key={r.review_id} className="flex items-start justify-between gap-3 rounded-md border border-gray-200 bg-white p-3">
                      <p className="text-sm text-gray-700">{r.reply}</p>
                      <button
                        onClick={() => act(d.id, 'approve_reply', r.review_id)}
                        disabled={busy === `${d.id}:approve_reply:${r.review_id}`}
                        className="shrink-0 rounded bg-gray-900 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-gray-700"
                      >
                        {isEs ? 'Publicar respuesta' : 'Post reply'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {d.captions.length > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-2">{isEs ? 'Textos para redes' : 'Social captions'}</p>
                <div className="grid gap-2">
                  {d.captions.map((c, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 rounded-md border border-gray-200 bg-white p-3">
                      <p className="text-sm text-gray-700">{c}</p>
                      <button
                        onClick={() => copy(c)}
                        className="shrink-0 rounded border border-gray-300 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-gray-600 hover:bg-gray-100"
                      >
                        {isEs ? 'Copiar' : 'Copy'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
