import { adminDb } from '@citybeat/lib/firebase/admin'

export type PublicEvent = {
  id: string
  title_en: string
  title_es: string
  meta_en?: string
  meta_es?: string
  venue?: string | null
  start_date: string
  ticket_url?: string | null
  image_url?: string | null
  featured?: boolean
}

// Visible to the public = approved, or legacy events with no status set.
// Pending (community-submitted, awaiting review) and rejected are hidden.
function isVisible(e: any): boolean {
  return e.status !== 'pending' && e.status !== 'rejected'
}

export async function getUpcomingEvents(limit = 60): Promise<PublicEvent[]> {
  try {
    const snap = await adminDb.collection('events').orderBy('start_date', 'asc').get()
    const cutoff = Date.now() - 12 * 60 * 60 * 1000 // keep events up to 12h past start
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter(isVisible)
      .filter((e) => {
        const t = Date.parse(e.start_date)
        return Number.isNaN(t) || t >= cutoff
      })
      // Featured (paid) events first, then by start date (already asc from query).
      .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)))
      .slice(0, limit)
  } catch {
    return []
  }
}

export async function getEventById(id: string): Promise<PublicEvent | null> {
  try {
    const doc = await adminDb.collection('events').doc(id).get()
    if (!doc.exists) return null
    const e = { id: doc.id, ...(doc.data() as any) }
    return isVisible(e) ? (e as PublicEvent) : null
  } catch {
    return null
  }
}
