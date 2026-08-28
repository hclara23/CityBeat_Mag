import { NextResponse, NextRequest } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { hasSalesAccess } from '@citybeat/lib/roles'
import { sendEmail } from '@/lib/email'
import { moderationOutcomeEmail } from '@/lib/buyer-emails'

export const dynamic = 'force-dynamic'

// ad_campaigns (newsletter sponsorships) had NO admin surface at all before
// this — the self-serve dashboard filters by created_by, which a sales-rep-sold
// campaign never has, so a paid newsletter sponsorship could never be turned on
// by anyone in the product. Sales-desk-visible for the same reason jobs is: no
// ownership-dispute risk, a rep should be able to unblock their own sale.
async function requireSalesAccess() {
  const user = await getServerUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const profile = await getServerUserProfile(user.id)
  if (!hasSalesAccess(profile)) return { error: 'Forbidden', status: 403 as const }
  // The admin PAGES force 2FA enrollment (both route-group layouts); these
  // APIs approve paid content and must not accept a password-only session.
  if (!profile?.mfa_enabled) return { error: 'Two-factor authentication required', status: 403 as const }
  return { user }
}

function toIso(v: any): string | null {
  if (!v) return null
  if (v?.toDate) return v.toDate().toISOString()
  return typeof v === 'string' ? v : null
}

export async function GET() {
  const auth = await requireSalesAccess()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const snap = await adminDb.collection('ad_campaigns').orderBy('created_at', 'desc').limit(300).get()
    const campaigns = snap.docs.map((d) => {
      const data = d.data() as any
      return { id: d.id, ...data, created_at: toIso(data.created_at) }
    })
    return NextResponse.json({ campaigns })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSalesAccess()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json().catch(() => ({}))
  const id = typeof body.id === 'string' ? body.id : ''
  const action = body.action === 'reject' ? 'reject' : body.action === 'approve' ? 'approve' : ''
  if (!id || !action) return NextResponse.json({ error: 'id and action (approve|reject) required' }, { status: 400 })

  const now = new Date().toISOString()
  const updates =
    action === 'approve'
      ? { is_active: true, status: 'running', moderated_by: auth.user.id, moderated_at: now, updated_at: now }
      : { is_active: false, status: 'rejected', moderated_by: auth.user.id, moderated_at: now, updated_at: now }

  try {
    const ref = adminDb.collection('ad_campaigns').doc(id)
    const existing = await ref.get()
    if (!existing.exists) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    // The newsletter has exactly ONE "Sponsored by" slot and the digest reads
    // one banner with no ordering — so approving a second concurrent
    // sponsorship silently buried one paying sponsor behind the other,
    // $50/mo for a placement that never rendered. Refuse instead: the slot
    // must be freed (reject/cancel the current occupant) before a new
    // sponsor is approved.
    if (action === 'approve') {
      const occupied = await adminDb
        .collection('ad_banners')
        .where('placement', '==', 'newsletter')
        .where('is_active', '==', true)
        .limit(5)
        .get()
        .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }))
      const conflict = occupied.docs.find((d) => d.id !== `campaign:${id}`)
      if (conflict) {
        return NextResponse.json(
          {
            error: `The newsletter sponsor slot is already occupied (${(conflict.data() as any)?.sponsor_name || conflict.id}). Deactivate that banner first — approving a second sponsorship would bill them for a placement that never appears.`,
            code: 'newsletter_slot_occupied',
          },
          { status: 409 }
        )
      }
    }

    await ref.set(updates, { merge: true })

    // Approving here previously flipped a flag nothing rendered. The weekly
    // digest builds its paid "Sponsored by" slot from `ad_banners` with
    // placement 'newsletter' (cron/newsletter-digest getNewsletterSponsor),
    // while the paid newsletter_sponsorship product is fulfilled into
    // `ad_campaigns` — two different collections, so an approved sponsorship
    // never actually appeared in a newsletter and the customer paid $50/mo for
    // nothing. Mirror the approved campaign into the banner slot the digest
    // really reads, keyed to this campaign so re-approving updates in place.
    const campaign = existing.data() as Record<string, any>
    const bannerRef = adminDb.collection('ad_banners').doc(`campaign:${id}`)
    if (action === 'approve') {
      await bannerRef.set(
        {
          sponsor_name: campaign.advertiser_name || campaign.name || '',
          title: campaign.headline || campaign.name || '',
          description: campaign.body_copy || null,
          image_url: campaign.creative_url || campaign.logo_url || null,
          link_url: campaign.target_url || null,
          placement: 'newsletter',
          locale: 'all',
          priority: 0,
          is_active: true,
          source_campaign_id: id,
          sales_order_id: campaign.sales_order_id || null,
          stripe_subscription_id: campaign.stripe_subscription_id || null,
          updated_at: now,
        },
        { merge: true }
      )
    } else {
      // Rejecting must also pull it out of the newsletter.
      await bannerRef.set({ is_active: false, updated_at: now }, { merge: true }).catch(() => {})
    }

    // Tell the sponsor the outcome (best-effort).
    try {
      const to = campaign.contact_email
      if (to) {
        const { subject, html } = moderationOutcomeEmail({
          itemLabel: campaign.name || campaign.advertiser_name,
          kindLabelEn: 'newsletter sponsorship',
          kindLabelEs: 'patrocinio del boletín',
          approved: action === 'approve',
        })
        await sendEmail(String(to), subject, html)
      }
    } catch {
      /* best-effort */
    }

    return NextResponse.json({ success: true, ...updates })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
