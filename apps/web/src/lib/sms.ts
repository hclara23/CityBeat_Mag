import { fetchWithTimeout, FETCH_TIMEOUT_FAST } from './http'
// Optional SMS sender (Twilio). Dormant until TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
// and TWILIO_FROM are set on the service — so features can call it and simply get
// {sent:false} when texting isn't configured yet.

export function smsConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM)
}

/**
 * Coerce a stored phone number into strict E.164, or return null.
 *
 * Twilio requires E.164 and does NOT infer a country code. Measured against the
 * live collection, ZERO stored phones were already in that form: 63% carry no
 * country code at all ('(915) 772-9287') and the remainder carry separators
 * ('+1 915-842-8548'). Posting either verbatim fails with Twilio error 21211,
 * which means every caller below — claim verification, the rep's payment link,
 * the unclaimed-lead relay, ops alerts — would have failed on essentially every
 * number the moment the credentials were set.
 *
 * Returns null rather than guessing when the digits cannot be a real NANP
 * number. A dropped or mistyped digit must never become a text to a stranger:
 * one live listing stores '1952611098', whose area code 195 is forbidden by the
 * NANP and is almost certainly a mistyped 915 number.
 */
export function toE164(raw: string | null | undefined): string | null {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return null
  const hadPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 15) return null // E.164 bounds

  // A number that states a non-NANP country code is taken at its word — we have
  // no dial plan for the rest of the world and must not invent one.
  if (hadPlus && !digits.startsWith('1')) return `+${digits}`

  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  // NANP: area code and exchange code both begin 2-9.
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(national)) return null
  return `+1${national}`
}

export async function sendSms(to: string, body: string): Promise<{ sent: boolean; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM
  if (!sid || !token || !from) return { sent: false, error: 'no_sms_provider' }
  const sender = toE164(from)
  if (!sender) return { sent: false, error: 'invalid_from' }
  const dest = toE164(to)
  if (!dest) return { sent: false, error: 'invalid_phone' }
  try {
    const params = new URLSearchParams({ From: sender, To: dest, Body: body.slice(0, 480) })
    const res = await fetchWithTimeout(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    }, FETCH_TIMEOUT_FAST)
    if (!res.ok) {
      // Twilio's own error code is the only thing separating "this number can't
      // receive texts" (21211, 21614) from "this account is blocked from texting
      // US numbers until A2P 10DLC registration completes" (30034) — the single
      // most likely failure on a brand-new account. Both are HTTP 400, so a bare
      // 'twilio_400' sent whoever read it nowhere.
      const detail: any = await res.json().catch(() => null)
      const code = detail && typeof detail.code === 'number' ? detail.code : null
      return { sent: false, error: code ? `twilio_${res.status}_${code}` : `twilio_${res.status}` }
    }
    return { sent: true }
  } catch (e: any) {
    return { sent: false, error: e?.message || 'sms_failed' }
  }
}
