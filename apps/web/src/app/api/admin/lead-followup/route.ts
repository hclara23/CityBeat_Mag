import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasSalesAccess } from '@citybeat/lib/roles'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { traceClaude } from '@/lib/observability'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MODEL = process.env.CHAT_MODEL || 'claude-haiku-4-5-20251001'

// Turns a warm lead (a business that opened/clicked outreach) into an actionable
// follow-up: a short personalized email + a 20-second phone script a rep can use
// right now. Sales/admin only. Needs ANTHROPIC_API_KEY (falls back to a solid
// template so the button always works).
export async function POST(request: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  if (!hasSalesAccess(profile)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const business = typeof body.business === 'string' ? body.business.slice(0, 120) : 'the business'
  const listingId = typeof body.listingId === 'string' ? body.listingId : ''
  const clicked = Boolean(body.clicked)

  // Enrich with category/city if we have the listing.
  let category = ''
  let city = ''
  if (listingId) {
    const doc = await adminDb.collection('directory_listings').doc(listingId).get().catch(() => null)
    const l = doc?.exists ? (doc.data() as any) : null
    category = l?.category || ''
    const m = (l?.address || '').match(/,\s*([^,]+),\s*(?:TX|NM)\b/i)
    city = m ? m[1].trim() : ''
  }

  const signal = clicked
    ? 'They CLICKED a link in our outreach email — strong buying signal.'
    : 'They OPENED our outreach email (some interest, though opens can be mail scanners).'

  const key = process.env.ANTHROPIC_API_KEY
  const fallback = {
    email_subject: `Quick follow-up for ${business}`,
    email_body: `Hi — I noticed you checked out the note about ${business} on CityBeat. We're the bilingual local guide for El Paso & Ciudad Juárez, and claiming your free listing takes two minutes and puts you in front of thousands of local readers. Want me to send the direct link?`,
    call_script: `Hi, this is [name] with CityBeat — the El Paso local guide. I'm calling because ${business} showed up when folks searched your category. We can get you featured and sending you customer leads. Do you have 30 seconds?`,
  }

  if (!key) return NextResponse.json({ ...fallback, ai: false })

  const prompt = `Write a warm sales follow-up for a local business that engaged with our cold outreach.

Business: ${business}${category ? ` (${category})` : ''}${city ? ` in ${city}` : ''}.
CityBeat is the bilingual local news + business directory for El Paso / Las Cruces / Ciudad Juárez. Offer: claim their free listing, then Premium ($19/mo) for photos, priority placement, and instant customer leads.
Context: ${signal}

Respond with ONLY valid JSON, no markdown fences:
{
  "email_subject": "<under 55 chars, specific to them>",
  "email_body": "<70-100 words, warm, references that they engaged, one clear ask, no pushy discounts>",
  "call_script": "<25-40 words, natural spoken opener a rep can read on the phone>"
}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
    })
    if (!res.ok) return NextResponse.json({ ...fallback, ai: false })
    const data: any = await res.json()
    await traceClaude('lead-followup', prompt, data, { business })
    const text: string = data?.content?.[0]?.text || ''
    const parsed = JSON.parse(text.replace(/^```(json)?|```$/g, '').trim())
    return NextResponse.json({
      email_subject: String(parsed.email_subject || fallback.email_subject).slice(0, 120),
      email_body: String(parsed.email_body || fallback.email_body).slice(0, 1200),
      call_script: String(parsed.call_script || fallback.call_script).slice(0, 600),
      ai: true,
    })
  } catch {
    return NextResponse.json({ ...fallback, ai: false })
  }
}
