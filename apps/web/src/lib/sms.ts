import { fetchWithTimeout, FETCH_TIMEOUT_FAST } from './http'
// Optional SMS sender (Twilio). Dormant until TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
// and TWILIO_FROM are set on the service — so features can call it and simply get
// {sent:false} when texting isn't configured yet.

/**
 * Appended to every outbound message. Carriers check that a campaign's traffic
 * carries an opt-out disclosure, and the A2P 10DLC sample messages registered
 * with them must match what we actually send — so this lives in one constant
 * rather than in each template, where it would drift out of agreement with the
 * registration and quietly invalidate it.
 *
 * Keep it identical to the sample messages filed on the campaign.
 */
export const SMS_COMPLIANCE_SUFFIX = ' Reply STOP to opt out, HELP for help. Msg&data rates may apply.'

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
/**
 * Area codes in Chihuahua, across the bridge from El Paso. A bare ten-digit
 * number beginning with one of these, stored in THIS directory, is a Mexican
 * number that lost its +52 — not a NANP number.
 *
 * Measured against a 5,000-listing page of the live collection: 98 stored phones
 * are bare ten-digit numbers with a Chihuahua area code — 96 on 656 (Ciudad
 * Juárez) and 2 on 614 — and the earlier version of this function accepted every
 * one of them and rewrote it as '+1'. '656 687 8727' became '+16566878727',
 * which is a real, reachable US number belonging to a stranger. The ownership
 * verification code for a Juárez business would have gone to them.
 *
 * The listing's own address cannot be used to decide this: those same rows store
 * 'El Paso, TX' as their address while carrying a Juárez phone, and `state` and
 * `country` are empty on every row in the collection. The area code is the only
 * honest signal available.
 *
 * Several of these are also assigned in the NANP (614 is Columbus, Ohio; 656 is a
 * Florida overlay), so this refuses a genuine US number in those area codes. That
 * trade is deliberate and one-sided: this is a directory of El Paso County and
 * Doña Ana County, where real local numbers are 915, 575 and 505. The cost of a
 * rare false refusal is that one owner verifies by email instead. The cost of the
 * alternative is texting an ownership code, or a rep's Stripe payment link, to
 * someone who never asked for it.
 *
 * A number stored WITH an explicit country code is unaffected either way: '+52...'
 * is honoured as Mexican, and '+1 656...' is honoured as the US number whoever
 * stored it said it was.
 */
const CHIHUAHUA_AREA_CODES = new Set([
  '614', '621', '625', '627', '628', '629', '635', '636', '639', '648', '649', '652', '656', '659',
])

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
  // A bare national number carrying a Chihuahua area code is a Mexican number
  // that lost its +52. Refuse it rather than dial a stranger in the NANP. An
  // explicit country code was handled above and is always honoured.
  if (!hadPlus && CHIHUAHUA_AREA_CODES.has(national.slice(0, 3))) return null
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
    // Applied here rather than per-template: a caller that forgot it would send
    // traffic that does not match the registered campaign. Appended only when the
    // body does not already carry it, so a bilingual template that states its own
    // opt-out is not given two.
    const trimmed = body.trim()
    const withNotice = /reply stop|responda stop/i.test(trimmed)
      ? trimmed
      : trimmed + SMS_COMPLIANCE_SUFFIX
    const params = new URLSearchParams({ From: sender, To: dest, Body: withNotice.slice(0, 480) })
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
