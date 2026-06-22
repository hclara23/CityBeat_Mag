import { NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { fetchMockEvents } from '@/lib/events-scraper'

export const dynamic = 'force-dynamic'

// Syncs events into the Firestore `events` collection (read by the homepage).
export async function GET() {
  try {
    const events = await fetchMockEvents()

    // Clear existing events, then insert the fresh batch.
    const existing = await adminDb.collection('events').get()
    let batch = adminDb.batch()
    let ops = 0
    const commitIfNeeded = async () => {
      if (ops >= 450) {
        await batch.commit()
        batch = adminDb.batch()
        ops = 0
      }
    }

    for (const doc of existing.docs) {
      batch.delete(doc.ref)
      ops++
      await commitIfNeeded()
    }
    for (const event of events as any[]) {
      const ref = adminDb.collection('events').doc()
      batch.set(ref, { ...event, created_at: FieldValue.serverTimestamp() })
      ops++
      await commitIfNeeded()
    }
    if (ops > 0) await batch.commit()

    return NextResponse.json({ success: true, message: `Synced ${events.length} events.` })
  } catch (error: any) {
    console.error('Cron sync-events error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
