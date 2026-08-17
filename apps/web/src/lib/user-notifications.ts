// First-party owner notifications. The in-app inbox works WITHOUT any external
// provider: every notification is stored as a Firestore record first
// (user_notifications/{userId}/items), and email is a best-effort DELIVERY
// CHANNEL on top — its outcome is recorded honestly on the record (email_sent
// only flips true after the provider accepted the send).

import { adminDb } from '@citybeat/lib/firebase/admin'
import { sendEmail } from './email'
import {
  buildNotificationRecord,
  getNotifyPrefs,
  type NotificationType,
} from './notify-prefs'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export type NotificationDelivery = {
  inAppCreated: boolean
  deduped: boolean
  emailSent: boolean
}

export async function notifyUser(input: {
  userId: string
  // A stable id makes retries safe and prevents duplicate inbox/email alerts.
  notificationId?: string
  type: NotificationType
  title: string
  title_es?: string
  body?: string
  body_es?: string
  link?: string | null
  // Optional email override; defaults to the profile email.
  email?: string | null
  // Set false when the triggering flow already delivers its own email (e.g. the
  // lead route emails the business directly) — the inbox record is still kept.
  emailChannel?: boolean
}): Promise<NotificationDelivery> {
  if (!input.userId) return { inAppCreated: false, deduped: false, emailSent: false }
  const now = new Date().toISOString()
  const record = buildNotificationRecord({ ...input, now })

  try {
    // 1) First-party record — the source of truth for the in-app inbox.
    const items = adminDb
      .collection('user_notifications')
      .doc(input.userId)
      .collection('items')
    let ref
    if (input.notificationId) {
      ref = items.doc(input.notificationId)
      try {
        await ref.create(record)
      } catch (error: any) {
        // Firestore code 6 = ALREADY_EXISTS. The original alert (and any email
        // result) is authoritative, so a retry must stop here.
        if (error?.code === 6 || error?.code === 'already-exists') {
          return { inAppCreated: false, deduped: true, emailSent: false }
        }
        throw error
      }
    } else {
      ref = await items.add(record)
    }

    // 2) Email delivery channel, preference-gated (activity emails default on).
    if (input.emailChannel === false) {
      return { inAppCreated: true, deduped: false, emailSent: false }
    }
    const profileDoc = await adminDb.collection('profiles').doc(input.userId).get()
    const profile = profileDoc.exists ? (profileDoc.data() as Record<string, any>) : null
    const prefs = getNotifyPrefs(profile)
    const to = input.email || profile?.email
    if (!prefs.activity_email || !to) {
      return { inAppCreated: true, deduped: false, emailSent: false }
    }

    // Bilingual: ~90% of the audience is Spanish-speaking — use the owner's
    // stored locale for the subject, body, CTA, footer, and dashboard link.
    const locale: 'en' | 'es' = profile?.locale === 'es' ? 'es' : 'en'
    const subject = (locale === 'es' ? record.title_es : record.title) || record.title
    const bodyText = (locale === 'es' ? record.body_es : record.body) || record.body
    const cta = locale === 'es' ? 'Abrir panel' : 'Open dashboard'
    const footer =
      locale === 'es'
        ? 'CityBeat · Puedes desactivar los correos de actividad en la configuración de tu panel.'
        : 'CityBeat · You can turn activity emails off in your listing dashboard settings.'
    const link = record.link ? `${APP_URL}/${locale}${record.link}` : `${APP_URL}/${locale}/dashboard`
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <p style="font-weight:800;font-size:18px;color:#0f172a;margin:0 0 8px">${esc(subject)}</p>
        ${bodyText ? `<p style="color:#334155;font-size:14px;line-height:1.6;margin:0 0 16px">${esc(bodyText)}</p>` : ''}
        <p style="margin:20px 0"><a href="${link}" style="background:#22d3ee;color:#000;font-weight:800;padding:11px 20px;border-radius:8px;text-decoration:none;text-transform:uppercase;letter-spacing:1px;font-size:12px">${esc(cta)}</a></p>
        <p style="color:#94a3b8;font-size:11px">${esc(footer)}</p>
      </div>`
    const result = await sendEmail(String(to), subject, html)
    if (result.sent) {
      // Delivery is only claimed after the provider accepted the message.
      await ref.set({ email_sent: true }, { merge: true })
    }
    return { inAppCreated: true, deduped: false, emailSent: result.sent }
  } catch {
    // Notifications must never break the triggering flow.
    return { inAppCreated: false, deduped: false, emailSent: false }
  }
}
