import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MODEL = process.env.CHAT_MODEL || 'claude-haiku-4-5-20251001'

const SYSTEM = `You are the CityBeat sales & support assistant for citybeatmag.co — a bilingual (English/Spanish) local news magazine and business directory for El Paso, Texas and Ciudad Juárez, Mexico.

Reply in the user's language (English or Spanish). Be concise, warm, and helpful. Your goal is to help local businesses and readers, and to convert business owners into paying customers.

What CityBeat offers:
- FREE business directory listing — any local business can claim theirs at /directory (search their name, then "Claim").
- PREMIUM directory listing — $19/month: adds photos, business hours, social links, and featured placement in front of thousands of local readers.
- Advertising & sponsored posts — point them to /ads to start a campaign.
- Submit a story / contribute — /contribute.

Rules:
- Only state the $19/month premium price; do not invent other prices. For ad campaign pricing, tell them to visit /ads.
- When a business owner is interested, give them the direct next step and link (e.g., "Search for your business at /directory and click Claim", or "Start at /ads").
- If asked something unrelated to CityBeat, gently steer back. Keep replies under ~120 words.`

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : []
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : null

  const userMsgs = messages.filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
  if (userMsgs.length === 0) {
    return NextResponse.json({ error: 'No messages' }, { status: 400 })
  }

  const key = process.env.ANTHROPIC_API_KEY
  let reply: string

  if (!key) {
    // Graceful fallback when no LLM key is configured.
    reply =
      "Thanks for reaching out! You can claim your free business listing at /directory (search your name, then Claim), upgrade to Premium for $19/month, or start an ad campaign at /ads. How can I help?"
  } else {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 400,
          system: SYSTEM,
          messages: userMsgs.map((m: any) => ({ role: m.role, content: m.content })),
        }),
      })
      if (!res.ok) throw new Error(`anthropic_${res.status}`)
      const data: any = await res.json()
      reply = data?.content?.[0]?.text || 'Sorry, I had trouble responding — try /ads or /directory.'
    } catch (e) {
      reply = 'Sorry, I had a hiccup. You can claim a listing at /directory or advertise at /ads.'
    }
  }

  // Log the session for lead follow-up (best-effort).
  try {
    const lastUser = [...userMsgs].reverse().find((m: any) => m.role === 'user')
    await adminDb.collection('chat_sessions').add({
      session_id: sessionId,
      last_user_message: lastUser?.content?.slice(0, 500) || null,
      reply: reply.slice(0, 500),
      created_at: FieldValue.serverTimestamp(),
    })
  } catch {
    /* ignore */
  }

  return NextResponse.json({ reply })
}
