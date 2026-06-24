import { FieldValue } from 'firebase-admin/firestore'
import type { DocumentReference } from 'firebase-admin/firestore'

// Translation goes through the Cloudflare worker (which holds the DeepL key).
// The web app authenticates with the shared INGEST_SECRET it already uses.
const WORKER_URL = process.env.WORKER_URL || 'https://citybeat-worker.morningstarelp.workers.dev'
const DEEPL_MAX_BATCH = 40 // DeepL allows up to 50 texts per request; stay under.

// Translate an array of strings EN->ES (chunked). Returns null on any failure
// so callers can fall back to the original language without breaking.
export async function translateTexts(texts: string[]): Promise<string[] | null> {
  const secret = process.env.INGEST_SECRET
  if (!secret) {
    console.error('translateTexts: INGEST_SECRET not set')
    return null
  }
  if (texts.length === 0) return []

  const out: string[] = []
  for (let i = 0; i < texts.length; i += DEEPL_MAX_BATCH) {
    const chunk = texts.slice(i, i + DEEPL_MAX_BATCH)
    try {
      const res = await fetch(`${WORKER_URL}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ingest-secret': secret },
        body: JSON.stringify({ texts: chunk, target_lang: 'ES', source_lang: 'EN' }),
      })
      if (!res.ok) {
        console.error('translateTexts worker error:', res.status, await res.text().catch(() => ''))
        return null
      }
      const data: any = await res.json()
      if (!Array.isArray(data.translations)) return null
      out.push(...data.translations)
    } catch (error) {
      console.error('translateTexts failed:', error)
      return null
    }
  }
  return out
}

// Collect every text leaf from a TipTap doc or flat block array, in order.
function collectTextLeaves(node: any, out: string[]): void {
  if (!node) return
  if (Array.isArray(node)) {
    node.forEach((n) => collectTextLeaves(n, out))
    return
  }
  if (node.type === 'text' && typeof node.text === 'string') {
    out.push(node.text)
    return
  }
  if (Array.isArray(node.content)) node.content.forEach((n: any) => collectTextLeaves(n, out))
}

// Rebuild the same content structure, swapping each text leaf for its translation.
function applyTextLeaves(node: any, translated: string[], idx: { i: number }): any {
  if (!node) return node
  if (Array.isArray(node)) return node.map((n) => applyTextLeaves(n, translated, idx))
  if (node.type === 'text' && typeof node.text === 'string') {
    return { ...node, text: translated[idx.i++] ?? node.text }
  }
  if (Array.isArray(node.content)) {
    return { ...node, content: node.content.map((n: any) => applyTextLeaves(n, translated, idx)) }
  }
  return node
}

export type SpanishFields = { title_es: string; excerpt_es: string; content_es: any }

// Produce Spanish title/excerpt/content for an article, preserving content
// structure. Returns null if translation is unavailable (caller keeps English).
export async function buildSpanishFields(article: {
  title?: string
  excerpt?: string
  content?: any
}): Promise<SpanishFields | null> {
  const leaves: string[] = []
  collectTextLeaves(article.content, leaves)

  const inputs = [article.title || '', article.excerpt || '', ...leaves]
  const translated = await translateTexts(inputs)
  if (!translated) return null

  const [title_es, excerpt_es, ...contentLeaves] = translated
  const content_es = applyTextLeaves(article.content, contentLeaves, { i: 0 })
  return {
    title_es: title_es || article.title || '',
    excerpt_es: excerpt_es || article.excerpt || '',
    content_es,
  }
}

// Best-effort: translate an article and persist the _es fields. Never throws —
// publishing must succeed even if translation is down.
export async function translateArticleToEs(
  docRef: DocumentReference,
  article: { title?: string; excerpt?: string; content?: any }
): Promise<void> {
  try {
    const es = await buildSpanishFields(article)
    if (!es) return
    await docRef.update({
      title_es: es.title_es,
      excerpt_es: es.excerpt_es,
      content_es: es.content_es,
      translated_at: FieldValue.serverTimestamp(),
    })
  } catch (error) {
    console.error('translateArticleToEs failed:', error)
  }
}
