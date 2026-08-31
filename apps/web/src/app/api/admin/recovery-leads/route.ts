import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { hasSalesAccess } from '@citybeat/lib/roles'
import { checkoutLinkState } from '@/lib/checkout-recovery'

export const dynamic = 'force-dynamic'

// Shared gate: signed in, sales access, and 2FA — same bar the board's GET uses,
// reused by the dismiss action so it can never be looser than the read.
async function requireSalesMfa() {
  const user = await getServerUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const profile = await getServerUserProfile(user.id)
  if (!hasSalesAccess(profile)) return { error: 'Forbidden', status: 403 as const }
  if (!profile?.mfa_enabled) return { error: 'Two-factor authentication required', status: 403 as const }
  return { user }
}

// The abandoned-checkout follow-up board. These are businesses that engaged
// far enough to RECEIVE a payment link and then didn't pay — the warmest leads
// the platform has, and until this existed nobody on the team even knew they
// were sitting there (the audit found 8 of them going back a month). One row
// per customer, newest first, with the promo/recovery state so a rep can see
// who was offered what and who converted — and a phone number when we have one
// so a human can call.
export async function GET() {
  const auth = await requireSalesMfa()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const snap = await adminDb.collection('sales_orders').limit(500).get()
    const now = new Date()
    const byEmail = new Map<string, any>()
    const paidEmails = new Set<string>()

    for (const doc of snap.docs) {
      const o = doc.data() as any
      const email = String(o.contact_email || '').trim().toLowerCase()
      if (!email.includes('@')) continue
      // Paid is checked BEFORE the dismissed skip: a 'ready' link can be dismissed
      // and then still get paid, and that conversion must always count toward the
      // stats (and exclude the email from the board) even though the row is hidden.
      if (o.payment_status === 'paid') {
        paidEmails.add(email)
        continue
      }
      // A rep dismissed this lead ("Remove" on the board) — hide it, but the doc
      // is kept so a still-live link that later gets paid still fulfills.
      if (o.recovery_dismissed) continue
      const state = checkoutLinkState(o, now)
      if (state !== 'expired' && state !== 'ready') continue
      const existing = byEmail.get(email)
      const row = {
        order_id: doc.id,
        business: o.business_name || '(unnamed)',
        email,
        phone: typeof o.contact_phone === 'string' && o.contact_phone.trim() ? o.contact_phone.trim() : null,
        product_id: o.product_id || null,
        amount: Number(o.amount) || 0,
        // Billing shape so the UI shows the real cadence (/mo, /yr, or nothing for a
        // one-time product) instead of implying everything is monthly.
        billing_type: o.billing_type || null,
        billing_interval: o.billing_interval || null,
        link_state: state,
        created_at: o.created_at || null,
        sold_by: o.sold_by || null,
        listing_id: o.listing_id || null,
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

    // Enrich the phone from the linked directory listing (the enrich-contacts cron
    // keeps those current) for any lead that didn't carry its own contact_phone.
    const needPhone = leads.filter((l) => !l.phone && l.listing_id)
    if (needPhone.length) {
      const uniqueIds = [...new Set(needPhone.map((l) => l.listing_id as string))].slice(0, 100)
      try {
        const refs = uniqueIds.map((id) => adminDb.collection('directory_listings').doc(id))
        const docs = await adminDb.getAll(...refs)
        const phoneById = new Map<string, string>()
        for (const d of docs) {
          const p = (d.data() as any)?.phone
          if (d.exists && typeof p === 'string' && p.trim()) phoneById.set(d.id, p.trim())
        }
        for (const l of leads) {
          if (!l.phone && l.listing_id && phoneById.has(l.listing_id)) l.phone = phoneById.get(l.listing_id)!
        }
      } catch {
        /* enrichment is best-effort — a lookup failure just leaves phone null */
      }
    }

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

// Remove a lead from the board. This is a SOFT delete: it stamps
// `recovery_dismissed` so the row disappears, but the sales_orders doc is kept.
// Rationale (money safety): a lead's link can still be 'ready' (live Stripe
// session); hard-deleting the doc would make a later successful payment 404 in
// the webhook (order_not_found → the paying customer is never fulfilled) and
// would also destroy the audit record. Dismiss never touches a PAID order, and
// it clears every unpaid order sharing the email so an older sibling can't make
// the lead reappear. Reversible (unset the flag in Firestore).
export async function DELETE(request: NextRequest) {
  const auth = await requireSalesMfa()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const orderId = request.nextUrl.searchParams.get('order_id') || ''
  if (!orderId) return NextResponse.json({ error: 'order_id is required', code: 'order_id_required' }, { status: 400 })
  // A Firestore doc id with a '/' resolves to a SUBcollection path, which would let
  // this write escape the sales_orders collection. Restrict to a plain id shape.
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(orderId)) {
    return NextResponse.json({ error: 'Invalid order_id', code: 'invalid_order_id' }, { status: 400 })
  }

  try {
    const targetRef = adminDb.collection('sales_orders').doc(orderId)
    const targetSnap = await targetRef.get()
    if (!targetSnap.exists) return NextResponse.json({ error: 'Order not found', code: 'order_not_found' }, { status: 404 })
    const target = targetSnap.data() as any

    // Never hide a paid order — those belong to finance/fulfillment, not this board.
    if (target.payment_status === 'paid') {
      return NextResponse.json({ error: 'That order is paid and cannot be removed here.', code: 'order_paid' }, { status: 400 })
    }

    const email = String(target.contact_email || '').trim().toLowerCase()
    const nowIso = new Date().toISOString()
    const stamp = {
      recovery_dismissed: true,
      recovery_dismissed_at: nowIso,
      recovery_dismissed_by: auth.user.id,
      updated_at: nowIso,
    }

    // Dismiss every UNPAID order for this email so the lead can't resurface from an
    // older sibling. Scan (bounded, mirrors GET) so mixed-case emails are caught.
    // Fall back to the single target if it has no usable email.
    const ids = new Set<string>([orderId])
    if (email.includes('@')) {
      const snap = await adminDb.collection('sales_orders').limit(500).get()
      for (const doc of snap.docs) {
        const o = doc.data() as any
        if (o.payment_status === 'paid') continue
        if (String(o.contact_email || '').trim().toLowerCase() === email) ids.add(doc.id)
      }
    }

    const batch = adminDb.batch()
    for (const id of ids) batch.set(adminDb.collection('sales_orders').doc(id), stamp, { merge: true })
    await batch.commit()

    return NextResponse.json({ success: true, dismissed: ids.size, email: email || null })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Could not remove lead' }, { status: 500 })
  }
}
