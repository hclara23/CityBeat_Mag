import { NextResponse } from 'next/server'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'

export const dynamic = 'force-dynamic'

function toIso(v: any): string | null {
  if (!v) return null
  if (v?.toDate) return v.toDate().toISOString()
  return typeof v === 'string' ? v : null
}

function maskName(name: string): string {
  return name ? `${name.slice(0, 1)}${'*'.repeat(Math.min(6, Math.max(2, name.length - 1)))}` : ''
}

function maskContact(contact: string): string {
  if (contact.includes('@')) {
    const [local, domain] = contact.split('@')
    return `${local.slice(0, 1)}***@${domain || '***'}`
  }
  const digits = contact.replace(/\D/g, '')
  return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : '••••'
}

// Leads for the signed-in owner's listings. Premium/Featured listings see full
// contact details; basic listings see masked leads with an upgrade path — the
// lead ladder that makes the $19/mo subscription pay for itself visibly.
export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const mine = await adminDb
      .collection('directory_listings')
      .where('owner_id', '==', user.id)
      .get()

    const tierById = new Map<string, string>()
    for (const d of mine.docs) {
      const x = d.data() as any
      if (x.claim_status === 'approved') tierById.set(d.id, x.tier || 'basic')
    }
    if (tierById.size === 0) return NextResponse.json({ leads: [] })

    // Firestore `in` caps at 10 values — chunk the owned listing ids.
    const ids = [...tierById.keys()]
    const chunks: string[][] = []
    for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10))

    const docs: any[] = []
    for (const chunk of chunks) {
      const snap = await adminDb.collection('quote_requests').where('listing_id', 'in', chunk).get()
      docs.push(...snap.docs)
    }

    const leads = docs
      .map((d) => {
        const x = d.data() as any
        const tier = tierById.get(x.listing_id) || 'basic'
        const unlocked = ['premium', 'featured'].includes(tier)
        return {
          id: d.id,
          listing_id: x.listing_id,
          business_name: x.business_name || null,
          created_at: toIso(x.created_at),
          unlocked,
          name: unlocked ? x.name : maskName(String(x.name || '')),
          contact: unlocked ? x.contact : maskContact(String(x.contact || '')),
          message: unlocked ? x.message || null : x.message ? '••• upgrade to Premium to read the message •••' : null,
        }
      })
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 100)

    return NextResponse.json({ leads })
  } catch (error: any) {
    return NextResponse.json({ error: 'Could not load leads' }, { status: 500 })
  }
}
