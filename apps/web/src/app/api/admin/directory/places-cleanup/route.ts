import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { hasDeveloperAccess } from '@citybeat/lib/roles'
import { privilegedDenial } from '@/lib/privileged-access'
import { scanCollection } from '@/lib/firestore-scan'
import { classifyListing, summarize, type CleanupVerdict } from '@/lib/places-cleanup'
import { reportFailure } from '@/lib/alerts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

// Removes directory rows that were built from Google Maps Platform Content.
//
// The sink now refuses new ones (lib/scrapeflow/google-content.ts), but rows
// written before that guard are still published at /directory — which is both the
// No-Caching and the No-Re-Creating-Google-Features problem, and the remedy Google
// applies is killing the API key that also feeds enrichment and the sales pipeline.
//
// It is also, plainly, deleting live business records from a directory a sales
// pipeline runs on. So:
//   - GET is a read-only report. It is the default and it changes nothing.
//   - DELETE requires ?confirm=DELETE_PLACES_ROWS explicitly. There is no flag
//     that means "probably".
//   - Nothing protected is ever touched: any claim at any stage, any owner, any
//     subscription or paid tier, any rep-sold row, and a named allowlist. Those
//     rules are pure and tested in places-cleanup.test.ts, not improvised here.
//   - Every deletion is recorded in `deleted_listings` first, so this is
//     reversible. A licence remedy is not a reason to make data unrecoverable.

const SCAN_CAP = 20_000
const CONFIRM = 'DELETE_PLACES_ROWS'

async function authorize() {
  const user = await getServerUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const profile = await getServerUserProfile(user.id)
  const denial = privilegedDenial(profile, hasDeveloperAccess(profile))
  if (denial) return { error: denial.error, status: denial.status }
  return { user }
}

async function classifyAll(): Promise<{ verdicts: CleanupVerdict[]; truncated: boolean }> {
  const verdicts: CleanupVerdict[] = []
  const scan = await scanCollection(
    adminDb.collection('directory_listings'),
    (doc) => {
      verdicts.push(classifyListing({ id: doc.id, ...(doc.data() as any) }))
    },
    { cap: SCAN_CAP }
  )
  return { verdicts, truncated: scan.truncated }
}

export async function GET() {
  const auth = await authorize()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { verdicts, truncated } = await classifyAll()
  const summary = summarize(verdicts)
  const removable = verdicts.filter((v) => v.removable)

  return NextResponse.json({
    mode: 'report',
    ...summary,
    truncated,
    // A sample, so a human can eyeball what this would actually remove before
    // authorising it — a bare count is not something anyone can sanity-check.
    sample_removable: removable.slice(0, 40).map((v) => ({ id: v.id, name: v.name })),
    protected_google_derived_sample: verdicts
      .filter((v) => v.googleDerived && v.protection)
      .slice(0, 40)
      .map((v) => ({ id: v.id, name: v.name, why: v.protection })),
    to_delete: `DELETE this endpoint with ?confirm=${CONFIRM}`,
  })
}

export async function DELETE(request: NextRequest) {
  const auth = await authorize()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  if (searchParams.get('confirm') !== CONFIRM) {
    return NextResponse.json(
      { error: `Refusing to delete without ?confirm=${CONFIRM}. Run GET first and read the report.` },
      { status: 400 }
    )
  }
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '', 10) || 5000, 1), SCAN_CAP)

  const { verdicts, truncated } = await classifyAll()
  const removable = verdicts.filter((v) => v.removable).slice(0, limit)

  let archived = 0
  let deleted = 0
  const failures: string[] = []

  for (const v of removable) {
    const ref = adminDb.collection('directory_listings').doc(v.id)
    try {
      const snap = await ref.get()
      if (!snap.exists) continue

      // Re-check against the CURRENT document, not the snapshot the scan saw. A
      // claim could have landed while this was running, and the whole point is
      // that a claimed listing is never removed.
      const fresh = classifyListing({ id: snap.id, ...(snap.data() as any) })
      if (!fresh.removable) continue

      // Archive BEFORE deleting. A licence remedy is not a reason to make the
      // data unrecoverable, and an operator who deletes 4,000 rows deserves a way
      // back if the provenance test turns out to have been wrong about any of them.
      await adminDb
        .collection('deleted_listings')
        .doc(v.id)
        .set(
          {
            ...(snap.data() as any),
            deleted_at: new Date().toISOString(),
            deleted_by: (auth as any).user?.id || null,
            deleted_reason: 'google_places_content_licence',
          },
          { merge: true }
        )
      archived++
      await ref.delete()
      deleted++
    } catch (error: any) {
      failures.push(`${v.id}: ${String(error?.message || error).slice(0, 120)}`)
    }
  }

  if (failures.length) {
    await reportFailure(
      'places-cleanup',
      new Error(`${failures.length} listing(s) could not be removed during the Places cleanup`),
      { sample: failures.slice(0, 10) }
    ).catch(() => {})
  }

  return NextResponse.json({
    mode: 'delete',
    ...summarize(verdicts),
    truncated,
    archived,
    deleted,
    failed: failures.length,
    remaining_removable: Math.max(0, verdicts.filter((v) => v.removable).length - deleted),
    restore_hint: 'Originals are in the `deleted_listings` collection, keyed by the same id.',
  })
}
