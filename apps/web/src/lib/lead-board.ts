// What the Warm-leads board shows, and what it leaves off (pure, unit-tested).
//
// The board exists to tell a rep who to call. Every row on it should be a PERSON
// at the right business. Rows are left off — and counted by reason, so the board
// can say why the list is short — when:
//   - scanner      only a mail scanner touched the email (lib/lead-heat.ts)
//   - unconfirmed  opened, but only in the first hour, which Apple Mail /
//                  gateway image preloading also produces
//   - bad_contact  the address was found to belong to someone else
//                  (lib/enrich-contacts.ts isOwnInbox)
//   - unsubscribed the recipient asked us to stop
//   - dismissed    a rep marked it "Not real"
//   - duplicate    the same inbox + business already has a stronger row (a
//                  merged listing, or a second outreach sequence)

import { HEAT_RANK, humanSignals, leadHeat, toMs, type Heat } from './lead-heat'

export type BoardRow = {
  id: string
  collection: string
  listing_id: string | null
  business: string
  email: string | null
  opens: number
  clicks: number
  status: string
  heat: Exclude<Heat, 'cold'>
  verified: boolean
  last_activity: string | null
}

export type HiddenCounts = {
  scanner: number
  unconfirmed: number
  bad_contact: number
  unsubscribed: number
  dismissed: number
  duplicate: number
}

const iso = (v: unknown): string | null => {
  const t = toMs(v)
  return t === null ? null : new Date(t).toISOString()
}

export function boardLeads(
  docs: Array<Record<string, any>>,
  // Normalised addresses on the global suppression list. An unsubscribe from ANY
  // stream is recorded there, not always on this outreach row's own status.
  suppressed: ReadonlySet<string> = new Set()
): {
  rows: BoardRow[]
  summary: { engaged: number; verified: number; hot: number; warm: number; hidden: HiddenCounts }
} {
  const hidden: HiddenCounts = { scanner: 0, unconfirmed: 0, bad_contact: 0, unsubscribed: 0, dismissed: 0, duplicate: 0 }
  const candidates: Array<BoardRow & { _sort: number }> = []

  for (const x of docs) {
    const rawHits =
      (Number(x.opens) || 0) + (Number(x.clicks) || 0) + (Number(x.scanner_opens) || 0) + (Number(x.scanner_clicks) || 0)
    const heat = leadHeat(x)
    // Only rows with ANY activity are the board's business; a never-opened send
    // is not "hidden", it simply is not a lead yet.
    if (!rawHits && heat !== 'verified') continue

    if (x.status === 'unsubscribed' || suppressed.has(String(x.email || '').trim().toLowerCase())) {
      hidden.unsubscribed++
      continue
    }
    if (x.status === 'bad_contact') { hidden.bad_contact++; continue }
    if (x.lead_dismissed_at) { hidden.dismissed++; continue }
    if (heat === 'cold') {
      const h = humanSignals(x)
      if (h.opens > 0 || h.clicks > 0) hidden.unconfirmed++
      else hidden.scanner++
      continue
    }

    const { opens, clicks } = humanSignals(x)
    const last = Math.max(toMs(x.verified_human_at) ?? 0, toMs(x.last_click_at) ?? 0, toMs(x.last_open_at) ?? 0)
    candidates.push({
      id: String(x.id),
      collection: String(x.collection || 'sales_outreach'),
      listing_id: x.listing_id || null,
      business: x.business_name || x.email || 'Business',
      email: x.email || null,
      opens,
      clicks,
      status: x.status || 'sent',
      heat,
      verified: heat === 'verified',
      last_activity: iso(x.verified_human_at) || iso(x.last_click_at) || iso(x.last_open_at) || iso(x.last_sent_at),
      _sort: HEAT_RANK[heat] * 1e14 + last,
    })
  }

  // Strongest evidence first, then most recent — so the FIRST row seen for a
  // given inbox + business is the one kept.
  candidates.sort((a, b) => b._sort - a._sort)
  const seen = new Set<string>()
  const rows: BoardRow[] = []
  for (const { _sort, ...row } of candidates) {
    const key = `${String(row.email || '').toLowerCase()}|${String(row.business).toLowerCase().trim()}`
    if (seen.has(key)) { hidden.duplicate++; continue }
    seen.add(key)
    rows.push(row)
  }

  return {
    rows,
    summary: {
      engaged: rows.length,
      verified: rows.filter((r) => r.heat === 'verified').length,
      hot: rows.filter((r) => r.heat === 'hot').length,
      warm: rows.filter((r) => r.heat === 'warm').length,
      hidden,
    },
  }
}
