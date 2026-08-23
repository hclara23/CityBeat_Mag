// Multi-location consolidation — in-app port of scripts/consolidate-listings.js
// so ScrapeFlow runs and the admin can merge same-brand listings without a
// laptop. For each group of same-brand listings: pick a canonical (claimed doc
// always wins, then most complete), copy every member address into
// canonical.locations[], set location_count/is_multi_location, and UNPUBLISH
// siblings (is_published=false, merged_into=<canonicalId>) — reversible, never
// deletes. A group is skipped if more than one member is claimed.

import { adminDb } from '@citybeat/lib/firebase/admin'

export function normBrandName(n: string | null | undefined): string {
  let s = String(n || '').toLowerCase()
  // Strip a trailing "#1234" or bare store-number suffix (e.g. "Whataburger
  // #1234", "Store Name 1234") — but never a digit that starts the name
  // itself. Trade businesses very commonly lead with a number ("1 A Electric",
  // "828 Electric LLC", "50 Plus Electric", "24 Hour Plumbing"); the original
  // `/[#\d].*$/` matched the FIRST digit anywhere and deleted everything from
  // there on, so any digit-leading name collapsed to an empty string and was
  // silently excluded from consolidation entirely.
  s = s.replace(/\s*#\d+\s*$/, '').replace(/(?<=[a-z])\s+\d{2,6}\s*$/, '')
  return s
    .replace(/\b(el paso|juarez|ciudad juarez|las cruces|tx|nm|inc|llc|co|corp|ltd)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

function score(d: any): number {
  let s = 0
  if (d.owner_id) s += 100
  if (d.claim_status && d.claim_status !== 'unclaimed') s += 50
  if (d.description) s += 3
  if (d.website) s += 2
  if (d.phone) s += 1
  if (d.image_url) s += 1
  if (d.hours && Object.keys(d.hours).length) s += 1
  if (d.latitude != null) s += 1
  s += Number(d.user_ratings_total || 0) / 1000
  return s
}

function locationOf(d: any) {
  return {
    address: d.address || null,
    phone: d.phone || null,
    latitude: d.latitude ?? null,
    longitude: d.longitude ?? null,
    google_place_id: d.google_place_id || null,
  }
}

export interface ConsolidateOptions {
  apply: boolean
  /** Restrict to groups whose normalized brand key matches one of these names (fast path after an ingest). */
  names?: string[]
  log?: (message: string) => void
}

export interface ConsolidateResult {
  groups_merged: number
  siblings_unpublished: number
  skipped: number
  plan: Array<{ brand: string; canonical_id: string; locations: number; unpublish: number }>
}

export async function consolidateListings(opts: ConsolidateOptions): Promise<ConsolidateResult> {
  const log = opts.log || (() => {})
  const wanted = opts.names ? new Set(opts.names.map(normBrandName).filter(Boolean)) : null
  if (wanted && wanted.size === 0) return { groups_merged: 0, siblings_unpublished: 0, skipped: 0, plan: [] }

  const snap = await adminDb.collection('directory_listings').get()
  const groups = new Map<string, any[]>()
  for (const doc of snap.docs) {
    const data = { id: doc.id, ...(doc.data() as any) }
    if (data.merged_into) continue
    const key = normBrandName(data.name)
    if (!key || key.length < 3) continue
    if (wanted && !wanted.has(key)) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(data)
  }

  const result: ConsolidateResult = { groups_merged: 0, siblings_unpublished: 0, skipped: 0, plan: [] }
  for (const members of groups.values()) {
    if (members.length < 2) continue
    const claimed = members.filter((m) => m.owner_id)
    if (claimed.length > 1) {
      result.skipped++
      log(`SKIP ${members[0].name} (${members.length}) — multiple claimed owners`)
      continue
    }
    const canonical = [...members].sort((a, b) => score(b) - score(a))[0]
    const siblings = members.filter((m) => m.id !== canonical.id)
    const seen = new Set<string>()
    const locations: ReturnType<typeof locationOf>[] = []
    for (const m of members) {
      const addr = String(m.address || '').trim().toLowerCase()
      if (!addr || seen.has(addr)) continue
      seen.add(addr)
      locations.push(locationOf(m))
    }
    result.plan.push({ brand: canonical.name, canonical_id: canonical.id, locations: locations.length, unpublish: siblings.length })
    log(`MERGE ${canonical.name} → ${canonical.id} | ${locations.length} locations | unpublish ${siblings.length}`)
    if (opts.apply) {
      const now = new Date().toISOString()
      await adminDb.collection('directory_listings').doc(canonical.id).set(
        { locations, location_count: locations.length, is_multi_location: locations.length > 1, is_published: true, updated_at: now },
        { merge: true }
      )
      for (const s of siblings) {
        await adminDb.collection('directory_listings').doc(s.id).set({ is_published: false, merged_into: canonical.id, updated_at: now }, { merge: true })
      }
    }
    result.groups_merged++
    result.siblings_unpublished += siblings.length
  }
  return result
}
