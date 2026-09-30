// Lead temperature for sales outreach — telling a person from a mail scanner.
//
// Corporate mail security (Microsoft Defender, Mimecast, Proofpoint, Barracuda)
// fetches every link and image in a message seconds after delivery, with an
// ordinary desktop Chrome user agent; Apple Mail Privacy Protection preloads
// images on delivery too. Measured in September 2026 on 242 sales emails: 30 of
// 34 "clicks" and 61 of 81 "opens" landed within five minutes of sending, and
// the board was calling every one of those businesses HOT. Only 17 of 82
// "engaged" leads showed any sign of a person.
//
// There is no reliable header to tell them apart, but there is timing: a person
// rarely opens AND clicks within three minutes of an email arriving, while a
// scanner almost always does. So a hit inside that window after the most recent
// send is recorded as a scanner hit and does not count as engagement.
//
// The cost of the rule is a real person who clicks within three minutes being
// scored one notch colder. That is the right side to err on: the board drives
// who a rep calls and who gets offers, and a false HOT wastes both.

export const SCANNER_WINDOW_MS = 3 * 60_000

// Opens are the weakest signal there is: Apple Mail Privacy Protection and some
// corporate gateways fetch images when the message syncs to a device, which can
// be many minutes after delivery. An open only counts as WARM when the reader
// came back to it — the last open at least an hour after the send.
export const WARM_OPEN_AFTER_MS = 60 * 60_000

// VERIFIED: the recipient clicked through AND then interacted with the page (a
// tap, a key, a real scroll after dwelling) — see components/OutreachVerify.
// Scanners follow links; they do not use the page. This is the only tier that
// is proof rather than inference.
export type Heat = 'verified' | 'hot' | 'warm' | 'cold'

export function toMs(v: unknown): number | null {
  if (!v) return null
  if (typeof v === 'string') {
    const t = Date.parse(v)
    return Number.isFinite(t) ? t : null
  }
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const anyV = v as any
  if (typeof anyV.toDate === 'function') return anyV.toDate().getTime()
  if (typeof anyV._seconds === 'number') return anyV._seconds * 1000
  if (typeof anyV.seconds === 'number') return anyV.seconds * 1000
  return null
}

/** Is a hit at `atMs` most likely a scanner, given the last send? Unknown send
 *  time → cannot tell → counted as a person (the pre-existing behaviour). */
export function isScannerHit(lastSentAt: unknown, atMs: number = Date.now()): boolean {
  const sent = toMs(lastSentAt)
  if (sent === null) return false
  const delta = atMs - sent
  return delta >= 0 && delta < SCANNER_WINDOW_MS
}

export type OutreachSignals = {
  opens?: unknown
  clicks?: unknown
  last_sent_at?: unknown
  last_open_at?: unknown
  last_click_at?: unknown
  // Written by the tracking routes from 2026-09-30 on. Presence means opens/
  // clicks already exclude scanner hits.
  scanner_opens?: unknown
  scanner_clicks?: unknown
  // Set by /api/track/engaged when the person interacted with the landing page.
  verified_human_at?: unknown
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0)

/**
 * Person-attributable opens/clicks. Records written after the tracking fix
 * already exclude scanner hits. Older records only kept totals plus the LAST
 * timestamp, so they are judged by that: if the last click came inside the
 * scanner window, none of the clicks are trusted. That can undercount a person
 * who clicked once late and a scanner who clicked last — rare, and cold is the
 * safe direction.
 */
export function humanSignals(row: OutreachSignals): { opens: number; clicks: number } {
  const opens = num(row.opens)
  const clicks = num(row.clicks)
  const fixed = row.scanner_opens !== undefined || row.scanner_clicks !== undefined
  if (fixed) return { opens, clicks }
  const clickAt = toMs(row.last_click_at)
  const openAt = toMs(row.last_open_at)
  return {
    clicks: clicks > 0 && clickAt !== null && !isScannerHit(row.last_sent_at, clickAt) ? clicks : 0,
    opens: opens > 0 && openAt !== null && !isScannerHit(row.last_sent_at, openAt) ? opens : 0,
  }
}

export function leadHeat(row: OutreachSignals): Heat {
  if (toMs(row.verified_human_at) !== null) return 'verified'
  const { opens, clicks } = humanSignals(row)
  if (clicks > 0) return 'hot'
  const sent = toMs(row.last_sent_at)
  const openAt = toMs(row.last_open_at)
  if (opens > 0 && openAt !== null && (sent === null || openAt - sent >= WARM_OPEN_AFTER_MS)) return 'warm'
  return 'cold'
}

/** Rank for sorting and for picking the strongest of duplicate rows. */
export const HEAT_RANK: Record<Heat, number> = { verified: 3, hot: 2, warm: 1, cold: 0 }
