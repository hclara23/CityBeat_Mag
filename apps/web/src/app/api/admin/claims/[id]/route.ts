import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { hasAdminAccess } from '@citybeat/lib/roles'
import { notifyUser } from '@/lib/user-notifications'
import { directoryApprovalTier } from '@/lib/sales-directory'
import { getStripe } from '@/lib/platform/stripe-connect'
import { reportFailure } from '@/lib/alerts'

export const dynamic = 'force-dynamic'

function toIso(v: any): string | null {
  if (!v) return null
  if (v?.toDate) return v.toDate().toISOString()
  return typeof v === 'string' ? v : null
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  if (!id) return NextResponse.json({ error: 'Missing listing ID' }, { status: 400 })

  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  if (!hasAdminAccess(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { action } = await request.json()
  if (!action || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action. Must be "approve" or "reject"' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const ref = adminDb.collection('directory_listings').doc(id)

  try {
    const existing = await ref.get()
    if (!existing.exists) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })

    const data = existing.data() as any
    const ownerId = data?.owner_id

    const updates =
      action === 'approve'
        ? {
            claim_status: 'approved',
            // Honor the tier set at claim/checkout time (basic for free claims,
            // premium/featured for paid). Falls back to premium for legacy claims.
            // Never lower the tier a live subscription is already paying for
            // — approval is an ownership decision, not a billing one.
            tier: directoryApprovalTier(data || {}),
            pending_tier: null,
            // Same promotion for a purchased Sponsored placement — held back
            // pending this exact review so a fraudulent claim couldn't light
            // up the directory homepage before an admin confirmed it.
            ...(data?.pending_sponsored
              ? { is_sponsored: true, sponsored_since: data?.sponsored_since || now }
              : {}),
            pending_sponsored: null,
            claimed_at: data?.claimed_at || now,
            updated_at: now,
          }
        : {
            claim_status: 'unclaimed',
            owner_id: null,
            pending_tier: null,
            pending_sponsored: null,
            // A rejected claim never gets to keep a placement it paid for
            // fraudulently — reset rather than merely leaving it pending.
            is_sponsored: false,
            verified_at: null,
            stripe_subscription_id: null,
            claimed_at: null,
            updated_at: now,
          }

    // Rejecting a claim stripped every entitlement and then nulled
    // stripe_subscription_id — but never told Stripe anything. The customer's
    // card kept being charged $9.99-$99/month, forever, for a listing we had
    // explicitly refused them, and nulling the field destroyed our own record of
    // what to cancel. Cancel FIRST, and if Stripe refuses, keep the id so the
    // subscription is still findable rather than silently orphaned.
    if (action === 'reject' && data?.stripe_subscription_id) {
      const subscriptionId = String(data.stripe_subscription_id)
      try {
        const stripe = getStripe()
        await stripe.subscriptions.cancel(subscriptionId)
      } catch (error: any) {
        // Already gone at Stripe? Then nulling the link is safe and correct.
        const missing = error?.code === 'resource_missing' || error?.statusCode === 404
        if (!missing) {
          delete (updates as Record<string, unknown>).stripe_subscription_id
          await reportFailure(
            'claim-reject-cancel-failed',
            new Error(
              `Rejected a paid claim but could NOT cancel its Stripe subscription — the customer is still being billed. Cancel ${subscriptionId} by hand.`
            ),
            { listing_id: id, subscription_id: subscriptionId }
          ).catch(() => {})
        }
      }
    }

    await ref.set(updates, { merge: true })

    // On approval, mark the owner as an advertiser so their dashboards unlock,
    // and tell them their listing is live (first-party inbox + email).
    if (action === 'approve' && ownerId) {
      await adminDb.collection('profiles').doc(ownerId).set({ is_advertiser: true }, { merge: true })
      const bizName = String(data?.name || 'your business')
      await notifyUser({
        userId: String(ownerId),
        type: 'claim_approved',
        title: `Your claim for ${bizName} was approved!`,
        title_es: `¡Tu reclamo de ${bizName} fue aprobado!`,
        body: 'You now manage this listing. Open your dashboard to complete your profile.',
        body_es: 'Ya administras esta ficha. Abre tu panel para completar tu perfil.',
        link: `/dashboard/listings/${id}`,
      }).catch(() => {})
    }
    const doc = await ref.get()
    return NextResponse.json({
      success: true,
      listing: { id: doc.id, ...doc.data(), updated_at: toIso(doc.data()?.updated_at) },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
