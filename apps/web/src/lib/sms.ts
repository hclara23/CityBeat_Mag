// Optional SMS sender (Twilio). Dormant until TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
// and TWILIO_FROM are set on the service — so features can call it and simply get
// {sent:false} when texting isn't configured yet.

export function smsConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM)
}

export async function sendSms(to: string, body: string): Promise<{ sent: boolean; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM
  if (!sid || !token || !from) return { sent: false, error: 'no_sms_provider' }
  try {
    const params = new URLSearchParams({ From: from, To: to, Body: body.slice(0, 480) })
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })
    if (!res.ok) return { sent: false, error: `twilio_${res.status}` }
    return { sent: true }
  } catch (e: any) {
    return { sent: false, error: e?.message || 'sms_failed' }
  }
}
