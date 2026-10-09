import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { checkRateLimit, getClientIp } from '@/lib/auth-security'
import { trustedSignInOrigin } from '@/lib/google-signin-policy'
import { foundingOfferAvailable } from '@/lib/sales-founding'
import { FOUNDING_LIMIT } from '@/lib/pricing'
import { normalizeBusinessKey, parseFoundersBusiness } from '@/lib/founders-onboarding'

export const dynamic = 'force-dynamic'
const APP = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'
let duplicateCorpus: { at: number; docs: Array<{ id: string; data: () => any }> } | null = null

async function duplicateCandidates() {
  if (duplicateCorpus && Date.now() - duplicateCorpus.at < 300000) return duplicateCorpus.docs
  // Older imported listings lack a normalized key. Cache a bounded projection
  // so punctuation/case variations cannot evade checks, without a read per keypress.
  const snap = await adminDb.collection('directory_listings')
    .select('name', 'address', 'phone', 'is_published', 'owner_id').limit(10001).get()
  if (snap.docs.length > 10000) throw new Error('Directory requires indexed duplicate checking.')
  duplicateCorpus = { at: Date.now(), docs: snap.docs }
  return snap.docs
}

export async function GET(request: NextRequest) {
  const rate = await checkRateLimit(`founders:read:${getClientIp(request)}`, { max: 60, windowMs: 60000 })
  if (!rate.ok) return NextResponse.json({ error: 'Please try again shortly.' }, { status: 429 })
  try {
    const paidAvailable = await foundingOfferAvailable()
    // Informational only. Checkout serializes through createFoundingCheckout,
    // reconciles expired reservations and imports legacy sessions before charging.
    // Do not disable retries solely for old reservations: only the checkout
    // allocator can ask Stripe whether an expired session is safe to release.
    return NextResponse.json({ available: paidAvailable,
      limit: FOUNDING_LIMIT }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ available: false, error: 'Availability could not be confirmed. Please retry.' }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  if (!trustedSignInOrigin(request.headers.get('origin'), APP)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Sign in before creating a listing.' }, { status: 401 })
  if (!user.email_verified) return NextResponse.json({ error: 'Verify your email or sign in with Google first.' }, { status: 403 })
  const rate = await checkRateLimit(`founders:create:${user.id}`, { max: 5, windowMs: 3600000 })
  if (!rate.ok) return NextResponse.json({ error: 'Too many submissions. Please contact CityBeat.' }, { status: 429 })
  if (Number(request.headers.get('content-length')) > 20000) return NextResponse.json({ error: 'Submission too large.' }, { status: 413 })
  let business: ReturnType<typeof parseFoundersBusiness>
  try { business = parseFoundersBusiness(await request.json()) }
  catch (error: any) { return NextResponse.json({ error: error.message || 'Invalid business details.' }, { status: 400 }) }
  try {
    const collection = adminDb.collection('directory_listings')
    // Recheck server-side, even if a caller bypasses the search UI. Never
    // overwrite a preexisting listing. Check exact address/phone as well as name.
    const duplicate = (await duplicateCandidates()).find(d => {
      const x = d.data()
      return normalizeBusinessKey(String(x.name || '')) === normalizeBusinessKey(business.name)
        || (normalizeBusinessKey(String(x.address || '')) === normalizeBusinessKey(business.address)
          && String(x.phone || '').replace(/\D/g, '') === business.phone.replace(/\D/g, ''))
    })
    if (duplicate) {
      const x = duplicate.data()
      return NextResponse.json({ error: 'A matching listing already exists. Claim or manage it instead.',
        listingId: x.is_published || x.owner_id === user.id ? duplicate.id : null }, { status: 409 })
    }
    const hash = createHash('sha256').update(`${normalizeBusinessKey(business.name)}:${normalizeBusinessKey(business.address)}`).digest('hex').slice(0, 32)
    const ref = collection.doc(`founders-${hash}`)
    const result = await adminDb.runTransaction(async tx => {
      const existing = await tx.get(ref)
      if (existing.exists) return { id: existing.data()?.owner_id === user.id ? ref.id : null, exists: true }
      const now = new Date().toISOString()
      const { addresses, ...fields } = business
      tx.create(ref, { ...fields, locations: addresses.map(address => ({ address })),
        owner_id: user.id, contact_email: user.email, tier: 'basic', pending_tier: 'basic',
        claim_status: 'pending_approval', ownership_verified: false,
        verification_method: 'founders_self_submission_requires_staff_review',
        onboarding_source: 'founders', is_published: false, rating: 0, user_ratings_total: 0,
        claimed_at: now, created_at: now, updated_at: now })
      return { id: ref.id, exists: false }
    })
    duplicateCorpus = null
    return NextResponse.json({ listingId: result.id, status: 'pending_approval',
      message: 'Submitted for ownership and content review. No payment was taken. Your Basic listing is free after approval.' }, { status: result.exists ? 409 : 201 })
  } catch {
    return NextResponse.json({ error: 'Could not save your listing. Please retry; identical submissions will not create duplicates.' }, { status: 503 })
  }
}
