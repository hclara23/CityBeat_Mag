import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { reportCronAuthRejected, reportFailure, reportSuccess } from '@/lib/alerts'
import { compEnded, compExpiryPatch, needsCompReminder } from '@/lib/directory-comp'
import { compReminderEmail } from '@/lib/comp-promo-email'
import { mintUnsubToken, normalizeNewsletterEmail } from '@/lib/newsletter'
import { isSuppressed } from '@/lib/suppression'
import { unsubHeaders } from '@/lib/unsub-headers'
import { sendEmail } from '@/lib/email'
import { premierExpiryExtras } from '@/lib/premier-promotion'
import { foundingOfferAvailable } from '@/lib/sales-founding'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

// Ends complimentary tier grants (lib/directory-comp.ts) and sends the one
// "your free Premium ends soon" email beforehand.
//
// Without this a free grant never ends: every other part of the app treats a
// Premium tier as permanent, and only the Stripe webhook ever lowers one.
// resolveEntitlements already stops honouring a lapsed grant on read; this is
// what puts the stored `tier` back, so ranking and badges follow too.
//
//   ?dryRun=1  report what would change without writing or emailing

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'
const FROM = process.env.SALES_FROM_EMAIL || 'CityBeat <hello@citybeatmag.co>'
const ADDRESS = process.env.SALES_PHYSICAL_ADDRESS || 'CityBeat Media Group, El Paso, TX, USA'
const SCAN_LIMIT = 1000

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    await reportCronAuthRejected('cron:comp-expiry', request.headers.get('authorization'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const dryRun = new URL(request.url).searchParams.get('dryRun') === '1'
  const now = new Date()

  try {
    // Resolved once per run, not per listing: foundingOfferAvailable() counts a
    // collection, and the answer is the same for every recipient in the batch.
    // It fails CLOSED — if availability cannot be established the reminder
    // quotes the standard price rather than promising a rate we cannot honour.
    const foundingAvailable = await foundingOfferAvailable().catch(() => false)
    // Single-field filter → automatic index; no composite index to forget.
    const snap = await adminDb
      .collection('directory_listings')
      .where('comp_tier', 'in', ['premium', 'featured'])
      .limit(SCAN_LIMIT)
      .get()

    const expired: string[] = []
    const reminded: string[] = []
    const skipped: Array<{ id: string; reason: string }> = []

    for (const doc of snap.docs) {
      const listing = doc.data() as any

      if (compEnded(listing, now)) {
        expired.push(doc.id)
        if (!dryRun) await adminDb.runTransaction(async tx => {
          const current = (await tx.get(doc.ref)).data()
          // Payment may arrive after the scan. Never apply an unpaid snapshot
          // over a concurrently activated subscription.
          if (!current || !compEnded(current, now)) return
          tx.set(doc.ref, { ...compExpiryPatch(current, now), ...premierExpiryExtras(current) }, { merge: true })
          tx.set(adminDb.collection('directory_audit_log').doc(), { listing_id: doc.id,
            action: 'complimentary_tier_expired', actor: 'comp-expiry', created_at: now.toISOString(),
            previous_tier: current.tier || null, retained_subscription: Boolean(current.stripe_subscription_id) })
        })
        continue
      }

      if (!needsCompReminder(listing, now)) continue
      const to = String(listing.contact_email || listing.email || '').trim()
      if (!to) { skipped.push({ id: doc.id, reason: 'no email' }); continue }
      if (await isSuppressed(to)) { skipped.push({ id: doc.id, reason: 'suppressed' }); continue }

      reminded.push(doc.id)
      if (dryRun) continue
      const claimed = listing.claim_status === 'approved' && listing.owner_id
      const locale = listing.locale === 'es' ? 'es' : 'en'
      const { subject, html } = compReminderEmail({
        foundingAvailable,
        businessName: String(listing.name || 'Your business'),
        listingUrl: `${APP_URL}/${locale}/directory/${doc.id}`,
        claimUrl: `${APP_URL}/${locale}/directory/${doc.id}/claim`,
        // ?plan= so the page lands with the quoted plan already selected and its
        // Subscribe button live. Without it the recipient was promised a rate and
        // then shown a disabled button reading "Choose an optional paid plan".
        // The plan MUST agree with the copy: foundingAvailable is what decides
        // which price the email quotes, so a link offering $9.99 that checks out
        // at $19.99 would be worse than no link at all.
        upgradeUrl: claimed
          ? `${APP_URL}/${locale}/dashboard`
          : `${APP_URL}/${locale}/directory/${doc.id}/claim?plan=${foundingAvailable ? 'founding' : 'premium_monthly'}`,
        until: String(listing.comp_until),
        unsubUrl: `${APP_URL}/api/newsletter/unsubscribe?u=${encodeURIComponent(mintUnsubToken(normalizeNewsletterEmail(to)))}`,
        postalAddress: ADDRESS,
        locale,
      })
      const r = await sendEmail(to, subject, html, FROM, { headers: unsubHeaders(to, locale) })
      // Stamp only a real send, so a transient mail failure is retried tomorrow.
      if (r.sent) await doc.ref.set({ comp_reminder_sent_at: now.toISOString() }, { merge: true })
      else skipped.push({ id: doc.id, reason: `send failed: ${r.error || 'unknown'}` })
    }

    if (!dryRun) {
      await reportSuccess('cron:comp-expiry')
      if (snap.size >= SCAN_LIMIT) {
        await reportFailure(
          'comp-expiry-scan-cap',
          new Error(`The comp-grant scan hit its ${SCAN_LIMIT}-document cap; some grants were not checked.`),
          { limit: SCAN_LIMIT }
        ).catch(() => {})
      }
    }

    return NextResponse.json({ ok: true, dryRun, active_grants: snap.size, expired, reminded, skipped })
  } catch (error: any) {
    await reportFailure('cron:comp-expiry', error).catch(() => {})
    return NextResponse.json(
      { error: 'Could not process comp grants', reason: String(error?.message || error).slice(0, 300) },
      { status: 500 }
    )
  }
}
