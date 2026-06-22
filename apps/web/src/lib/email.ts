// Provider-agnostic transactional email sender. Prefers HostGator/cPanel SMTP
// (free, domain already DKIM/DMARC-authenticated), then SendGrid, then Resend.
// FROM must use a domain authenticated with whichever provider is configured.

const DEFAULT_FROM = process.env.SALES_FROM_EMAIL || 'CityBeat <hello@citybeatmag.co>'

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
  })
  return smtpTransport
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  from: string = DEFAULT_FROM
): Promise<{ sent: boolean; error?: string }> {
  const smtp = await getSmtpTransport()
  if (smtp) {
    try {
      await smtp.sendMail({ from, to, subject, html })
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
        headers: { Authorization: `Bearer ${sg}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: parsed,
          subject,
          content: [{ type: 'text/html', value: html }],
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
        headers: { Authorization: `Bearer ${resend}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, subject, html }),
      })
      if (!res.ok) return { sent: false, error: `resend_${res.status}` }
      return { sent: true }
    } catch (e: any) {
      return { sent: false, error: e?.message || 'send_failed' }
    }
  }

  return { sent: false, error: 'no_email_provider_key' }
}
