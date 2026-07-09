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

// The upcoming Fri–Sun window. Mon–Thu → the coming weekend; Fri/Sat/Sun →
// from now through this Sunday night. Used by the /this-weekend traffic page.
export function thisWeekendWindow(now = new Date()): { start: number; end: number; label: string } {
  const d = new Date(now)
  const dow = d.getDay() // 0 Sun .. 6 Sat
  // Days until Friday (5). If already Fri/Sat/Sun, the weekend has started.
  const daysToFri = (5 - dow + 7) % 7
  const friday = new Date(d)
  friday.setHours(0, 0, 0, 0)
  if (dow === 0) {
    // Sunday: weekend is Fri(-2)..today
    friday.setDate(d.getDate() - 2)
  } else if (dow === 6) {
    friday.setDate(d.getDate() - 1)
  } else if (dow >= 1 && dow <= 4) {
    friday.setDate(d.getDate() + daysToFri)
  }
  const sundayEnd = new Date(friday)
  sundayEnd.setDate(friday.getDate() + 2)
  sundayEnd.setHours(23, 59, 59, 999)
  const start = Math.max(now.getTime(), friday.getTime())
  const fmt = (dt: Date) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return { start, end: sundayEnd.getTime(), label: `${fmt(friday)}–${fmt(sundayEnd)}` }
}

export async function getThisWeekendEvents(): Promise<{ events: PublicEvent[]; label: string }> {
  const { start, end, label } = thisWeekendWindow()
  try {
    const snap = await adminDb.collection('events').orderBy('start_date', 'asc').get()
    const events = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter(isVisible)
      .filter((e) => {
        const t = Date.parse(e.start_date)
        return !Number.isNaN(t) && t >= start && t <= end
      })
      .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || Date.parse(a.start_date) - Date.parse(b.start_date))
    return { events, label }
  } catch {
    return { events: [], label }
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
