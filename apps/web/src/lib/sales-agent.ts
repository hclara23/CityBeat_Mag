import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { sendEmail as sendEmailViaProvider } from './email'

// Automated outbound sales agent: contacts unclaimed directory businesses and
// pitches the free claim + $19/mo Premium upgrade, with a one-click deep link
// into the existing claim → Stripe flow. Tracks everything in `sales_outreach`.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'
const FROM = process.env.SALES_FROM_EMAIL || 'CityBeat <hello@citybeatmag.co>'
const FOLLOWUP_DAYS = [0, 4, 9] // drip schedule: initial, +4d, +9d
const MAX_STEPS = FOLLOWUP_DAYS.length

export type OutreachStep = 0 | 1 | 2

type Listing = {
  id: string
  name?: string
  category?: string
  email?: string
  phone?: string
  address?: string
  claim_status?: string
}

function claimUrl(listingId: string, outreachId: string, locale = 'en') {
  return `${APP_URL}/api/track/click?o=${outreachId}&to=${encodeURIComponent(`/${locale}/directory/${listingId}/claim`)}`
}

function openPixel(outreachId: string) {
  return `${APP_URL}/api/track/open?o=${outreachId}`
}

// Template pitch (bilingual). Used as-is, or as the brief for Claude enhancement.
function templatePitch(listing: Listing, step: number, locale: 'en' | 'es') {
  const name = listing.name || (locale === 'es' ? 'tu negocio' : 'your business')
  const cat = listing.category ? ` (${listing.category})` : ''
  if (locale === 'es') {
    const subjects = [
      `${name} ya aparece en CityBeat — reclámalo gratis`,
      `¿Sigues interesado en ${name} en CityBeat?`,
      `Última oportunidad: destaca ${name} en CityBeat`,
    ]
    return {
      subject: subjects[step] || subjects[0],
      intro: `Hola, vimos que ${name}${cat} aparece en el directorio de CityBeat, el medio bilingue de El Paso y Ciudad Juárez.`,
      pitch: `Reclámalo gratis y mejora a Premium por $19/mes para añadir fotos, horarios, enlaces a redes y aparecer destacado ante miles de lectores locales.`,
    }
  }
  const subjects = [
    `${name} is listed on CityBeat — claim it free`,
    `Still want to grow ${name} with CityBeat?`,
    `Last call: feature ${name} on CityBeat`,
  ]
  return {
    subject: subjects[step] || subjects[0],
    intro: `Hi — we noticed ${name}${cat} is listed in the CityBeat directory, El Paso & Ciudad Juárez's bilingual local guide.`,
    pitch: `Claim it free, and upgrade to Premium for $19/mo to add photos, hours, social links, and get featured in front of thousands of local readers.`,
  }
}

async function enhanceWithClaude(listing: Listing, base: ReturnType<typeof templatePitch>, locale: string) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return base
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: `Write a short, warm ${locale === 'es' ? 'Spanish' : 'English'} sales email body (2 short paragraphs, no subject line, no signature) to a local business owner. Business: ${listing.name} ${listing.category ? `(${listing.category})` : ''}. Goal: get them to claim their free CityBeat directory listing and upgrade to Premium ($19/mo for photos, hours, social links, featured placement). Keep it under 90 words, friendly, specific to a local El Paso / Ciudad Juarez audience. Do not include a greeting or links.`,
          },
        ],
      }),
    })
    if (!res.ok) return base
    const data: any = await res.json()
    const text = data?.content?.[0]?.text
    if (typeof text === 'string' && text.trim()) {
      return { ...base, pitch: text.trim() }
    }
  } catch {
    /* fall back to template */
  }
  return base
}

const ADDRESS = process.env.SALES_PHYSICAL_ADDRESS || 'CityBeat Media Group, El Paso, TX, USA'

function unsubUrl(outreachId: string) {
  return `${APP_URL}/api/track/unsub?o=${outreachId}`
}

function renderHtml(listing: Listing, content: ReturnType<typeof templatePitch>, outreachId: string, locale: 'en' | 'es') {
  const cta = locale === 'es' ? 'Reclamar mi negocio' : 'Claim my business'
  const unsub = locale === 'es' ? 'Cancelar suscripción' : 'Unsubscribe'
  const why =
    locale === 'es'
      ? 'Recibes esto porque tu negocio aparece en el directorio público de CityBeat.'
      : 'You received this because your business is listed in the public CityBeat directory.'
  return `<div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-weight:900">CityBeat</h2>
  <p>${content.intro}</p>
  <p>${content.pitch}</p>
  <p style="margin:28px 0"><a href="${claimUrl(listing.id, outreachId, locale)}" style="background:#22d3ee;color:#000;font-weight:800;padding:12px 22px;border-radius:8px;text-decoration:none;text-transform:uppercase;letter-spacing:1px">${cta}</a></p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
  <p style="font-size:11px;color:#999;line-height:1.5">
    ${why}<br/>
    ${ADDRESS}<br/>
    <a href="${unsubUrl(outreachId)}" style="color:#999">${unsub}</a> ·
    <a href="${APP_URL}/${locale}/directory/${listing.id}" style="color:#999">${locale === 'es' ? 'Ver mi ficha' : 'View your listing'}</a>
  </p>
  <img src="${openPixel(outreachId)}" width="1" height="1" alt="" style="display:none" />
</div>`
}

// Uses the shared provider-agnostic sender (SMTP → SendGrid → Resend).
function sendEmail(to: string, subject: string, html: string) {
  return sendEmailViaProvider(to, subject, html, FROM)
}

// Sends a sample outreach email to a given address to verify the email channel.
export async function sendTestEmail(to: string, locale: 'en' | 'es' = 'en') {
  const listing: Listing = { id: 'sample', name: 'Your Business', category: 'restaurant', email: to }
  const content = templatePitch(listing, 0, locale)
  const html = renderHtml(listing, content, 'sample-test', locale)
  return sendEmail(to, `[Test] ${content.subject}`, html)
}

// ─── Upsell: pitch Featured to owners already on Premium ─────────────────────
function upsellPitch(listing: Listing, locale: 'en' | 'es') {
  const name = listing.name || (locale === 'es' ? 'tu negocio' : 'your business')
  if (locale === 'es') {
    return {
      subject: `Destaca ${name} en la cima de CityBeat`,
      intro: `Hola, ${name} ya tiene una ficha Premium en CityBeat — ¡gracias!`,
      pitch: `Mejora a Destacado ($49/mes) para aparecer en la parte superior de tu categoría, con insignia destacada y rotación en la página principal ante miles de lectores locales.`,
    }
  }
  return {
    subject: `Put ${name} at the top of CityBeat`,
    intro: `Hi — ${name} already has a Premium listing on CityBeat. Thank you!`,
    pitch: `Upgrade to Featured ($49/mo) for top-of-category placement, a Featured badge, and homepage rotation in front of thousands of local readers.`,
  }
}

function renderUpsellHtml(listing: Listing, content: ReturnType<typeof upsellPitch>, outreachId: string, locale: 'en' | 'es') {
  const cta = locale === 'es' ? 'Mejorar a Destacado' : 'Upgrade to Featured'
  const url = `${APP_URL}/api/track/click?o=${outreachId}&to=${encodeURIComponent(`/${locale}/directory/${listing.id}/claim?plan=featured_monthly`)}`
  return `<div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-weight:900">CityBeat</h2>
  <p>${content.intro}</p>
  <p>${content.pitch}</p>
  <p style="margin:28px 0"><a href="${url}" style="background:#eab308;color:#000;font-weight:800;padding:12px 22px;border-radius:8px;text-decoration:none;text-transform:uppercase;letter-spacing:1px">${cta}</a></p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
  <p style="font-size:11px;color:#999;line-height:1.5">${ADDRESS}<br/><a href="${unsubUrl(outreachId)}" style="color:#999">${locale === 'es' ? 'Cancelar' : 'Unsubscribe'}</a></p>
  <img src="${openPixel(outreachId)}" width="1" height="1" alt="" style="display:none" />
</div>`
}

// Emails owners of approved Premium listings to upsell Featured. One-and-done per
// listing (tracked in `upsell_outreach`); dryRun renders without sending.
export async function runUpsellOutreach(opts: { limit?: number; dryRun?: boolean; locale?: 'en' | 'es' } = {}) {
  const limit = Math.max(1, Math.min(opts.limit ?? 25, 100))
  const locale = opts.locale ?? 'en'
  const results = { contacted: 0, skipped_no_email: 0, skipped_already: 0, sent: 0, dryRun: Boolean(opts.dryRun) }

  const snap = await adminDb
    .collection('directory_listings')
    .where('claim_status', '==', 'approved')
    .where('tier', '==', 'premium')
    .limit(limit * 4)
    .get()

  for (const lDoc of snap.docs) {
    if (results.contacted >= limit) break
    const l = { id: lDoc.id, ...(lDoc.data() as any) } as Listing & { contact_email?: string }
    const email = (l as any).contact_email || l.email
    if (!email) { results.skipped_no_email++; continue }
    const already = await adminDb.collection('upsell_outreach').where('listing_id', '==', l.id).limit(1).get()
    if (!already.empty) { results.skipped_already++; continue }

    const ref = adminDb.collection('upsell_outreach').doc()
    const content = upsellPitch(l, locale)
    const html = renderUpsellHtml(l, content, ref.id, locale)
    let sent = false
    if (!opts.dryRun) { const r = await sendEmail(email, content.subject, html); sent = r.sent }
    await ref.set({
      listing_id: l.id, business_name: l.name || null, email, locale,
      status: sent ? 'sent' : opts.dryRun ? 'dry_run' : 'send_failed',
      opens: 0, clicks: 0, created_at: FieldValue.serverTimestamp(), last_sent_at: FieldValue.serverTimestamp(),
    })
    results.contacted++
    if (sent) results.sent++
  }
  return results
}

// Run one outreach batch: new unclaimed businesses with an email, who have not
// been contacted, plus due follow-ups. dryRun renders+logs without sending.
export async function runSalesOutreach(opts: { limit?: number; dryRun?: boolean; locale?: 'en' | 'es' } = {}) {
  const limit = Math.max(1, Math.min(opts.limit ?? 25, 100))
  const locale = opts.locale ?? 'en'
  const results = { contacted: 0, followups: 0, skipped_no_email: 0, skipped_already: 0, sent: 0, dryRun: Boolean(opts.dryRun) }

  // 1) Due follow-ups first.
  const dueSnap = await adminDb
    .collection('sales_outreach')
    .where('status', 'in', ['sent', 'opened', 'clicked'])
    .get()
    .catch(() => ({ docs: [] as any[] }))
  const now = Date.now()
  for (const doc of dueSnap.docs as any[]) {
    if (results.followups >= limit) break
    const o = doc.data()
    const step = (o.step ?? 0) + 1
    if (step >= MAX_STEPS) continue
    const lastAt = o.last_sent_at?.toDate ? o.last_sent_at.toDate().getTime() : Date.parse(o.last_sent_at || 0)
    if (!lastAt || now - lastAt < FOLLOWUP_DAYS[step] * 86400000 - FOLLOWUP_DAYS[(o.step ?? 0)] * 86400000) {
      // not yet due relative to schedule
      if (now - lastAt < (FOLLOWUP_DAYS[step] - FOLLOWUP_DAYS[o.step ?? 0]) * 86400000) continue
    }
    // skip if the listing already converted
    const lDoc = await adminDb.collection('directory_listings').doc(o.listing_id).get()
    if (lDoc.exists && (lDoc.data() as any).claim_status !== 'unclaimed') {
      await doc.ref.set({ status: 'converted', converted_at: FieldValue.serverTimestamp() }, { merge: true })
      continue
    }
    const listing: Listing = { id: o.listing_id, name: o.business_name, category: o.category, email: o.email }
    const base = templatePitch(listing, step, locale)
    const content = await enhanceWithClaude(listing, base, locale)
    const html = renderHtml(listing, content, doc.id, locale)
    let sent = false
    if (!opts.dryRun) {
      const r = await sendEmail(o.email, content.subject, html)
      sent = r.sent
    }
    await doc.ref.set(
      { step, status: sent || opts.dryRun ? 'sent' : 'send_failed', last_sent_at: FieldValue.serverTimestamp() },
      { merge: true }
    )
    results.followups++
    if (sent) results.sent++
  }

  // 2) New contacts: unclaimed listings with an email, not yet in sales_outreach.
  const listingsSnap = await adminDb
    .collection('directory_listings')
    .where('claim_status', '==', 'unclaimed')
    .limit(limit * 4)
    .get()

  for (const lDoc of listingsSnap.docs) {
    if (results.contacted >= limit) break
    const l = { id: lDoc.id, ...(lDoc.data() as any) } as Listing
    if (!l.email) {
      results.skipped_no_email++
      continue
    }
    const already = await adminDb.collection('sales_outreach').where('listing_id', '==', l.id).limit(1).get()
    if (!already.empty) {
      results.skipped_already++
      continue
    }
    const ref = adminDb.collection('sales_outreach').doc()
    const base = templatePitch(l, 0, locale)
    const content = await enhanceWithClaude(l, base, locale)
    const html = renderHtml(l, content, ref.id, locale)
    let sent = false
    if (!opts.dryRun) {
      const r = await sendEmail(l.email, content.subject, html)
      sent = r.sent
    }
    await ref.set({
      listing_id: l.id,
      business_name: l.name || null,
      category: l.category || null,
      email: l.email,
      locale,
      step: 0,
      status: sent ? 'sent' : opts.dryRun ? 'dry_run' : 'send_failed',
      opens: 0,
      clicks: 0,
      created_at: FieldValue.serverTimestamp(),
      last_sent_at: FieldValue.serverTimestamp(),
    })
    results.contacted++
    if (sent) results.sent++
  }

  return results
}
