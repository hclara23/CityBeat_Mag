// Claude-powered extraction nodes. ScrapeFlow's "Extract data with AI" node
// used OpenAI with user-supplied credentials; here we use the platform
// ANTHROPIC_API_KEY (same raw-fetch pattern as lib/newsroom.ts) so no per-user
// credential store is needed.

import { traceClaude, traceClaudeFailure } from '@/lib/observability'
import { parseJsonLoose } from './definition'
import type { ExtractedListing } from './types'

const MODEL = process.env.SCRAPEFLOW_MODEL || process.env.CHAT_MODEL || 'claude-haiku-4-5-20251001'
const MAX_CHUNK_CHARS = 45_000

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

export { parseJsonLoose }

async function callClaude(prompt: string, maxTokens: number, traceName: string, meta?: Record<string, unknown>) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set — AI extraction nodes are unavailable')
  const started = new Date()
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) {
    await traceClaudeFailure(traceName, prompt.slice(0, 4000), `anthropic_http_${res.status}`, meta, started).catch(() => {})
    throw new Error(`Anthropic HTTP ${res.status}`)
  }
  const data: any = await res.json()
  await traceClaude(traceName, prompt.slice(0, 4000), data, meta, started).catch(() => {})
  return String(data?.content?.[0]?.text || '')
}

function chunkText(text: string, size = MAX_CHUNK_CHARS): string[] {
  if (text.length <= size) return [text]
  const chunks: string[] = []
  let rest = text
  while (rest.length > size) {
    // Prefer to split on a blank line so listings aren't cut in half.
    let cut = rest.lastIndexOf('\n\n', size)
    if (cut < size * 0.5) cut = size
    chunks.push(rest.slice(0, cut))
    rest = rest.slice(cut)
  }
  if (rest.trim()) chunks.push(rest)
  return chunks
}

export async function extractDataWithAI(text: string, instructions: string): Promise<unknown> {
  const chunks = chunkText(text)
  const results: unknown[] = []
  for (const [i, chunk] of chunks.entries()) {
    const prompt = `You are a precise web-data extraction engine. Read the page text and return ONLY valid JSON (no markdown fences, no commentary) that satisfies these instructions:

${instructions}

PAGE TEXT (part ${i + 1} of ${chunks.length}):
"""
${chunk}
"""`
    const reply = await callClaude(prompt, 4000, 'scrapeflow.extract_data', { part: i + 1, parts: chunks.length })
    results.push(parseJsonLoose(reply))
  }
  if (results.length === 1) return results[0]
  // Merge arrays across chunks; otherwise return the list of per-chunk objects.
  if (results.every((r) => Array.isArray(r))) return (results as unknown[][]).flat()
  return results
}

const LISTING_PROMPT = (categoryHint: string | null, categories: readonly string[]) => `Extract EVERY distinct business / organization listed in the page text below as a JSON array. This is for a local business directory covering El Paso County, TX and Doña Ana County, NM (Las Cruces).

Rules:
- One object per business. Do NOT invent data; use null when a field is not present in the text.
- "name": the business name exactly as written (trim promo text).
- "address": street address only (no city/state/zip); "city", "state" (2-letter), "zip" separately when present.
- "phone": digits formatted like (915) 555-1234; prefer [tel:...] markers if present.
- "website": full URL if present (prefer [http...] markers); null otherwise. Never return the directory site itself.
- "email": only if literally present ([mailto:...] or visible).
- "category": best match from this list: ${categories.join(', ')}. ${categoryHint ? `When unclear, use "${categoryHint}".` : 'When unclear, use "Professional Services".'}
- "description": one factual sentence from the text (or null). No marketing fluff.
- Skip navigation, category headers, the directory owner itself, and entries with no name.

Return ONLY the JSON array, e.g.
[{"name":"...","address":"...","city":"...","state":"TX","zip":"79901","phone":"...","website":null,"email":null,"category":"Attorneys","description":null}]`

export async function extractListingsWithAI(
  text: string,
  opts: { categoryHint?: string | null; categories: readonly string[]; sourceUrl?: string | null }
): Promise<ExtractedListing[]> {
  const chunks = chunkText(text)
  const listings: ExtractedListing[] = []
  for (const [i, chunk] of chunks.entries()) {
    const prompt = `${LISTING_PROMPT(opts.categoryHint || null, opts.categories)}

PAGE TEXT (part ${i + 1} of ${chunks.length})${opts.sourceUrl ? ` from ${opts.sourceUrl}` : ''}:
"""
${chunk}
"""`
    const reply = await callClaude(prompt, 8000, 'scrapeflow.extract_listings', {
      part: i + 1,
      parts: chunks.length,
      source: opts.sourceUrl || null,
    })
    const parsed = parseJsonLoose(reply)
    const arr: any[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.listings) ? parsed.listings : []
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue
      const name = String(item.name || '').trim()
      if (!name) continue
      listings.push({
        name,
        category: item.category ? String(item.category) : null,
        address: item.address ? String(item.address) : null,
        city: item.city ? String(item.city) : null,
        state: item.state ? String(item.state) : null,
        zip: item.zip ? String(item.zip) : null,
        phone: item.phone ? String(item.phone) : null,
        website: item.website ? String(item.website) : null,
        email: item.email ? String(item.email) : null,
        description: item.description ? String(item.description) : null,
        source_url: opts.sourceUrl || null,
      })
    }
  }
  return listings
}
