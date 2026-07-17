// Turn a third-party source brief into an ORIGINAL CityBeat draft to avoid
// republishing copyrighted text wholesale. Produces a rewritten article (own
// wording, synthesized from the facts) plus a short summary. Uses Claude; if no
// ANTHROPIC_API_KEY is configured it returns null so callers fall back to a
// summary-and-link draft (low copyright risk) rather than copying source text.

import { traceClaude } from '@/lib/observability'

const MODEL = process.env.REWRITE_MODEL || 'claude-haiku-4-5-20251001'

export type RewrittenArticle = { title: string; summary: string; bodyText: string }

const SYSTEM = `You are a local news editor for CityBeat, a bilingual magazine covering El Paso, Texas and Ciudad Juárez, Mexico.

You are given a short brief from another news source. Write an ORIGINAL news article based ONLY on the facts in the brief — do NOT copy the source's sentences or phrasing, and do NOT invent facts, quotes, names, numbers, or details that are not present in the brief. Use a neutral, professional journalistic voice. If the brief is too thin to support a full article, write a brief factual summary instead.

Return ONLY valid JSON (no markdown, no code fences) with exactly these keys:
{"title": "an original headline", "summary": "1-2 sentence dek", "body": "the article body as plain text, paragraphs separated by a blank line"}`

export async function rewriteSourceArticle(input: {
  title: string
  sourceText: string
  sourceName?: string
  category?: string
}): Promise<RewrittenArticle | null> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return null
  if (!input.sourceText?.trim() && !input.title?.trim()) return null

  const userPrompt = `SOURCE NAME: ${input.sourceName || 'unknown'}
CATEGORY: ${input.category || 'news'}
SOURCE HEADLINE: ${input.title || ''}
SOURCE BRIEF:
${input.sourceText || ''}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system: SYSTEM,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })
    if (!res.ok) {
      console.error('rewriteSourceArticle anthropic error:', res.status, await res.text().catch(() => ''))
      return null
    }
    const data: any = await res.json()
    await traceClaude('rewrite', userPrompt, data, { source: input.sourceName })
    const raw: string = data?.content?.[0]?.text || ''
    // The model is asked for bare JSON, but strip stray code fences defensively.
    const jsonText = raw.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
    const parsed = JSON.parse(jsonText)
    const title = String(parsed.title || '').trim()
    const summary = String(parsed.summary || '').trim()
    const bodyText = String(parsed.body || '').trim()
    if (!title || !bodyText) return null
    return { title, summary, bodyText }
  } catch (error) {
    console.error('rewriteSourceArticle failed:', error)
    return null
  }
}
