// Server-side newsletter suppression + consent persistence. The single place
// every sender (digest, sales outreach) checks before emailing a promotional
// message, and where subscribe/unsubscribe write their records.

import { adminDb } from '@citybeat/lib/firebase/admin'
import {
  buildSubscriberRecord,
  emailHash,
  isSuppressedStatus,
  normalizeNewsletterEmail,
  type NewsletterStatus,
} from './newsletter'

// A suppression doc (keyed by emailHash) is the authoritative "never send"
// record. Kept separate from subscriber docs so it survives even if the
// subscriber record is missing.
export async function isEmailSuppressed(email: string): Promise<boolean> {
  const eid = emailHash(normalizeNewsletterEmail(email))
  try {
    const doc = await adminDb.collection('newsletter_suppressions').doc(eid).get()
    return doc.exists
  } catch {
    // Fail CLOSED for marketing — if we can't confirm the address is allowed,
    // don't send.
    return true
  }
}

// Load every suppressed emailHash once (for a bulk sender like the digest).
// Merges both suppression stores: newsletter_suppressions (already keyed by
// hash) and email_suppressions (keyed by plaintext email → hashed here), so a
// sales-outreach unsubscribe suppresses the newsletter too and vice versa.
// Returns null on a read failure so the caller can FAIL CLOSED (never blast
// marketing without a confirmed suppression list).
export async function loadSuppressedHashes(): Promise<Set<string> | null> {
  try {
    const out = new Set<string>()
    const [nl, em] = await Promise.all([
      adminDb.collection('newsletter_suppressions').get(),
      adminDb.collection('email_suppressions').get(),
    ])
    nl.docs.forEach((d) => out.add(d.id))
    em.docs.forEach((d) => out.add(emailHash(normalizeNewsletterEmail(d.id))))
    return out
  } catch {
    return null
  }
}

// Record a promotional-newsletter subscription. Deduped by emailHash.
//
// A previously SUPPRESSED (unsubscribed/complained/bounced) address is NEVER
// silently reactivated — an unauthenticated submit or a pre-checked signup box
// can't resurrect someone who opted out (per the non-negotiable + CAN-SPAM). Only
// `allowReactivate: true` (a confirmed/double-opt-in flow — not yet wired to any
// public caller) may clear a suppression. Everything else returns 'suppressed'
// and touches nothing.
export async function subscribeEmail(input: {
  email: string
  locale?: string
  source?: string
  method?: string
  userId?: string | null
  listingIds?: string[]
  allowReactivate?: boolean
}): Promise<{ ok: boolean; status: 'subscribed' | 'already_active' | 'reactivated' | 'suppressed' }> {
  const emailNormalized = normalizeNewsletterEmail(input.email)
  if (!emailNormalized || !emailNormalized.includes('@')) return { ok: false, status: 'already_active' }
  const eid = emailHash(emailNormalized)
  const now = new Date().toISOString()
  const subRef = adminDb.collection('newsletter_subscribers').doc(eid)

  const existing = await subRef.get()
  const priorStatus = existing.exists ? ((existing.data() as any)?.status as NewsletterStatus) : null
  const wasSuppressed = priorStatus ? isSuppressedStatus(priorStatus) : false
  // A suppression also exists independently in newsletter_suppressions.
  const suppressionExists = wasSuppressed || (await adminDb.collection('newsletter_suppressions').doc(eid).get()).exists

  if (existing.exists && priorStatus === 'active') {
    return { ok: true, status: 'already_active' }
  }

  // Refuse to reactivate a suppressed address without an explicit confirmed flow.
  if (suppressionExists && !input.allowReactivate) {
    await adminDb
      .collection('newsletter_consents')
      .add({ email_hash: eid, action: 'resubscribe_blocked', source: (input.source || 'newsletter').slice(0, 60), at: now })
      .catch(() => {})
    return { ok: true, status: 'suppressed' }
  }

  const record = buildSubscriberRecord({ ...input, now })
  if (existing.exists) {
    // Preserve original created_at; refresh consent + reactivate.
    await subRef.set({ ...record, created_at: (existing.data() as any)?.created_at || now }, { merge: true })
  } else {
    await subRef.set(record)
  }

  // Only a confirmed, deliberate resubscribe removes the permanent suppression.
  if (suppressionExists && input.allowReactivate) {
    await adminDb.collection('newsletter_suppressions').doc(eid).delete().catch(() => {})
  }

  // Consent history (append-only) — every consent change is auditable.
  await adminDb.collection('newsletter_consents').add({
    email_hash: eid,
    action: suppressionExists ? 'resubscribe' : 'subscribe',
    source: record.consent_source,
    method: record.consent_method,
    locale: record.consent_locale,
    policy_version: record.consent_policy_version,
    user_id: record.user_id,
    at: now,
  })

  return { ok: true, status: suppressionExists ? 'reactivated' : 'subscribed' }
}

// Suppress an email by its verified hash (from a signed unsubscribe token).
// Writes the suppression FIRST, then marks subscriber docs — returns whether the
// suppression persisted so the caller can show an honest success/error page.
export async function suppressByHash(
  eid: string,
  reason: 'unsubscribed' | 'complained' | 'bounced' = 'unsubscribed'
): Promise<boolean> {
  const now = new Date().toISOString()
  try {
    await adminDb.collection('newsletter_suppressions').doc(eid).set({
      email_hash: eid,
      reason,
      suppressed_at: now,
    })
  } catch {
    return false
  }
  // Best-effort: reflect the state on subscriber + consent history.
  await adminDb
    .collection('newsletter_subscribers')
    .doc(eid)
    .set({ status: reason, [`${reason}_at`]: now, updated_at: now }, { merge: true })
    .catch(() => {})
  // Legacy: also flip any auto-id subscriber docs matching this hash / email.
  await adminDb
    .collection('newsletter_subscribers')
    .where('email_hash', '==', eid)
    .get()
    .then((snap) =>
      Promise.all(
        snap.docs.map((d) =>
          d.id === eid ? Promise.resolve() : d.ref.set({ status: reason, updated_at: now }, { merge: true })
        )
      )
    )
    .catch(() => {})
  await adminDb
    .collection('newsletter_consents')
    .add({ email_hash: eid, action: reason, source: 'unsubscribe_link', at: now })
    .catch(() => {})
  return true
}
