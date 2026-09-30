// Jev (TypeSafe AI) — a fast typed classifier. It returns probabilities, never
// prose, which makes it cheap (input tokens only) and quick enough to sit in a
// form submission. Docs: https://docs.typesafe.ai/api.md
//
// CityBeat uses it ONLY as a hint on top of rules that already work on their
// own. Every caller must behave exactly as before when this returns null —
// which it does when the key is unset, the monthly cap is reached, the call is
// slow, or anything at all goes wrong. Nothing here throws.
//
// Configuration (Cloud Run env):
//   JEV_API_KEY          the key (trimmed — a stray leading space was pasted once)
//   JEV_MONTHLY_CAP_USD  hard monthly ceiling. No cap set = no calls, the same
//                        rule KitProof uses: an uncapped paid API is a surprise bill.
//
// Spend is tracked across every Cloud Run instance in one Firestore doc
// (system_health/_jev_spend — the leading underscore keeps the heartbeat from
// reading it as a cron source).

import { fetchWithTimeout } from './http'

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone'
const MODEL = 'jev-latest'
// Input tokens only; output is free (TypeSafe pricing, as used by KitProof).
export const JEV_INPUT_USD_PER_MILLION = 0.042
// A form must never wait on this. Past the deadline we simply proceed without it.
const TIMEOUT_MS = 4_000
const SPEND_DOC = '_jev_spend'

export type JevNoul = { type: 'noul'; instructions: unknown; criteria?: { true?: unknown; false?: unknown } }
export type JevChoice = { type: 'choice'; instructions: unknown; criteria: Record<string, unknown> }
export type JevQuestion = JevNoul | JevChoice

// ---- pure helpers (unit-tested) -------------------------------------------

export function jevKey(env: Record<string, string | undefined> = process.env): string | null {
  const key = (env.JEV_API_KEY || '').trim()
  return key ? key : null
}

/** The monthly cap in USD, or null when unset/invalid (null means: do not call). */
export function jevCapUsd(env: Record<string, string | undefined> = process.env): number | null {
  const n = Number((env.JEV_MONTHLY_CAP_USD || '').trim())
  return Number.isFinite(n) && n > 0 ? n : null
}

export function monthKey(now: Date = new Date()): string {
  return `usd_${now.toISOString().slice(0, 7).replace('-', '_')}`
}

export function costUsd(inputTokens: unknown): number {
  const t = Number(inputTokens)
  return Number.isFinite(t) && t > 0 ? (t / 1_000_000) * JEV_INPUT_USD_PER_MILLION : 0
}

export function underCap(spentUsd: number, capUsd: number | null): boolean {
  return capUsd !== null && Number.isFinite(spentUsd) && spentUsd < capUsd
}

// ---- the call ---------------------------------------------------------------

/**
 * Ask Jev typed questions about `state`. Returns the raw answers map, or null
 * whenever the answer should be treated as "no opinion".
 */
export async function askJev(
  state: unknown,
  questions: Record<string, JevQuestion>
): Promise<Record<string, any> | null> {
  const key = jevKey()
  const cap = jevCapUsd()
  if (!key || cap === null) return null
  try {
    // Lazy import keeps firebase-admin out of anything that only needs the
    // pure helpers above (and out of the unit tests).
    const { adminDb } = await import('@citybeat/lib/firebase/admin')
    const { FieldValue } = await import('firebase-admin/firestore')
    const ref = adminDb.collection('system_health').doc(SPEND_DOC)
    const month = monthKey()
    const spent = Number(((await ref.get()).data() as any)?.[month]) || 0
    if (!underCap(spent, cap)) return null

    const res = await fetchWithTimeout(
      ENDPOINT,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, state, questions }),
      },
      TIMEOUT_MS
    )
    if (!res.ok) return null
    const json: any = await res.json().catch(() => null)
    const usd = costUsd(json?.usage?.input_tokens)
    if (usd > 0) {
      await ref.set({ [month]: FieldValue.increment(usd), updated_at: new Date().toISOString() }, { merge: true }).catch(() => {})
    }
    return json?.answers && typeof json.answers === 'object' ? json.answers : null
  } catch {
    return null
  }
}

/** Probability (0–1) that a public form submission was written by a real
 *  person with a real purpose, or null when Jev has no opinion. */
export async function genuineProbability(form: string, fields: Record<string, string>): Promise<number | null> {
  const answers = await askJev(
    { form, ...fields },
    {
      is_genuine: {
        type: 'noul',
        instructions: `Was this ${form} written by a real person with a genuine purpose?`,
        criteria: {
          true: 'A real person wrote meaningful text (any language, including Spanish; short or informal is fine)',
          false: 'Random characters, gibberish, bot-generated, SEO/link spam, or a sales pitch unrelated to the form',
        },
      },
    }
  )
  const p = Number(answers?.is_genuine?.noul)
  return Number.isFinite(p) && p >= 0 && p <= 1 ? p : null
}

/**
 * Below this, a submission is treated as spam. Deliberately LOW: a real
 * customer marked spam is far costlier than a spam row that gets through, and
 * every caller stores the row anyway (status 'spam', reversible) rather than
 * discarding it.
 */
export const JEV_SPAM_BELOW = 0.1

export function isJevSpam(p: number | null): boolean {
  return p !== null && p < JEV_SPAM_BELOW
}
