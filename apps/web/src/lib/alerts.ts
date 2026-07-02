import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { sendEmail } from './email'
import { checkRateLimit } from './auth-security'

// Operational alerting for the unattended automation. When a cron or the Stripe
// webhook fails, the machine must tell a human — logs nobody reads don't count.
// Every failure is written to `system_alerts`; an email goes to ALERT_EMAIL,
// deduped per source (max 3 per 6h) so a crashloop can't flood the inbox.

const ALERT_EMAIL = process.env.ALERT_EMAIL || 'morningstarelp@gmail.com'

export async function reportFailure(source: string, error: unknown, context?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error)
  const stack = error instanceof Error ? (error.stack || '').slice(0, 2000) : null

  // Always record the alert, even when the email is deduped away.
  try {
    await adminDb.collection('system_alerts').add({
      source,
      message: message.slice(0, 1000),
      stack,
      context: context || null,
      created_at: FieldValue.serverTimestamp(),
    })
  } catch {
    /* alerting must never crash the caller */
  }

  try {
    const rl = await checkRateLimit(`alert:${source}`, { max: 3, windowMs: 6 * 60 * 60 * 1000 })
    if (!rl.ok) return { alerted: false, deduped: true }

    const subject = `[CityBeat ALERT] ${source} failed`
    const html = `<div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-weight:900">CityBeat — automation failure</h2>
  <p><strong>Source:</strong> ${source}</p>
  <p><strong>Error:</strong> ${message.slice(0, 500)}</p>
  ${context ? `<p><strong>Context:</strong> <code>${JSON.stringify(context).slice(0, 500)}</code></p>` : ''}
  <p style="color:#666;font-size:13px">Full details are in the <code>system_alerts</code> Firestore collection.
  Repeat failures from this source are muted for up to 6 hours.</p>
</div>`
    const result = await sendEmail(ALERT_EMAIL, subject, html)
    return { alerted: result.sent, deduped: false }
  } catch {
    return { alerted: false, deduped: false }
  }
}
