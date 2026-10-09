import { randomUUID } from 'crypto'
import type Stripe from 'stripe'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { allocateFoundingSlot, reconcileFoundingSlot, type FoundingSlot } from './founding-capacity'

const capacity = () => adminDb.collection('founding_capacity').doc('launch100')
const clean = <T>(value: T): T => JSON.parse(JSON.stringify(value))

// Import outstanding pre-release checkouts before the first new reservation.
// These already-issued links must count too; never silently invalidate them.
async function legacyOpenSlots(stripe: Stripe): Promise<FoundingSlot[]> {
  if ((await capacity().get()).exists) return []
  const slots: FoundingSlot[] = []
  let scanned = 0
  for await (const session of stripe.checkout.sessions.list({ limit: 100 })) {
    if (++scanned > 5000) throw new Error('Founders history requires staff reconciliation before new checkout.')
    if (session.metadata?.founding !== 'true' || !['open', 'complete'].includes(String(session.status))) continue
    const key = session.metadata.listing_id || `order:${session.metadata.sales_order_id || session.id}`
    // Multiple old links for one business still consume one business place.
    // Imported links remain conservatively reserved for staff reconciliation.
    if (!slots.some(slot => slot.key === key)) slots.push({ key, attempt: `legacy:${session.id}`, state: session.status === 'complete' ? 'paid' : 'pending' })
  }
  return slots
}

async function releaseConfirmedExpired(stripe: Stripe) {
  const snap = await capacity().get()
  const slots: FoundingSlot[] = snap.data()?.slots || []
  for (const slot of slots.filter(s => s.state === 'open' && s.sessionId && Number(s.expiresAt) <= Date.now() / 1000)) {
    const session = await stripe.checkout.sessions.retrieve(slot.sessionId!)
    await adminDb.runTransaction(async tx => {
      const latest: FoundingSlot[] = (await tx.get(capacity())).data()?.slots || []
      const current = latest.find(s => s.key === slot.key && s.attempt === slot.attempt)
      if (!current) return
      const next = reconcileFoundingSlot(current, session)
      tx.set(capacity(), { slots: clean(latest.flatMap(s => s === current ? next ? [next] : [] : [s])) }, { merge: true })
    })
  }
}

/** All Founders checkout routes serialize through this one Firestore document.
 * A pending/unknown provider outcome stays reserved; time alone never frees it.
 * Persist exact parameters + idempotency key before calling Stripe so retries
 * recover the same checkout instead of charging twice or changing terms.
 */
export async function createFoundingCheckout(stripe: Stripe, key: string, params: Stripe.Checkout.SessionCreateParams) {
  if (!key) throw new Error('A business listing is required for a Founders reservation.')
  await releaseConfirmedExpired(stripe)
  const legacy = await legacyOpenSlots(stripe)
  const slot = await adminDb.runTransaction(async tx => {
    const [gate, paidListings, monthly, annual] = await Promise.all([
      tx.get(capacity()),
      tx.get(adminDb.collection('directory_listings').where('founding_member', '==', true)),
      tx.get(adminDb.collection('sales_orders').where('product_id', '==', 'directory_founding_monthly')),
      tx.get(adminDb.collection('sales_orders').where('product_id', '==', 'directory_founding_annual')),
    ])
    const slots: FoundingSlot[] = gate.exists ? gate.data()?.slots || [] : legacy
    const paidKeys = new Set(paidListings.docs.map(d => d.id))
    for (const d of [...monthly.docs, ...annual.docs]) {
      const order = d.data()
      if (order.payment_status === 'paid') paidKeys.add(order.listing_id || `order:${d.id}`)
    }
    for (const paidKey of paidKeys) {
      const i = slots.findIndex(s => s.key === paidKey)
      const paid: FoundingSlot = { key: paidKey, attempt: 'paid', state: 'paid' }
      if (i >= 0) slots[i] = paid
      else slots.push(paid)
    }
    const attempt = randomUUID()
    const storedParams = clean({ ...params, metadata: { ...params.metadata, founders_reservation_id: attempt }, expires_at: params.expires_at || Math.floor(Date.now() / 1000) + 23 * 3600 })
    const reservation = allocateFoundingSlot(slots, { key, attempt, state: 'pending', params: storedParams })
    tx.set(capacity(), { slots: clean(reservation.slots), updated_at: new Date().toISOString() }, { merge: true })
    return reservation.slot
  })
  if (slot.state === 'paid') throw new Error('This business already has a Founders place. Manage its subscription from Billing.')
  if (!slot.params) throw new Error('An earlier Founders checkout is reserved for this business. Contact CityBeat to recover it.')
  const prior = slot.params.metadata || {}
  if (JSON.stringify(slot.params.line_items) !== JSON.stringify(params.line_items)) {
    throw new Error('An earlier checkout has different terms. Contact CityBeat to release that reservation before starting a new checkout. No new charge was made.')
  }
  if (prior.plan !== params.metadata?.plan || prior.owner_id !== params.metadata?.owner_id || prior.sales_order_id !== params.metadata?.sales_order_id) {
    throw new Error('A different Founders checkout is already reserved for this business. Finish that checkout or wait for it to expire.')
  }
  const session = slot.sessionId
    ? await stripe.checkout.sessions.retrieve(slot.sessionId)
    : await stripe.checkout.sessions.create(slot.params as Stripe.Checkout.SessionCreateParams, { idempotencyKey: `founders-place-${slot.attempt}` })
  await adminDb.runTransaction(async tx => {
    const slots: FoundingSlot[] = (await tx.get(capacity())).data()?.slots || []
    const updated = slots.map(s => s.key === key && s.attempt === slot.attempt ? {
      ...s, sessionId: session.id, expiresAt: session.expires_at,
      state: session.status === 'complete' ? 'paid' : 'open',
    } : s)
    tx.set(capacity(), { slots: clean(updated) }, { merge: true })
  })
  if (session.status !== 'open' || !session.url) throw new Error('Checkout is complete or expired. Refresh your dashboard before trying again.')
  return session
}
