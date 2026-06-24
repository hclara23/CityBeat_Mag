import { Env } from '../index'

// Translate an array of strings via DeepL (the worker holds DEEPL_API_KEY).
// Returns translations in the same order as the input.
export async function translateTexts(
  texts: string[],
  env: Env,
  targetLang = 'ES',
  sourceLang = 'EN'
): Promise<string[]> {
  const nonEmpty = texts.map((t) => t ?? '')
  if (!nonEmpty.some((t) => t.trim())) return nonEmpty

  const key = (env.DEEPL_API_KEY || '').trim()
  if (!key) throw new Error('DEEPL_API_KEY is not set on the worker')
  // DeepL free keys end with ":fx" and use the api-free host; pro keys use api.
  const host = key.endsWith(':fx') ? 'api-free.deepl.com' : 'api.deepl.com'

  const res = await fetch(`https://${host}/v2/translate`, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${env.DEEPL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: nonEmpty, target_lang: targetLang, source_lang: sourceLang }),
  })

  if (!res.ok) {
    throw new Error(`DeepL error ${res.status}: ${await res.text()}`)
  }

  const data: any = await res.json()
  const translations: string[] = (data.translations || []).map((t: any) => t.text ?? '')
  // Defensive: keep array length aligned with the request.
  return texts.map((_, i) => translations[i] ?? '')
}

// POST /api/translate  { texts: string[], target_lang?, source_lang? }
// Authenticated with the shared x-ingest-secret header (same secret the web app
// already uses to talk to the worker). Returns { translations: string[] }.
export async function handleTranslate(request: Request, env: Env): Promise<Response> {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  if (request.headers.get('x-ingest-secret') !== env.INGEST_SECRET) {
    return json({ error: 'Unauthorized' }, 401)
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const texts: string[] = Array.isArray(body?.texts)
    ? body.texts.map((t: any) => String(t ?? ''))
    : typeof body?.text === 'string'
      ? [body.text]
      : []

  if (!texts.length) return json({ translations: [] })

  try {
    const translations = await translateTexts(texts, env, body?.target_lang || 'ES', body?.source_lang || 'EN')
    return json({ translations })
  } catch (error) {
    console.error('Translate failed:', error)
    return json({ error: String(error) }, 502)
  }
}
