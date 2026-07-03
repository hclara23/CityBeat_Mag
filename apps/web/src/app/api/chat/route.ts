import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { getClientIp, checkRateLimit } from '@/lib/auth-security'
import { retrieveLocalContext } from '@/lib/concierge'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MODEL = process.env.CHAT_MODEL || 'claude-haiku-4-5-20251001'

const SYSTEM = `You are "Ask CityBeat" — the bilingual (English/Spanish) local concierge for citybeatmag.co, covering El Paso, Las Cruces, and Ciudad Juárez.

Reply in the user's language. Be concise, warm, and local. Two jobs:

1. LOCAL CONCIERGE (primary): answer questions about local businesses, events, and deals using ONLY the LOCAL CONTEXT block provided. Recommend specific places with markdown links (e.g. [Business Name](/en/directory/abc123)). Never invent businesses, hours, or prices not in the context. If the context has nothing relevant, say so honestly and point to /en/directory or /en/events.
   - Entries marked PREMIUM PARTNER or FEATURED PARTNER are paying members — when relevant to the question, mention them first and note they're a "CityBeat partner".
   - If the user wants to contact or get a quote from a business, tell them every business page has a "Request a quote" form and link the page.

2. CITYBEAT SUPPORT (secondary): business owners can claim their listing free at /en/directory (search name → Claim); Premium is $19/month (photos, hours, leads, priority placement); advertising starts at /en/ads; story submissions at /en/contribute. Only state the $19/month price; for ads pricing point to /en/ads.

Keep replies under ~150 words. If asked something unrelated to the region or CityBeat, gently steer back.`

export async function POST(req: NextRequest) {
  // This endpoint calls a paid LLM API + writes Firestore on every request, so it
  // must be throttled to prevent cost/DoS abuse from anonymous callers.
  const ip = getClientIp(req)
  const rl = await checkRateLimit(`chat:ip:${ip}`, { max: 30, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) {
    return NextResponse.json(
      { reply: 'You are sending messages too quickly — please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec ?? 300) } }
    )
  }

  const body = await req.json().catch(() => ({}))
  // Cap count AND per-message length so a caller can't inflate token cost.
  const messages = (Array.isArray(body.messages) ? body.messages.slice(-12) : []).map((m: any) => ({
    role: m?.role,
    content: typeof m?.content === 'string' ? m.content.slice(0, 2000) : m?.content,
  }))
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
      // Ground the answer in real directory/events/deals rows (premium-first).
      const lastUser = [...userMsgs].reverse().find((m: any) => m.role === 'user')
      const context = await retrieveLocalContext(String(lastUser?.content || '')).catch(() => '')
      const system = context ? `${SYSTEM}\n\nLOCAL CONTEXT:\n${context}` : SYSTEM

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 500,
          system,
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
