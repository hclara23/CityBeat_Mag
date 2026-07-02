import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { resolveClaimVerification } from '@/lib/directory-security'
import { checkRateLimit } from '@/lib/auth-security'
import { sendEmail } from '@/lib/email'

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

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { id: listingId } = params
  if (!listingId) {
    return NextResponse.json({ error: 'Missing listing ID' }, { status: 400 })
  }

  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Please sign in to claim a business.' }, { status: 401 })
  }

  // Throttle code sends — each request emails the business's on-record address,
  // so an unthrottled caller could harass a business's inbox with codes.
  const [perListing, perUser] = await Promise.all([
    checkRateLimit(`claimstart:${user.id}:${listingId}`, { max: 3, windowMs: 60 * 60 * 1000 }),
    checkRateLimit(`claimstart:${user.id}`, { max: 10, windowMs: 60 * 60 * 1000 }),
  ])
  if (!perListing.ok || !perUser.ok) {
    return NextResponse.json(
      { error: 'Too many verification requests. Please try again later.' },
      { status: 429 }
    )
  }

  try {
    const { method } = await request.json()
    // Only email is wired to actually deliver a code. SMS and postcard are stubs,
    // so reject them here (the UI also hides them) until they're implemented.
    if (method !== 'email') {
      return NextResponse.json(
        { error: 'Only email verification is available right now. Phone and postcard are coming soon.' },
        { status: 400 }
      )
    }

    const CODE_TTL_MS = 15 * 60 * 1000 // codes expire after 15 minutes
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()

    const listingDoc = await adminDb.collection('directory_listings').doc(listingId).get()
    if (!listingDoc.exists) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }
    const listing = listingDoc.data() as any

    const verification = resolveClaimVerification({ method, listing })
    if (!verification.ok) {
      return NextResponse.json({ error: verification.error }, { status: verification.statusCode })
    }

    await adminDb.collection('directory_claims').add({
      listing_id: listingId,
      user_id: user.id,
      verification_method: method,
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
      const smsBody = `CityBeat Code: ${verificationCode} for ${listing.name}. Enter this code to verify business ownership.`
      await adminDb.collection('sent_notifications').add({
        user_id: user.id,
        type: 'sms',
        recipient: verification.recipient,
        body: smsBody,
        created_at: FieldValue.serverTimestamp(),
      })
      console.log(`[MOCK SMS] Verification code sent to ${verification.recipient}: ${verificationCode}`)
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
        return NextResponse.json(
          { error: 'Could not send the verification email. Please try another method.' },
          { status: 502 }
        )
      }
    } else if (verification.notificationType === 'postcard') {
      console.log(`[POSTCARD REQUESTED] Verification code generated for postcard: ${verificationCode}`)
    }

    return NextResponse.json({
      status: verification.status,
      method: verification.notificationType,
      recipient: maskedRecipient,
      message: 'Verification request initiated',
    })
  } catch (error: any) {
    console.error('Error starting verification:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
