import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { fetchTicketmasterEvents } from '@/lib/events-scraper'
import { reportFailure } from '@/lib/alerts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

// Syncs real Ticketmaster events into Firestore `events`. Idempotent upserts
// keyed on the Ticketmaster event id — community submissions and paid featured
// events are NEVER touched (the old implementation cleared the whole collection
// each run, wiping them). Legacy mock docs (source 'sync') are purged.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    let purgedMock = 0
    let purgedPast = 0
    let upserted = 0

    // 1) Self-heal: remove legacy mock events (fake ticket URLs, picsum images).
    const legacy = await adminDb.collection('events').where('source', '==', 'sync').get()
    for (const doc of legacy.docs) {
      await doc.ref.delete()
      purgedMock++
    }

    // 2) Drop synced events whose date has passed (keeps the page fresh; admins
    //    manage community events' lifecycle themselves).
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    const stale = await adminDb.collection('events').where('source', '==', 'ticketmaster').get()
    for (const doc of stale.docs) {
      const d = (doc.data() as any).start_date
      if (typeof d === 'string' && d < yesterday) {
        await doc.ref.delete()
        purgedPast++
      }
    }

    // 3) Upsert fresh events. Without a TICKETMASTER_API_KEY this is a clean
    //    no-op (config state, not a failure — no alert spam).
    if (!process.env.TICKETMASTER_API_KEY) {
      return NextResponse.json({
        ok: true,
        skipped: 'no_ticketmaster_key',
        purged_mock: purgedMock,
        hint: 'Get a free key at developer.ticketmaster.com and set TICKETMASTER_API_KEY on the Cloud Run service.',
      })
    }

    const events = await fetchTicketmasterEvents()
    for (const event of events) {
      const { external_id, ...fields } = event
      // merge:true preserves admin-set fields (e.g. `featured` on a paid event).
      await adminDb.collection('events').doc(`tm-${external_id}`).set(
        {
          ...fields,
          external_id,
          status: 'approved',
          source: 'ticketmaster',
          updated_at: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      upserted++
    }

    return NextResponse.json({ ok: true, upserted, purged_mock: purgedMock, purged_past: purgedPast })
  } catch (error: any) {
    console.error('Cron sync-events error:', error)
    await reportFailure('cron:sync-events', error)
    return NextResponse.json({ error: 'Event sync failed' }, { status: 500 })
  }
}
