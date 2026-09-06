// Provider-agnostic transactional email sender. Prefers HostGator/cPanel SMTP
// (free, domain already DKIM/DMARC-authenticated), then SendGrid, then Resend.
// FROM must use a domain authenticated with whichever provider is configured.

const DEFAULT_FROM = process.env.SALES_FROM_EMAIL || 'CityBeat <hello@citybeatmag.co>'

// Every send is hard-bounded. This function is awaited from inside the Stripe
// webhook, where Stripe gives us ~30s before it calls the delivery a failure and
// retries. An SMTP socket with no timeout blocks for the OS default (minutes),
// so a slow mail host used to be able to stall fulfilment of a real payment.
// Email is a notification; it must never be able to hold a payment open.
const SEND_TIMEOUT_MS = Number(process.env.EMAIL_TIMEOUT_MS) || 10_000

function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}_timeout_${ms}ms`)), ms)
    work.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      }
    )
  })
}

function parseFrom(from: string): { email: string; name?: string } {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/)
  return m ? { name: m[1] || undefined, email: m[2] } : { email: from.trim() }
}

let smtpTransport: any = null
async function getSmtpTransport() {
  if (smtpTransport) return smtpTransport
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) return null
  // @ts-ignore - nodemailer types are optional
  const nodemailer: any = (await import('nodemailer')).default
  const port = Number(process.env.SMTP_PORT) || 465
  smtpTransport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    // Without these nodemailer inherits the OS socket timeout (minutes).
    connectionTimeout: SEND_TIMEOUT_MS,
    greetingTimeout: SEND_TIMEOUT_MS,
    socketTimeout: SEND_TIMEOUT_MS,
  })
  return smtpTransport
}

/**
 * Extra RFC 5322 headers to put on the message.
 *
 * This existed for no caller until List-Unsubscribe: the sender had no way to
 * set a header at all, so the RFC 8058 one-click POST endpoint the codebase
 * already exposes was unreachable from every marketing email, and the Gmail /
 * Yahoo bulk-sender rules (one-click unsubscribe honored within two days) could
 * not be met no matter what the message body said.
 *
 * Headers are passed to whichever provider actually sends, because a header
 * silently dropped on the fallback path would leave the caller believing it had
 * shipped a compliant message.
 */
export type EmailHeaders = Record<string, string>

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  from: string = DEFAULT_FROM,
  opts: { headers?: EmailHeaders } = {}
): Promise<{ sent: boolean; error?: string }> {
  const headers = opts.headers && Object.keys(opts.headers).length ? opts.headers : undefined
  // A failure to *build* the transport falls through to the next provider; a
  // failure to *send* over a configured SMTP host does not, because that host is
  // the domain-authenticated sender and silently rerouting would hurt delivery.
  let smtp: any = null
  try {
    smtp = await withTimeout(getSmtpTransport(), SEND_TIMEOUT_MS, 'smtp_connect')
  } catch {
    smtp = null
  }
  if (smtp) {
    try {
      await withTimeout(smtp.sendMail({ from, to, subject, html, ...(headers ? { headers } : {}) }), SEND_TIMEOUT_MS, 'smtp')
      return { sent: true }
    } catch (e: any) {
      return { sent: false, error: e?.message || 'smtp_failed' }
    }
  }

  const sg = process.env.SENDGRID_API_KEY
  if (sg) {
    try {
      const parsed = parseFrom(from)
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        headers: { Authorization: `Bearer ${sg}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: parsed,
          subject,
          content: [{ type: 'text/html', value: html }],
          ...(headers ? { headers } : {}),
        }),
      })
      if (res.status === 202) return { sent: true }
      return { sent: false, error: `sendgrid_${res.status}` }
    } catch (e: any) {
      return { sent: false, error: e?.message || 'send_failed' }
    }
  }

  const resend = process.env.RESEND_API_KEY
  if (resend) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        headers: { Authorization: `Bearer ${resend}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, subject, html, ...(headers ? { headers } : {}) }),
      })
      if (!res.ok) return { sent: false, error: `resend_${res.status}` }
      return { sent: true }
    } catch (e: any) {
      return { sent: false, error: e?.message || 'send_failed' }
    }
  }

  return { sent: false, error: 'no_email_provider_key' }
}
