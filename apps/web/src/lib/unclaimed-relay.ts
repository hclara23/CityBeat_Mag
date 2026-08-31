import crypto from 'crypto'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { sendEmail } from './email'
import { sendSms, smsConfigured } from './sms'
import { isSuppressed } from './suppression'
import {
  RELAY_CAP_WINDOW_MS,
  RELAY_COLLECTION,
  RELAY_MONTHLY_CAP,
  buildRelayEmail,
  relayContactEmail,
  relayDedupeKey,
  relayEligible,
  type RelayDetail,
  type RelayListing,
} from './unclaimed-relay-email'

export { relayContactEmail, relayEligible, relayDedupeKey, RELAY_MONTHLY_CAP, RELAY_COLLECTION } from './unclaimed-relay-email'
export type { RelayDetail, RelayEventType, RelayListing } from './unclaimed-relay-email'

// ---------------------------------------------------------------------------
// Unclaimed-listing event relay (the db-touching half; pure rules + templates
// live in ./unclaimed-relay-email.ts).
//
// Thousands of unclaimed directory listings already generate real, high-intent
// events — a customer review, a public Q&A question, a quote request, a press
// mention in a CityBeat story — and (before this) every one of them fired into
// the void because notifications only reached listing.owner_id, which an
// unclaimed listing doesn't have. This module relays those events to the
// business's enriched contact email (found by the enrich-contacts cron) with a
// free-claim CTA. It is the single pipe all claim-driving signals flow through.
//
// Discipline (this is outbound email to scraped addresses — treat with care):
//   • eligibility + the per-listing cap are decided on a FRESH read of the
//     listing inside this function — caller snapshots can be stale or projected
//     (.select) and must never widen the cap
//   • one send per EVENT, ever — atomic create() reservation on a doc keyed by
//     the event id (which is an unguessable Firestore auto-id)
//   • hard per-listing cap (RELAY_MONTHLY_CAP per 30 days across all types),
//     stamped via arrayUnion so concurrent sends can't erase each other's marks
//   • honors the global marketing suppression list, and every email carries an
//     unsubscribe link (random token → /api/track/unsub?x=) + CAN-SPAM footer
//   • bilingual by construction (EN + ES stacked) — we don't know the owner's
//     language, and El Paso is Spanish-first
//   • never throws; a relay failure must never break the customer-facing write
//     (the review/question/quote itself)
// ---------------------------------------------------------------------------

const FROM = process.env.SALES_FROM_EMAIL || 'CityBeat <hello@citybeatmag.co>'

/**
 * Relay one event to the unclaimed listing's enriched contact. Best-effort and
 * silent: returns { sent, reason } and never throws.
 *
 * The caller's `listing` is only a hint for callers that already hold the doc —
 * eligibility and the cap are re-verified on a fresh read here, so a stale or
 * field-projected snapshot can never bypass the discipline.
 */
export async function sendUnclaimedRelay(input: {
  listingId: string
  listing: RelayListing
  eventId: string
  detail: RelayDetail
}): Promise<{ sent: boolean; reason?: string }> {
  try {
    const { listingId, eventId } = input
    // Cheap pre-screen on the caller's copy (skips the read for the common
    // claimed-listing case) — the authoritative check is on the fresh doc below.
    if (input.listing && input.listing.claim_status && input.listing.claim_status !== 'unclaimed') {
      return { sent: false, reason: 'not_eligible' }
    }

    const listingRef = adminDb.collection('directory_listings').doc(listingId)
    const freshSnap = await listingRef.get()
    const listing = (freshSnap.exists ? freshSnap.data() : null) as RelayListing | null
    if (!relayEligible(listing)) return { sent: false, reason: 'not_eligible' }
    const email = relayContactEmail(listing)!
    if (await isSuppressed(email)) return { sent: false, reason: 'suppressed' }

    // Per-listing frequency cap — a burst of events must not become spam.
    const now = Date.now()
    const history: string[] = Array.isArray(listing!.relay_sent_at) ? listing!.relay_sent_at! : []
    const recent = history.filter((iso) => {
      const t = Date.parse(String(iso))
      return Number.isFinite(t) && now - t < RELAY_CAP_WINDOW_MS
    })
    if (recent.length >= RELAY_MONTHLY_CAP) return { sent: false, reason: 'capped' }

    // Quote first-free decision happens HERE — after every gate — so a blocked
    // send can never burn the once-ever "first lead in full" reservation.
    let detail = input.detail
    let firstFreeClaimed = false
    if (detail.type === 'quote' && detail.full === undefined) {
      firstFreeClaimed = await claimFirstFreeLead(listingId)
      detail = { ...detail, full: firstFreeClaimed }
    }
    const releaseFirstFree = async () => {
      if (!firstFreeClaimed) return
      await adminDb.collection(RELAY_COLLECTION).doc(`quote_first:${listingId}`).delete().catch(() => {})
    }

    // One relay per event, ever — atomic reservation.
    const unsubToken = crypto.randomBytes(18).toString('hex')
    const relayRef = adminDb.collection(RELAY_COLLECTION).doc(relayDedupeKey(detail.type, eventId))
    try {
      await relayRef.create({
        listing_id: listingId,
        type: detail.type,
        email,
        unsub_token: unsubToken,
        status: 'sending',
        created_at: new Date().toISOString(),
      })
    } catch {
      await releaseFirstFree()
      return { sent: false, reason: 'duplicate' }
    }

    const { subject, html } = buildRelayEmail({
      listingId,
      businessName: String(listing!.name || ''),
      detail,
      unsubToken,
    })
    const result = await sendEmail(email, subject, html, FROM)

    await relayRef
      .set(
        { status: result.sent ? 'sent' : 'failed', ...(result.error ? { provider_error: result.error } : {}), sent_at: new Date().toISOString() },
        { merge: true }
      )
      .catch(() => {})

    if (result.sent) {
      // Stamp the cap window. arrayUnion: concurrent senders can't erase each
      // other's stamps (a whole-array write from a stale snapshot could).
      await listingRef.set({ relay_sent_at: FieldValue.arrayUnion(new Date().toISOString()) }, { merge: true }).catch(() => {})
      // Opportunistic prune so the array stays small (cap math only reads 30d).
      if (history.length > 30) {
        await listingRef.set({ relay_sent_at: [...recent, new Date().toISOString()] }, { merge: true }).catch(() => {})
      }

      // Quote leads can ALSO text the business — but only behind an explicit
      // opt-in flag (RELAY_SMS=on): the numbers are scraped without consent, so
      // SMS stays off even when Twilio is configured for other features (TCPA).
      if (detail.type === 'quote' && process.env.RELAY_SMS === 'on' && smsConfigured() && listing!.phone) {
        const biz = String(listing!.name || 'su negocio')
        void sendSms(
          String(listing!.phone),
          `CityBeat: a customer requested a quote from ${biz}. Details emailed to ${email}. / Un cliente pidió cotización a ${biz}. Detalles en su correo. Reply STOP to opt out / Responda STOP para cancelar.`
        ).catch(() => {})
      }
    } else {
      // Nothing was delivered — give the first-free promise back.
      await releaseFirstFree()
    }

    return { sent: result.sent, reason: result.sent ? undefined : result.error || 'send_failed' }
  } catch {
    return { sent: false, reason: 'error' }
  }
}

/**
 * Atomically claim the "first lead free" slot for a listing. Returns true only
 * for the caller that got there first — that quote lead is forwarded in full;
 * later ones get the teaser (matching what a claimed-basic listing sees, so
 * claiming never REDUCES what a business receives). Called by sendUnclaimedRelay
 * AFTER all gates pass; released again if the send fails.
 */
export async function claimFirstFreeLead(listingId: string): Promise<boolean> {
  try {
    await adminDb
      .collection(RELAY_COLLECTION)
      .doc(`quote_first:${listingId}`)
      .create({ listing_id: listingId, type: 'quote_first', created_at: new Date().toISOString() })
    return true
  } catch {
    return false
  }
}
