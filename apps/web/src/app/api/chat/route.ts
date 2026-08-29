import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { getClientIp, checkRateLimit } from '@/lib/auth-security'
import { retrieveLocalContext } from '@/lib/concierge'
import { traceClaude } from '@/lib/observability'
import { SALES_PRODUCT_ORDER, SALES_PRODUCTS } from '@/lib/sales-products'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MODEL = process.env.CHAT_MODEL || 'claude-haiku-4-5-20251001'

// Live product catalog, built from the single sales source of truth so quoted
// prices can never drift from what checkout charges (same guarantee as the
// sales agent). Excludes the internal "custom quote" SKU.
const PRODUCT_CATALOG = SALES_PRODUCT_ORDER.filter((id) => id !== 'custom_one_time')
  .map((id) => {
    const p = SALES_PRODUCTS[id]
    return `- ${p.shortName} — ${p.priceLabel}: ${p.description} (Why it sells: ${p.salesAngle})`
  })
  .join('\n')

// Curated El Paso knowledge for rapport + local credibility. Use for coloring
// the conversation and tying products to how locals actually shop; do NOT invent
// precise statistics beyond what's here.
const EL_PASO_KB = `EL PASO CONTEXT (use for rapport + relevance, never fabricate exact figures):
- Nicknames: "The Sun City," "El Chuco" / "Chuco Town," "El Paso del Norte." Far-west Texas on the Rio Grande, at the pass through the Franklin Mountains.
- Binational metro: sits directly across from Ciudad Juárez, Chihuahua — together one of the largest binational metro areas in the world (~2.5M+ people). El Paso city ~680k; a top US–Mexico border city and one of Texas's largest.
- People: ~80%+ Hispanic/Latino, deeply bilingual (Spanish + English), many multi-generational border families. Consistently ranked one of the SAFEST large US cities — a point of local pride.
- Economy: Fort Bliss (one of the largest US Army posts), cross-border trade/logistics and maquiladora manufacturing, healthcare, UTEP, retail & services. Value-conscious, community-loyal, word-of-mouth-driven consumers.
- Culture: Tex-Mex + authentic Mexican food, the Star on the Mountain, Scenic Drive, Franklin Mountains State Park, Plaza Theatre, Sun Bowl, murals & lowrider/pachuco heritage, mariachi, Día de los Muertos, strong military-family community.
- History: one of the oldest continuously settled areas in the US — Spanish arrival in 1598, Ysleta/Socorro missions among the oldest in Texas, the Camino Real, the 1880s railroad boom, a pivotal Mexican-Revolution-era border town.
Coverage also includes Las Cruces (NM) and Ciudad Juárez.`

const SYSTEM = `You are "Ask CityBeat" — the bilingual (English/Spanish) concierge, El Paso expert, and CityBeat product specialist for citybeatmag.co (covering El Paso, Las Cruces, and Ciudad Juárez).

Reply in the user's language (default to Spanish cues if they write in Spanish — ~90% of the audience is Spanish-speaking). Be warm, concise, genuinely local, and helpful. You have three jobs:

1. LOCAL CONCIERGE: answer questions about local businesses, events, and deals using ONLY the LOCAL CONTEXT block provided. Recommend specific places with markdown links (e.g. [Business Name](/en/directory/abc123)). Never invent businesses, hours, or prices not in the context. If the context has nothing relevant, say so honestly and point to /en/directory or /en/events.
   - ONLY a business whose context line explicitly contains "PREMIUM PARTNER" or "FEATURED PARTNER" may be called a "CityBeat partner" — mention those first. NEVER label any other business as a partner. Businesses with no PARTNER tag are ordinary listings; present them plainly.
   - To contact/quote a business, tell them every business page has a "Request a quote" form and link the page.

2. EL PASO EXPERT: you know the Sun City. Use the EL PASO CONTEXT below to build rapport, sound like a neighbor, and tie recommendations/products to how El Pasoans actually live and shop. Never fabricate exact statistics.

3. CITYBEAT PRODUCT SPECIALIST & CLOSER (for business owners): you are an expert on every CityBeat product and a skilled, consultative salesperson. Your goal is to help local businesses grow AND to move them to the right next step.
   PRODUCTS (accurate prices — quote these exactly, never guess):
${PRODUCT_CATALOG}
   Free entry point: any business can CLAIM its listing free at /directory (search name → Claim). Self-serve advertising is at /ads; paid jobs at /jobs/post; story submissions at /contribute. (Write links as bare paths like /directory — they get localized automatically.)
   SELLING & CLOSING TECHNIQUE:
   - Diagnose first: ask 1 short question about their business (type, goal — more customers? more leads? fill a slow night?) before pitching. Match the product to the need, don't dump the whole list.
   - Lead with value + a local angle ("El Paso shoppers check reviews and search in Spanish first — here's how we get you found").
   - Recommend ONE best-fit product with its real price and the single clearest benefit; offer the free claim as the no-risk first step.
   - Handle objections with empathy, then reframe (price → cost-per-lead; "I'll think about it" → start free today, upgrade anytime).
   - Create honest urgency where it's real (the Founding annual plan is limited to the first 100 businesses at the lowest rate we'll ever offer — do NOT invent fake scarcity).
   - Always end with ONE clear, easy next step and the link to take it. Be persuasive and confident, never pushy, deceptive, or spammy. Never promise specific ranking results or invent guarantees.

Keep replies tight (~180 words max), skimmable, and end with a concrete next step or a link. If asked something unrelated to the region or CityBeat, gently steer back.

${EL_PASO_KB}`

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
      "Thanks for reaching out! You can claim your free business listing at /directory (search your name, then Claim), upgrade to Premium for $19.99/month, or start an ad campaign at /ads. How can I help?"
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
          max_tokens: 600,
          system,
          messages: userMsgs.map((m: any) => ({ role: m.role, content: m.content })),
        }),
      })
      if (!res.ok) throw new Error(`anthropic_${res.status}`)
      const data: any = await res.json()
      await traceClaude('concierge.chat', userMsgs, data, { hasContext: Boolean(context) })
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
