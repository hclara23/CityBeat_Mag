import { NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { hasSalesAccess } from '@citybeat/lib/roles'
import { checkoutLinkState } from '@/lib/checkout-recovery'

export const dynamic = 'force-dynamic'

// The abandoned-checkout follow-up board. These are businesses that engaged
// far enough to RECEIVE a payment link and then didn't pay — the warmest leads
// the platform has, and until this existed nobody on the team even knew they
// were sitting there (the audit found 8 of them going back a month). One row
// per customer, newest first, with the promo/recovery state so a rep can see
// who was offered what and who converted.
export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  if (!hasSalesAccess(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!profile?.mfa_enabled) {
    return NextResponse.json({ error: 'Two-factor authentication required' }, { status: 403 })
  }

  try {
    const snap = await adminDb.collection('sales_orders').limit(500).get()
    const now = new Date()
    const byEmail = new Map<string, any>()
    const paidEmails = new Set<string>()

    for (const doc of snap.docs) {
      const o = doc.data() as any
      const email = String(o.contact_email || '').trim().toLowerCase()
      if (!email.includes('@')) continue
      if (o.payment_status === 'paid') {
        paidEmails.add(email)
        continue
      }
      const state = checkoutLinkState(o, now)
      if (state !== 'expired' && state !== 'ready') continue
      const existing = byEmail.get(email)
      const row = {
        order_id: doc.id,
        business: o.business_name || '(unnamed)',
        email,
        product_id: o.product_id || null,
        amount: Number(o.amount) || 0,
        link_state: state,
        created_at: o.created_at || null,
        sold_by: o.sold_by || null,
        recovery_emailed_at: o.recovery_emailed_at || null,
        promo_offered: o.promo_offered || null,
        promo_offer_sent_at: o.promo_offer_sent_at || null,
        promo_link_clicked_at: o.promo_link_clicked_at || null,
      }
      // Keep the newest order per customer.
      if (!existing || String(row.created_at) > String(existing.created_at)) byEmail.set(email, row)
    }

    const leads = [...byEmail.values()]
      .map((l) => ({ ...l, converted: paidEmails.has(l.email) }))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))

    return NextResponse.json({
      leads,
      summary: {
        total: leads.length,
        offered: leads.filter((l) => l.promo_offer_sent_at).length,
        clicked: leads.filter((l) => l.promo_link_clicked_at).length,
        converted: leads.filter((l) => l.converted).length,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Could not load leads' }, { status: 500 })
  }
}
