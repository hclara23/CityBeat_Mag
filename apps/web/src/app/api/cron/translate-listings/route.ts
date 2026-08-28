import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { translateTexts , translateArticleToEs } from '@/lib/translate'
import { reportFailure, reportSuccess } from '@/lib/alerts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

// Backfills `description_es` for directory listings that have an English
// description but no Spanish one, so ES visitors (most of El Paso) read real
// Spanish. New/edited listings are translated on save in /api/directory/[id];
// this catches everything that predates that. Batched under DeepL limits.
export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 25, 1), 40)
  // `?articles=1`: backfill mode for ARTICLES whose Spanish is missing or was
  // stored as a copy of the English (the pre-fix silent fallback). Uses the
  // same translation pipeline; one-shot repair + safety net.
  if (searchParams.get('articles') === '1') {
    const snap = await adminDb.collection('articles').limit(400).get()
    let fixed = 0
    let scanned = 0
    for (const doc of snap.docs) {
      if (fixed >= limit) break
      const a = doc.data() as any
      scanned++
      const en = typeof a.content === 'string' ? a.content : ''
      const es = typeof a.content_es === 'string' ? a.content_es : ''
      const missing = !es.trim()
      const englishAsSpanish = Boolean(es.trim()) && en.trim() && es.trim() === en.trim()
      const titleCopied = a.title_es && a.title && String(a.title_es).trim() === String(a.title).trim()
      if (!missing && !englishAsSpanish && !titleCopied) continue
      if (englishAsSpanish || titleCopied) {
        // Clear the copies so translateArticleToEs's keep-existing guard
        // doesn't treat English text as real Spanish.
        await doc.ref.set({ content_es: '', title_es: '', excerpt_es: '' }, { merge: true })
      }
      await translateArticleToEs(doc.ref, { title: a.title, excerpt: a.excerpt, content: a.content })
      fixed++
    }
    return NextResponse.json({ mode: 'articles', scanned, repaired: fixed })
  }

  try {
    // Firestore can't query for a missing field, so scan published listings.
    const snap = await adminDb.collection('directory_listings').where('is_published', '==', true).get()
    const todo: { id: string; description: string }[] = []
    snap.forEach((d) => {
      const l = d.data() as any
      const desc = typeof l.description === 'string' ? l.description.trim() : ''
      const hasEs = typeof l.description_es === 'string' && l.description_es.trim().length > 0
      if (desc && !hasEs) todo.push({ id: d.id, description: desc })
    })

    const batch = todo.slice(0, limit)
    if (batch.length === 0) {
      await reportSuccess('cron:translate-listings')
      return NextResponse.json({ ok: true, candidates: 0, translated: 0, remaining: 0 })
    }

    const translations = await translateTexts(batch.map((b) => b.description.slice(0, 4000)))
    let translated = 0
    if (translations) {
      await Promise.all(
        batch.map((b, i) => {
          const es = translations[i]
          if (!es) return Promise.resolve()
          translated++
          return adminDb
            .collection('directory_listings')
            .doc(b.id)
            .set({ description_es: es, updated_at: new Date().toISOString() }, { merge: true })
        }),
      )
    }

    await reportSuccess('cron:translate-listings')
    return NextResponse.json({ ok: true, candidates: todo.length, translated, remaining: Math.max(0, todo.length - translated) })
  } catch (error) {
    await reportFailure('cron:translate-listings', error)
    return NextResponse.json({ error: 'translate-listings failed' }, { status: 500 })
  }
}
