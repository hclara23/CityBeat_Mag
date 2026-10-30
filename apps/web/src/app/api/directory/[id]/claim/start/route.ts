import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { resolveClaimVerification } from '@/lib/directory-security'
import { checkRateLimit } from '@/lib/auth-security'
import { sendEmail } from '@/lib/email'
import { sendSms } from '@/lib/sms'
import { reportFailure } from '@/lib/alerts'
import { recordClaimEvent } from '@/lib/claim-funnel'
import { acceptsClaimSmsConsent, CLAIM_SMS_CONSENT, CLAIM_SMS_CONSENT_VERSION } from '@/lib/claim-sms-consent'
import { randomInt } from 'crypto'
import { claimSmsMessage } from '@/lib/claim-sms-message'

export const dynamic = 'force-dynamic'

// Mask a contact so the response can confirm where the code went without
// leaking the full address/number to a non-owner.
function maskContact(value: string, type: 'email' | 'sms'): string {
  if (type === 'email') {
    const [local, domain] = value.split('@')
    if (!domain) return value
    const head = local.slice(0, 1)
    return `${head}${'*'.repeat(Math.max(1, local.length - 1))}@${domain}`
  }
  const digits = value.replace(/\D/g, '')
  return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : value
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { id: listingId } = params
  if (!listingId) {
    return NextResponse.json({ error: 'Missing listing ID' }, { status: 400 })
  }

  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Please sign in to claim a business.' }, { status: 401 })
  }

  // Every outcome of this request is recorded (lib/claim-funnel.ts): the failures
  // used to leave no trace at all, so "why does nobody finish claiming?" had no answer.
  const track = (outcome: string, method?: unknown) =>
    recordClaimEvent({
      step: 'code_requested',
      listing_id: listingId,
      user_id: user.id,
      outcome,
      method: typeof method === 'string' ? method : null,
    })

  // Throttle code sends — each request emails the business's on-record address,
  // so an unthrottled caller could harass a business's inbox with codes.
  const [perListing, perUser] = await Promise.all([
    checkRateLimit(`claimstart:${user.id}:${listingId}`, { max: 3, windowMs: 60 * 60 * 1000 }),
    checkRateLimit(`claimstart:${user.id}`, { max: 10, windowMs: 60 * 60 * 1000 }),
  ])
  if (!perListing.ok || !perUser.ok) {
    await track('rate_limited')
    return NextResponse.json(
      { error: 'Too many verification requests. Please try again later.' },
      { status: 429 }
    )
  }

  try {
    const { method, smsConsent, smsConsentVersion, locale } = await request.json()
    if (method === 'phone' && !acceptsClaimSmsConsent(smsConsent, smsConsentVersion)) {
      await track('sms_consent_required', method)
      return NextResponse.json({ error: 'Please agree to the SMS verification disclosure before requesting a code.' }, { status: 400 })
    }
    const consentLocale = locale === 'es' ? 'es' : 'en'
    // Email and phone both deliver a real code now. Postcard is still a stub:
    // resolveClaimVerification returns ok with a null recipient and nothing is
    // ever sent, so allowing it would strand the claim in 'pending' with no code
    // on the way.
    //
    // Phone matters out of proportion to the size of this change. Measured
    // against the live collection: 8,863 of 9,790 listings carry a phone and
    // only 787 carry an email. Email-only verification therefore left roughly
    // 82% of the directory unclaimable by the very owner it belongs to.
    if (method !== 'email' && method !== 'phone') {
      await track('bad_method', method)
      return NextResponse.json(
        { error: 'Choose email or text verification. Postcard verification is not available yet.' },
        { status: 400 }
      )
    }

    const CODE_TTL_MS = 15 * 60 * 1000 // codes expire after 15 minutes
    const verificationCode = randomInt(100000, 1000000).toString()

    const listingDoc = await adminDb.collection('directory_listings').doc(listingId).get()
    if (!listingDoc.exists) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }
    const listing = listingDoc.data() as any

    const verification = resolveClaimVerification({ method, listing })
    if (!verification.ok) {
      await track('unavailable', method)
      return NextResponse.json({ error: verification.error }, { status: verification.statusCode })
    }

    const claimRef = await adminDb.collection('directory_claims').add({
      listing_id: listingId,
      user_id: user.id,
      verification_method: method,
      ...(method === 'phone' ? { sms_consent: { accepted: true, version: CLAIM_SMS_CONSENT_VERSION, disclosure: CLAIM_SMS_CONSENT[consentLocale], locale: consentLocale, source: 'directory_claim_checkbox', recorded_at: FieldValue.serverTimestamp() } } : {}),
      verification_code: verificationCode,
      status: verification.status,
      email_address: verification.notificationType === 'email' ? verification.recipient : null,
      phone_number: verification.notificationType === 'sms' ? verification.recipient : null,
      expires_at: Date.now() + CODE_TTL_MS,
      created_at: FieldValue.serverTimestamp(),
    })

    let maskedRecipient: string | null = null

    if (verification.notificationType === 'sms' && verification.recipient) {
      maskedRecipient = maskContact(verification.recipient, 'sms')
      const smsBody = claimSmsMessage(verificationCode, consentLocale)
      // Was console.log("[MOCK SMS]"), which told the caller a code had been
      // sent and sent nothing. Mirrors the email branch below: record the real
      // outcome, and fail loudly rather than claim a delivery that never
      // happened.
      const smsResult = await sendSms(verification.recipient, smsBody)
      await adminDb.collection('sent_notifications').add({
        user_id: user.id,
        type: 'sms',
        recipient: verification.recipient,
        body: smsBody,
        sent: smsResult.sent,
        error: smsResult.error || null,
        created_at: FieldValue.serverTimestamp(),
      })
      if (!smsResult.sent) {
        // Distinguish the three real failures instead of leaving an owner
        // waiting for a text that is never coming:
        //   no_sms_provider — the Twilio credentials aren't set on the service.
        //   invalid_from    — TWILIO_FROM isn't a sendable number (a value that
        //                     fails here breaks texting for EVERY recipient, so
        //                     it is reported to ops, not just to this caller).
        // Anything else is Twilio refusing this particular send; its own error
        // code rides along in smsResult.error (e.g. twilio_400_30034, the
        // A2P 10DLC registration block that hits new accounts first).
        // Delete the claim row we just wrote. It says status 'code_sent' for a
        // code that was never sent, and lib/sales-agent.ts queries exactly that
        // status and, two days later, emails the owner "You started claiming
        // <name> but the code expired." Nobody started anything — we failed to
        // send. Today EVERY phone claim takes this path because TWILIO_* is
        // unset; once the credentials land it is still the path for Twilio
        // 30034, the A2P block a new account hits first. Each retry would add
        // another orphan row and another false accusation.
        await claimRef.delete().catch(() => {})
        await track(smsResult.error === 'no_sms_provider' ? 'sms_not_enabled' : 'sms_failed', method)
        if (smsResult.error === 'invalid_from') {
          await reportFailure('directory:claim:sms', new Error('TWILIO_FROM is not a sendable E.164 number'), {
            listing_id: listingId,
          })
        }
        return NextResponse.json(
          {
            error:
              smsResult.error === 'no_sms_provider'
                ? 'Text verification is not switched on yet. Please verify by email, or contact us to claim this listing.'
                : 'Could not send the verification text. Please try another method.',
          },
          { status: 502 }
        )
      }
    } else if (verification.notificationType === 'email' && verification.recipient) {
      maskedRecipient = maskContact(verification.recipient, 'email')
      const subject = `Your CityBeat verification code: ${verificationCode}`
      const html = `<div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:480px;margin:0 auto;color:#111">
  <h2 style="font-weight:900">CityBeat</h2>
  <p>Someone requested to verify ownership of <strong>${listing.name}</strong> on CityBeat.</p>
  <p>Your verification code is:</p>
  <p style="font-size:32px;font-weight:900;letter-spacing:6px;margin:16px 0">${verificationCode}</p>
  <p style="color:#666;font-size:13px">Enter this code on CityBeat to confirm you own this business. If you didn't request this, you can ignore this email.</p>
</div>`
      const result = await sendEmail(verification.recipient, subject, html)
      await adminDb.collection('sent_notifications').add({
        user_id: user.id,
        type: 'email',
        recipient: verification.recipient,
        body: subject,
        sent: result.sent,
        error: result.error || null,
        created_at: FieldValue.serverTimestamp(),
      })
      if (!result.sent) {
        // The same orphan as the SMS branch above.
        await claimRef.delete().catch(() => {})
        await track('email_failed', method)
        return NextResponse.json(
          { error: 'Could not send the verification email. Please try another method.' },
          { status: 502 }
        )
      }
    } else if (verification.notificationType === 'postcard') {
      console.log(`[POSTCARD REQUESTED] Verification code generated for postcard: ${verificationCode}`)
    }

    await track('sent', method)
    return NextResponse.json({
      status: verification.status,
      method: verification.notificationType,
      recipient: maskedRecipient,
      message: 'Verification request initiated',
    })
  } catch (error: any) {
    console.error('Error starting verification:', error)
    await track('error')
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
