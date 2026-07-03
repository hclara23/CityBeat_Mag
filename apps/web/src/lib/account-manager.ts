import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { sendEmail } from './email'

// The AI account manager: every paying (premium/featured) listing gets weekly
// marketing work product — a suggested deal, social captions, and drafted
// replies to unanswered reviews — written by Claude, saved as DRAFTS in
// `ai_workproduct`, and approved one-click by the owner in their dashboard.
// Nothing publishes without the owner's click. Key-gated on ANTHROPIC_API_KEY.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'
const MODEL = process.env.CHAT_MODEL || 'claude-haiku-4-5-20251001'
const CADENCE_MS = 6 * 86400000 // roughly weekly; the cron runs Wednesdays

type WorkProduct = {
  deal: { title: string; description: string } | null
  captions: string[]
  review_replies: { review_id: string; reply: string }[]
}

async function generateWorkProduct(listing: any, reviews: { id: string; rating: number; comment: string }[], locale: 'en' | 'es'): Promise<WorkProduct | null> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return null

  const lang = locale === 'es' ? 'Spanish' : 'English'
  const prompt = `You are the marketing assistant for a local business in the El Paso / Ciudad Juárez area.

Business: ${listing.name} (${listing.category || 'local business'})${listing.address ? `, ${listing.address}` : ''}

Unanswered customer reviews (reply warmly and specifically as the owner, 1-2 sentences each, no discounts promised):
${reviews.length ? reviews.map((r) => `- [id:${r.id}] ${r.rating}/5: "${r.comment.slice(0, 300)}"`).join('\n') : '(none)'}

Produce marketing work in ${lang}. Respond with ONLY valid JSON, no markdown fences:
{
  "deal": { "title": "<catchy weekly special, max 60 chars>", "description": "<1-2 sentences, max 200 chars>" },
  "captions": ["<3 short social captions for this business, each under 200 chars, local voice, no hashtag spam (max 2 hashtags each)>"],
  "review_replies": [{ "review_id": "<id>", "reply": "<the reply>" }]
}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 900, messages: [{ role: 'user', content: prompt }] }),
    })
    if (!res.ok) return null
    const data: any = await res.json()
    const text: string = data?.content?.[0]?.text || ''
    const parsed = JSON.parse(text.replace(/^```(json)?|```$/g, '').trim())
    const validIds = new Set(reviews.map((r) => r.id))
    return {
      deal:
        parsed?.deal?.title && typeof parsed.deal.title === 'string'
          ? { title: String(parsed.deal.title).slice(0, 120), description: String(parsed.deal.description || '').slice(0, 500) }
          : null,
      captions: Array.isArray(parsed?.captions) ? parsed.captions.slice(0, 3).map((c: any) => String(c).slice(0, 300)) : [],
      review_replies: Array.isArray(parsed?.review_replies)
        ? parsed.review_replies
            .filter((r: any) => validIds.has(String(r?.review_id)) && typeof r?.reply === 'string')
            .map((r: any) => ({ review_id: String(r.review_id), reply: String(r.reply).slice(0, 600) }))
        : [],
    }
  } catch {
    return null
  }
}

export async function runAccountManager(opts: { limit?: number; dryRun?: boolean } = {}) {
  const limit = Math.max(1, Math.min(opts.limit ?? 20, 50))
  const stats = { eligible: 0, generated: 0, emailed: 0, skipped_recent: 0, skipped_no_key: 0, dryRun: Boolean(opts.dryRun) }
  if (!process.env.ANTHROPIC_API_KEY) {
    stats.skipped_no_key = 1
    return stats
  }

  const snap = await adminDb
    .collection('directory_listings')
    .where('claim_status', '==', 'approved')
    .where('tier', 'in', ['premium', 'featured'])
    .limit(200)
    .get()
    .catch(() => ({ docs: [] as any[] }))

  for (const doc of snap.docs as any[]) {
    if (stats.generated >= limit) break
    const l = doc.data()
    if (!l.owner_id) continue
    stats.eligible++

    // Weekly cadence per listing. (equality+orderBy would need a composite
    // index — a listing has few workproduct docs, so max() in memory instead.)
    const recent = await adminDb
      .collection('ai_workproduct')
      .where('listing_id', '==', doc.id)
      .get()
      .catch(() => ({ docs: [] as any[] }))
    const lastAt = Math.max(0, ...(recent.docs as any[]).map((d) => (d.data() as any).created_at?.toDate?.()?.getTime() || 0))
    if (lastAt && Date.now() - lastAt < CADENCE_MS) {
      stats.skipped_recent++
      continue
    }

    // Unanswered reviews for this listing.
    const revSnap = await adminDb.collection('directory_reviews').where('listing_id', '==', doc.id).get().catch(() => ({ docs: [] as any[] }))
    const reviews = (revSnap.docs as any[])
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((r) => !r.owner_response)
      .slice(0, 5)
      .map((r) => ({ id: r.id, rating: Number(r.rating) || 0, comment: String(r.comment || '') }))

    const ownerDoc = await adminDb.collection('profiles').doc(l.owner_id).get().catch(() => null)
    const owner = ownerDoc?.exists ? (ownerDoc.data() as any) : null
    const locale: 'en' | 'es' = owner?.locale === 'es' ? 'es' : 'en'

    const work = await generateWorkProduct(l, reviews, locale)
    if (!work || (!work.deal && work.captions.length === 0 && work.review_replies.length === 0)) continue

    if (!opts.dryRun) {
      await adminDb.collection('ai_workproduct').add({
        listing_id: doc.id,
        owner_id: l.owner_id,
        business_name: l.name || null,
        status: 'draft',
        deal: work.deal,
        captions: work.captions,
        review_replies: work.review_replies,
        created_at: FieldValue.serverTimestamp(),
      })
    }
    stats.generated++

    const email = owner?.email
    if (email && !opts.dryRun) {
      const isEs = locale === 'es'
      const items = [
        work.deal ? (isEs ? 'una oferta semanal lista para publicar' : 'a weekly deal ready to publish') : null,
        work.captions.length ? (isEs ? `${work.captions.length} publicaciones para redes` : `${work.captions.length} social posts`) : null,
        work.review_replies.length ? (isEs ? `${work.review_replies.length} respuestas a reseñas` : `${work.review_replies.length} review replies`) : null,
      ].filter(Boolean)
      const html = `<div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-weight:900">CityBeat</h2>
  <p>${isEs ? `Tu asistente de marketing preparó esta semana para <strong>${l.name}</strong>:` : `Your marketing assistant prepared this week for <strong>${l.name}</strong>:`}</p>
  <ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>
  <p>${isEs ? 'Nada se publica sin tu aprobación — revísalo con un clic.' : 'Nothing publishes without your approval — review it in one click.'}</p>
  <p style="margin:24px 0"><a href="${APP_URL}/${locale}/dashboard" style="background:#22d3ee;color:#000;font-weight:800;padding:12px 22px;border-radius:8px;text-decoration:none;text-transform:uppercase;letter-spacing:1px">${isEs ? 'Revisar y aprobar' : 'Review & approve'}</a></p>
</div>`
      const r = await sendEmail(email, isEs ? `Tu marketing de esta semana está listo — ${l.name}` : `Your marketing for this week is ready — ${l.name}`, html)
      if (r.sent) stats.emailed++
    }
  }

  return stats
}
