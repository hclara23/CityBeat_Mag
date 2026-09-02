import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasSalesAccess } from '@citybeat/lib/roles'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { summarizeVariants, type OutreachRow, type Scoreboard } from '@/lib/ab-stats'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ms = (v: any): number | null => {
  if (!v) return null
  if (v?.toDate) return v.toDate().getTime()
  const t = Date.parse(String(v))
  return Number.isFinite(t) ? t : null
}

/** Hard backstop so a runaway collection can never bill an unbounded read. */
const MAX_ROWS = 50000
const CACHE_TTL_MS = 10 * 60 * 1000

// The scan is the same for every viewer and the numbers move on a cron cadence,
// so one in-process result is shared for ten minutes rather than re-reading the
// whole collection on every dashboard mount (the panel sits next to two other
// boards that each do their own full read).
let cache: { key: string; at: number; board: Scoreboard; scanned: number; truncated: boolean } | null = null

// First-touch A/B scoreboard. The drip has stamped `subject_variant` on every
// outreach doc for months while nothing ever read it — this is the read side.
//
// Read-only aggregate counts: no business names, no emails, no identifiers of
// any kind leave this route, which is why plain sales access is sufficient here.
// ?since=YYYY-MM-DD narrows the window — the mirror arms launched later than the
// subject arms, so the all-time view compares different periods and cohorts.
export async function GET(request: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  if (!hasSalesAccess(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const sinceParam = request.nextUrl.searchParams.get('since') || ''
    let sinceMs: number | undefined
    if (sinceParam) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(sinceParam)) {
        return NextResponse.json({ error: 'since must be YYYY-MM-DD' }, { status: 400 })
      }
      const parsed = Date.parse(`${sinceParam}T00:00:00Z`)
      if (!Number.isFinite(parsed)) {
        return NextResponse.json({ error: 'since is not a valid date' }, { status: 400 })
      }
      sinceMs = parsed
    }

    const key = sinceParam || 'all'
    if (cache && cache.key === key && Date.now() - cache.at < CACHE_TTL_MS) {
      return NextResponse.json({
        ...cache.board,
        scanned: cache.scanned,
        truncated: cache.truncated,
        since: sinceMs ? sinceParam : null,
        as_of: new Date(cache.at).toISOString(),
        cached: true,
      })
    }

    // Projected read: only the fields the scoreboard needs, never contact data.
    const snap = await adminDb
      .collection('sales_outreach')
      .select(
        'subject_variant',
        'variant_downgraded',
        'had_description_es',
        'had_contact_details',
        'status',
        'opens',
        'clicks',
        'step',
        'created_at',
        'converted_at'
      )
      .limit(MAX_ROWS)
      .get()

    const rows: OutreachRow[] = snap.docs.map((d) => {
      const x = d.data() as any
      return {
        subject_variant: x.subject_variant,
        variant_downgraded: x.variant_downgraded ?? null,
        had_description_es: x.had_description_es ?? null,
        had_contact_details: x.had_contact_details ?? null,
        status: x.status,
        opens: Number(x.opens) || 0,
        clicks: Number(x.clicks) || 0,
        step: Number(x.step) || 0,
        created_at_ms: ms(x.created_at),
        converted_at_ms: ms(x.converted_at),
      }
    })

    const board = summarizeVariants(rows, sinceMs ? { sinceMs } : {})
    const truncated = snap.size >= MAX_ROWS
    cache = { key, at: Date.now(), board, scanned: rows.length, truncated }

    return NextResponse.json({
      ...board,
      scanned: rows.length,
      truncated,
      since: sinceMs ? sinceParam : null,
      as_of: new Date().toISOString(),
      cached: false,
    })
  } catch (error) {
    // Firestore errors embed project ids, field paths and IAM principals — log
    // them, never return them.
    console.error('outreach-variants failed:', error)
    return NextResponse.json({ error: 'Could not load the scoreboard' }, { status: 500 })
  }
}
