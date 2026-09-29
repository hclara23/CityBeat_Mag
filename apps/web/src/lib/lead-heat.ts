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

export type Heat = 'hot' | 'warm' | 'cold'

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
  const { opens, clicks } = humanSignals(row)
  return clicks > 0 ? 'hot' : opens > 0 ? 'warm' : 'cold'
}
