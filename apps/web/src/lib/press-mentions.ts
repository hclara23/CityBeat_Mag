import { adminDb } from '@citybeat/lib/firebase/admin'
import { sendUnclaimedRelay } from './unclaimed-relay'

// Press Clip Pin: when a CityBeat story names a local business that exists in the
// directory, pin the mention to the listing ("As seen in CityBeat") and — if the
// listing is unclaimed — relay the good news through the unclaimed pipe ("CityBeat
// mentioned you in today's news; claim free and we'll pin your press coverage").
// The one claim play only a real newsroom can run.
//
// Called from BOTH publish points: the auto-articles cron (when a brief publishes
// immediately) and the admin publish transition (pending briefs + every other
// article source). Only PUBLISHED stories are pinned — the story URL must work.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

export const MAX_MENTIONS_PER_ARTICLE = 3
export const MAX_PINS_PER_LISTING = 10

/** Flatten any of the repo's article content shapes (plain string, block array,
 *  TipTap doc) to searchable text. Defensive: unknown shapes yield ''. */
export function articleContentToText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map(articleContentToText).join('\n')
  if (content && typeof content === 'object') {
    const node = content as any
    if (typeof node.text === 'string') return node.text
    if (Array.isArray(node.content)) return node.content.map(articleContentToText).join('\n')
  }
  return ''
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Region/place phrases that appear in nearly every story — a listing "named"
// one of these (scraper noise) would match everything and hog the mention slots.
const GEO_STOPLIST = new Set([
  'el paso',
  'el paso tx',
  'el paso texas',
  'ciudad juarez',
  'ciudad juárez',
  'juarez',
  'juárez',
  'las cruces',
  'new mexico',
  'texas',
  'sun city',
  'el chuco',
  'fort bliss',
  'dona ana',
  'doña ana',
  'united states',
])

/**
 * Whether a business name is distinctive enough to phrase-match in prose without
 * drowning in false positives: at least two words, or a single word of 8+ chars,
 * and never a bare region/place phrase. Pure + exported for tests.
 */
export function nameIsMatchable(name: string): boolean {
  const n = name.trim()
  if (n.length < 5) return false
  if (GEO_STOPLIST.has(n.toLowerCase())) return false
  const words = n.split(/\s+/).filter(Boolean)
  return words.length >= 2 || n.length >= 8
}

/** Case-insensitive whole-phrase test. Pure + exported for tests. */
export function textMentionsName(text: string, name: string): boolean {
  if (!nameIsMatchable(name)) return false
  try {
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(name.trim())}($|[^\\p{L}\\p{N}])`, 'iu')
    return re.test(text)
  } catch {
    return false
  }
}

export interface PressPinResult {
  scanned: number
  matched: string[]
  relayed: number
}

/**
 * Scan a just-published story for directory-business mentions; pin matches to
 * their listings and relay to unclaimed ones. Best-effort, never throws — a
 * failure here must never break publishing.
 */
export async function matchAndPinPressMentions(input: {
  articleId: string
  slug: string
  title: string
  content: unknown
}): Promise<PressPinResult> {
  const out: PressPinResult = { scanned: 0, matched: [], relayed: 0 }
  try {
    const text = `${input.title}\n${articleContentToText(input.content)}`.slice(0, 30000)
    if (text.trim().length < 40) return out

    // Names only — .select keeps the scan cheap even at directory scale. NOTE:
    // this is a PROJECTION; sendUnclaimedRelay re-reads the listing fresh for
    // eligibility + the send cap, so an omitted field here can never widen them.
    const snap = await adminDb
      .collection('directory_listings')
      .where('is_published', '==', true)
      .select('name', 'claim_status', 'email', 'contact_email', 'merged_into', 'phone', 'sold_by_rep', 'source', 'sales_order_id', 'relay_sent_at')
      .limit(5000)
      .get()
    out.scanned = snap.size

    const matches: Array<{ id: string; data: any }> = []
    for (const doc of snap.docs) {
      const data = doc.data() as any
      if (data.merged_into) continue
      const name = String(data.name || '')
      if (textMentionsName(text, name)) {
        matches.push({ id: doc.id, data })
        if (matches.length >= MAX_MENTIONS_PER_ARTICLE) break
      }
    }

    const articleUrl = `${APP_URL}/en/stories/${input.slug}`
    const pin = {
      article_id: input.articleId,
      slug: input.slug,
      title: String(input.title).slice(0, 200),
      at: new Date().toISOString(),
    }

    for (const m of matches) {
      out.matched.push(m.id)
      // Read-modify-write keeps the pin list deduped + bounded (no arrayUnion
      // object-identity surprises).
      try {
        const ref = adminDb.collection('directory_listings').doc(m.id)
        const fresh = await ref.get()
        const existing: any[] = Array.isArray((fresh.data() as any)?.mentioned_in) ? (fresh.data() as any).mentioned_in : []
        if (!existing.some((e) => e?.article_id === input.articleId)) {
          const next = [pin, ...existing].slice(0, MAX_PINS_PER_LISTING)
          await ref.set({ mentioned_in: next }, { merge: true })
        }
      } catch {
        /* pin is best-effort */
      }

      // The claim hook (relay handles eligibility, dedupe, caps, suppression).
      const r = await sendUnclaimedRelay({
        listingId: m.id,
        listing: m.data,
        eventId: `${input.articleId}:${m.id}`,
        detail: { type: 'press_mention', articleTitle: input.title, articleUrl },
      })
      if (r.sent) out.relayed++
    }
  } catch {
    /* never break publishing */
  }
  return out
}
