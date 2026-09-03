import crypto from 'crypto'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { sendEmail as sendEmailViaProvider } from './email'
import { isSuppressed } from './suppression'
import { traceClaude, traceClaudeFailure } from '@/lib/observability'
import { getCronCursor, setCronCursor } from './cron-cursor'
import { DIRECTORY_PLANS } from './pricing'

// Premium price pulled from the single pricing source of truth so the outbound
// pitch can never quote a number different from what checkout actually charges
// (it previously said "$19/mo" while Premium bills $19.99/mo).
const PREMIUM_MONTHLY = `$${(DIRECTORY_PLANS.premium_monthly.unitAmount / 100).toFixed(2)}`

// Automated outbound sales agent: contacts unclaimed directory businesses and
// pitches the free claim + paid Premium upgrade (price from pricing.ts), with a one-click deep link
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
  description?: string
  description_es?: string
  hours?: Record<string, string>
}

function claimUrl(listingId: string, outreachId: string, locale = 'en') {
  return `${APP_URL}/api/track/click?o=${outreachId}&to=${encodeURIComponent(`/${locale}/directory/${listingId}/claim`)}`
}

function openPixel(outreachId: string) {
  return `${APP_URL}/api/track/open?o=${outreachId}`
}

// A/B test on the step-0 (first-touch) email — the highest-volume send.
// Deterministic per listing so webhook/cron retries reuse the same variant. The
// chosen variant is recorded on the outreach doc; opens/clicks are already
// tracked per doc, so variant performance is a simple Firestore aggregation.
//
// Variants 0-2 are subject-line spins on the standard pitch. Variants 3-4 are
// full MIRROR arms (subject + body): 3 quotes the business's own auto-translated
// Spanish description back to them ("Su Negocio Ya Habla Español" — the endowment
// play no national directory can run), 4 asks whether the scraped phone/address/
// hours are still right (honest accuracy-audit play). Both need listing data, so
// pickFirstTouchVariant downgrades to 0 when it's missing — the RECORDED variant
// always matches the copy actually sent.
export const SUBJECT_VARIANTS = 5
export function subjectVariant(listingId: string): number {
  let h = 0
  for (let i = 0; i < listingId.length; i++) h = (h * 31 + listingId.charCodeAt(i)) | 0
  return Math.abs(h) % SUBJECT_VARIANTS
}

export interface FirstTouchAssignment {
  /** The arm whose copy is actually sent. */
  variant: number
  /** The arm the hash picked, before any data-availability downgrade. */
  variant_intended: number
  /** True when the intended arm was unusable and we fell back to the control. */
  variant_downgraded: boolean
  /** Whether this listing COULD have received arm 3 (Spanish mirror). */
  had_description_es: boolean
  /** Whether this listing COULD have received arm 4 (accuracy audit). */
  had_contact_details: boolean
}

/**
 * Assign the first-touch arm AND record why.
 *
 * The mirror arms need listing data (a Spanish description for arm 3; a phone or
 * address for arm 4), so a data-poor listing cannot receive them and falls back
 * to the control. That fallback silently destroyed the experiment: arm 0 ended up
 * holding its own random share PLUS every data-poor listing rejected from arms
 * 3-4, while arms 3-4 were conditioned on rich data — so any measured "lift" was
 * really listing quality. Stamping the intent and the eligibility flags lets the
 * scoreboard compare arm 3 only against control listings that were themselves
 * arm-3-eligible, which is the comparison that actually means something.
 */
export function pickFirstTouchVariant(
  listing: Pick<Listing, 'id' | 'description_es' | 'phone' | 'address'>
): FirstTouchAssignment {
  const intended = subjectVariant(listing.id)
  const hadEs = Boolean((listing.description_es || '').trim())
  const hadContact = Boolean((listing.phone || '').trim() || (listing.address || '').trim())
  let v = intended
  if (v === 3 && !hadEs) v = 0
  if (v === 4 && !hadContact) v = 0
  return {
    variant: v,
    variant_intended: intended,
    variant_downgraded: v !== intended,
    had_description_es: hadEs,
    had_contact_details: hadContact,
  }
}

const escHtml = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Template pitch (bilingual). Used as-is, or as the brief for Claude enhancement.
// Variants 3-4 are mirror arms whose BODY is built from the listing's own data —
// they must never be handed to enhanceWithClaude (it would paraphrase away the
// exact data being mirrored). The send path skips enhancement for variant >= 3.
function templatePitch(listing: Listing, step: number, locale: 'en' | 'es', variant = 0) {
  const name = listing.name || (locale === 'es' ? 'tu negocio' : 'your business')
  const cat = listing.category ? ` (${listing.category})` : ''

  // Mirror-arm content (first touch only). Scraped/generated data is escaped —
  // it lands directly in email HTML.
  const esQuote = (listing.description_es || '').trim().slice(0, 260)
  const auditBits: string[] = []
  if ((listing.phone || '').trim()) auditBits.push(`☎ ${escHtml(String(listing.phone).trim())}`)
  if ((listing.address || '').trim()) auditBits.push(`📍 ${escHtml(String(listing.address).trim())}`)
  const firstHours = listing.hours && typeof listing.hours === 'object' ? Object.entries(listing.hours).find(([, v]) => String(v || '').trim()) : null
  if (firstHours) auditBits.push(`🕒 ${escHtml(`${firstHours[0]}: ${firstHours[1]}`)}`)
  const auditList = auditBits.join('<br/>')

  if (locale === 'es') {
    const firstTouch = [
      `${name} ya aparece en CityBeat — reclámalo gratis`,
      `¿Este es tu negocio? ${name} está en CityBeat`,
      `${name}: los clientes te buscan en CityBeat`,
      `Así aparece ${name} en español ante El Paso`,
      `¿Estos datos de ${name} siguen correctos?`,
    ]
    const subjects = [
      firstTouch[variant] || firstTouch[0],
      `¿Sigues interesado en ${name} en CityBeat?`,
      `Última oportunidad: destaca ${name} en CityBeat`,
    ]
    if (step === 0 && variant === 3 && esQuote) {
      return {
        subject: subjects[0],
        intro: `Hola — CityBeat ya presenta a ${name}${cat} EN ESPAÑOL a los lectores de El Paso y Ciudad Juárez. Así lo describimos:`,
        pitch: `<em>“${escHtml(esQuote)}”</em><br/><br/>¿Está bien escrito? <strong>Reclame su página gratis</strong> (2 minutos) para corregirlo, añadir fotos y horarios, y responder a sus clientes — en los dos idiomas.`,
      }
    }
    if (step === 0 && variant === 4 && auditList) {
      return {
        subject: subjects[0],
        intro: `Hola — miles de lectores ven la ficha de ${name}${cat} en CityBeat. Estos son los datos que mostramos hoy:`,
        pitch: `${auditList}<br/><br/>¿Siguen correctos? <strong>Confírmelos o corríjalos gratis en 2 minutos</strong> reclamando su página — un dato equivocado le cuesta clientes.`,
      }
    }
    return {
      subject: subjects[step] || subjects[0],
      intro: `Hola, vimos que ${name}${cat} aparece en el directorio de CityBeat, el medio bilingue de El Paso y Ciudad Juárez.`,
      pitch: `Reclámalo gratis y mejora a Premium por ${PREMIUM_MONTHLY}/mes para añadir fotos, horarios, enlaces a redes y aparecer destacado ante miles de lectores locales.`,
    }
  }
  const firstTouch = [
    `${name} is listed on CityBeat — claim it free`,
    `Is this your business? ${name} is on CityBeat`,
    `${name}: customers are finding you on CityBeat`,
    `${name} already speaks Spanish on CityBeat`,
    `Are these details for ${name} still right?`,
  ]
  const subjects = [
    firstTouch[variant] || firstTouch[0],
    `Still want to grow ${name} with CityBeat?`,
    `Last call: feature ${name} on CityBeat`,
  ]
  if (step === 0 && variant === 3 && esQuote) {
    return {
      subject: subjects[0],
      intro: `Hi — CityBeat already introduces ${name}${cat} IN SPANISH to El Paso's readers (80%+ of the market is bilingual). Here's how your page reads:`,
      pitch: `<em>“${escHtml(esQuote)}”</em><br/><br/>Did we get it right? <strong>Claim your page free</strong> (2 minutes) to fix the wording, add photos and hours, and answer customers — in both languages.`,
    }
  }
  if (step === 0 && variant === 4 && auditList) {
    return {
      subject: subjects[0],
      intro: `Hi — thousands of local readers see ${name}${cat} on CityBeat. Here's what we're showing them today:`,
      pitch: `${auditList}<br/><br/>Still correct? <strong>Confirm or fix it free in 2 minutes</strong> by claiming your page — one wrong detail costs you customers.`,
    }
  }
  return {
    subject: subjects[step] || subjects[0],
    intro: `Hi — we noticed ${name}${cat} is listed in the CityBeat directory, El Paso & Ciudad Juárez's bilingual local guide.`,
    pitch: `Claim it free, and upgrade to Premium for ${PREMIUM_MONTHLY}/mo to add photos, hours, social links, and get featured in front of thousands of local readers.`,
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
            content: `Write a short, warm ${locale === 'es' ? 'Spanish' : 'English'} sales email body (2 short paragraphs, no subject line, no signature) to a local business owner. Business: ${listing.name} ${listing.category ? `(${listing.category})` : ''}. Goal: get them to claim their free CityBeat directory listing and upgrade to Premium (${PREMIUM_MONTHLY}/mo for photos, hours, social links, featured placement). Keep it under 90 words, friendly, specific to a local El Paso / Ciudad Juarez audience. Do not include a greeting or links.`,
          },
        ],
      }),
    })
    if (!res.ok) {
      await traceClaudeFailure('sales-agent.pitch', { business: listing.name, category: listing.category, locale }, `anthropic_http_${res.status}`, { business: listing.name })
      return base
    }
    const data: any = await res.json()
    await traceClaude('sales-agent.pitch', { business: listing.name, category: listing.category, locale }, data, { business: listing.name })
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

// kind: o = sales_outreach, u = upsell_outreach, r = recovery_outreach — the
// unsub route looks the id up in the matching collection and suppresses globally.
function unsubUrl(outreachId: string, kind: 'o' | 'u' | 'r' = 'o') {
  return `${APP_URL}/api/track/unsub?${kind}=${encodeURIComponent(outreachId)}`
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
  <p style="font-size:11px;color:#999;line-height:1.5">${ADDRESS}<br/><a href="${unsubUrl(outreachId, 'u')}" style="color:#999">${locale === 'es' ? 'Cancelar' : 'Unsubscribe'}</a></p>
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
    if (await isSuppressed(email)) { results.skipped_already++; continue }
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

// ─── Recovery drip: claims that stalled mid-funnel ───────────────────────────
//
// Segment 1 — started a claim, never verified (code_sent/expired/failed >2d):
//   nudge the claimer's account email with a fresh-code deep link.
// Segment 2 — claimed free, still basic >3d after approval:
//   pitch Premium (leads + photos + placement) to the owner.
// One-and-done per target, tracked in `recovery_outreach`.
export async function runRecoveryOutreach(opts: { limit?: number; dryRun?: boolean } = {}) {
  const limit = Math.max(1, Math.min(opts.limit ?? 20, 100))
  const results = { incomplete_claims: 0, basic_upsells: 0, sent: 0, dryRun: Boolean(opts.dryRun) }
  const now = Date.now()

  const profileEmail = async (userId: string): Promise<{ email: string | null; locale: 'en' | 'es' }> => {
    const doc = await adminDb.collection('profiles').doc(userId).get().catch(() => null)
    const p = doc?.exists ? (doc.data() as any) : null
    return { email: p?.email || null, locale: p?.locale === 'es' ? 'es' : 'en' }
  }

  const alreadySent = async (key: string) => {
    const doc = await adminDb.collection('recovery_outreach').doc(key).get().catch(() => null)
    return Boolean(doc?.exists)
  }

  // The recovery_outreach doc id is DETERMINISTIC ("upgrade:<listingId>", etc.)
  // and listing ids are public, so using it as the unsubscribe bearer let anyone
  // enumerate a sitemap and suppress every business we market to. Each send now
  // mints a random token; the doc id remains the dedupe key only.
  const unsubTokens = new Map<string, string>()
  const tokenFor = (key: string) => {
    let t = unsubTokens.get(key)
    if (!t) {
      t = crypto.randomBytes(18).toString('hex')
      unsubTokens.set(key, t)
    }
    return t
  }

  const record = (key: string, fields: Record<string, unknown>) =>
    adminDb
      .collection('recovery_outreach')
      .doc(key)
      .set({ ...fields, unsub_token: tokenFor(key), created_at: FieldValue.serverTimestamp() })

  // Segment 1: abandoned verifications.
  // Bounded: this collection only grows. Oldest-first so nothing starves, and
  // the loop's own `limit` still governs how many are actually contacted.
  const stalled = await adminDb
    .collection('directory_claims')
    .where('status', 'in', ['code_sent', 'expired', 'failed'])
    .orderBy('created_at', 'asc')
    .limit(Math.max(limit * 10, 200))
    .get()
    .catch(() => ({ docs: [] as any[] }))
  for (const doc of stalled.docs as any[]) {
    if (results.incomplete_claims >= limit) break
    const c = doc.data()
    const ageMs = now - (c.created_at?.toDate ? c.created_at.toDate().getTime() : 0)
    if (ageMs < 2 * 86400000) continue
    if (!c.listing_id || !c.user_id) continue
    const key = `claim:${c.listing_id}:${c.user_id}`
    if (await alreadySent(key)) continue
    // Only nudge if the listing is still up for grabs.
    const lDoc = await adminDb.collection('directory_listings').doc(c.listing_id).get().catch(() => null)
    const l = lDoc?.exists ? (lDoc.data() as any) : null
    if (!l || l.claim_status !== 'unclaimed') continue
    const { email, locale } = await profileEmail(c.user_id)
    if (!email) continue
    if (await isSuppressed(email)) continue

    const name = l.name || (locale === 'es' ? 'tu negocio' : 'your business')
    const subject = locale === 'es' ? `Termina de reclamar ${name} en CityBeat` : `Finish claiming ${name} on CityBeat`
    const url = `${APP_URL}/${locale}/directory/${c.listing_id}/claim`
    const html = `<div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-weight:900">CityBeat</h2>
  <p>${locale === 'es' ? `Empezaste a reclamar <strong>${name}</strong> pero el código expiró.` : `You started claiming <strong>${name}</strong> but the code expired.`}</p>
  <p>${locale === 'es' ? 'Toma un minuto — pide un código nuevo y termina la verificación.' : 'It takes a minute — request a fresh code and finish verifying.'}</p>
  <p style="margin:24px 0"><a href="${url}" style="background:#22d3ee;color:#000;font-weight:800;padding:12px 22px;border-radius:8px;text-decoration:none;text-transform:uppercase;letter-spacing:1px">${locale === 'es' ? 'Terminar mi reclamo' : 'Finish my claim'}</a></p>
  <p style="font-size:11px;color:#999">${ADDRESS} · <a href="${unsubUrl(tokenFor(key), 'r')}" style="color:#999">${locale === 'es' ? 'Cancelar' : 'Unsubscribe'}</a></p></div>`
    let sent = false
    if (!opts.dryRun) sent = (await sendEmail(email, subject, html)).sent
    await record(key, { type: 'incomplete_claim', listing_id: c.listing_id, user_id: c.user_id, email, status: sent ? 'sent' : opts.dryRun ? 'dry_run' : 'send_failed' })
    results.incomplete_claims++
    if (sent) results.sent++
  }

  // Segment 2: claimed free, never upgraded.
  const basics = await adminDb
    .collection('directory_listings')
    .where('claim_status', '==', 'approved')
    .where('tier', '==', 'basic')
    .limit(limit * 4)
    .get()
    .catch(() => ({ docs: [] as any[] }))
  for (const doc of basics.docs as any[]) {
    if (results.basic_upsells >= limit) break
    const l = doc.data()
    if (!l.owner_id) continue
    const claimedMs = typeof l.claimed_at === 'string' ? Date.parse(l.claimed_at) || 0 : 0
    if (!claimedMs || now - claimedMs < 3 * 86400000) continue
    const key = `upgrade:${doc.id}`
    if (await alreadySent(key)) continue
    const { email, locale } = await profileEmail(l.owner_id)
    const to = email || l.contact_email
    if (!to) continue
    if (await isSuppressed(to)) continue

    const name = l.name || (locale === 'es' ? 'tu negocio' : 'your business')
    const subject = locale === 'es' ? `${name} está en vivo — desbloquea tus leads` : `${name} is live — unlock your leads`
    const url = `${APP_URL}/${locale}/dashboard`
    const html = `<div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-weight:900">CityBeat</h2>
  <p>${locale === 'es' ? `<strong>${name}</strong> ya está verificado y visible en CityBeat. ¡Bien hecho!` : `<strong>${name}</strong> is verified and live on CityBeat. Nice work!`}</p>
  <p>${locale === 'es' ? 'Con <strong>Premium ($19.99/mes)</strong> recibes cada lead de clientes al instante, añades fotos y horarios, y apareces más arriba en tu categoría.' : 'With <strong>Premium ($19.99/mo)</strong> you get every customer lead instantly, add photos and hours, and rank higher in your category.'}</p>
  <p style="margin:24px 0"><a href="${url}" style="background:#22d3ee;color:#000;font-weight:800;padding:12px 22px;border-radius:8px;text-decoration:none;text-transform:uppercase;letter-spacing:1px">${locale === 'es' ? 'Mejorar mi ficha' : 'Upgrade my listing'}</a></p>
  <p style="font-size:11px;color:#999">${ADDRESS} · <a href="${unsubUrl(tokenFor(key), 'r')}" style="color:#999">${locale === 'es' ? 'Cancelar' : 'Unsubscribe'}</a></p></div>`
    let sent = false
    if (!opts.dryRun) sent = (await sendEmail(to, subject, html)).sent
    await record(key, { type: 'basic_upsell', listing_id: doc.id, owner_id: l.owner_id, email: to, status: sent ? 'sent' : opts.dryRun ? 'dry_run' : 'send_failed' })
    results.basic_upsells++
    if (sent) results.sent++
  }

  // Segment 3: win-back — churned subscriptions whose 30-day cool-off passed.
  // Bounded, and the loop below now respects `limit` — this segment previously
  // loaded EVERY canceled subscription ever and had no counter, so it processed
  // the whole set on every run regardless of the limit the caller asked for.
  const churned = await adminDb
    .collection('subscriptions')
    .where('status', '==', 'canceled')
    .limit(Math.max(limit * 10, 200))
    .get()
    .catch(() => ({ docs: [] as any[] }))
  let winbacks = 0
  for (const doc of churned.docs as any[]) {
    if (winbacks >= limit) break
    const s = doc.data()
    if (!s.winback_due_at || Date.parse(s.winback_due_at) > now) continue
    const key = `winback:${doc.id}`
    if (await alreadySent(key)) continue
    // Find the listing this subscription powered; skip if they already re-upped.
    const lSnap = await adminDb.collection('directory_listings').where('stripe_subscription_id', '==', doc.id).limit(1).get().catch(() => ({ docs: [] as any[], empty: true }) as any)
    if (lSnap.empty) continue
    const lDoc = lSnap.docs[0]
    const l = lDoc.data() as any
    if (['premium', 'featured'].includes(l.tier)) continue
    const { email, locale } = l.owner_id ? await profileEmail(l.owner_id) : { email: null as string | null, locale: 'en' as const }
    const to = email || l.contact_email
    if (!to || (await isSuppressed(to))) continue

    const name = l.name || (locale === 'es' ? 'tu negocio' : 'your business')
    const subject = locale === 'es' ? `Te extrañamos — ${name} en CityBeat` : `We miss you — ${name} on CityBeat`
    const html = `<div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111">
  <h2 style="font-weight:900">CityBeat</h2>
  <p>${locale === 'es' ? `<strong>${name}</strong> sigue en CityBeat, pero sin los beneficios Premium: los leads llegan y no puedes verlos.` : `<strong>${name}</strong> is still on CityBeat — but without Premium, customer leads arrive and you can't see them.`}</p>
  <p>${locale === 'es' ? 'Reactiva Premium ($19.99/mes) y recupera tus leads, fotos y posicionamiento hoy mismo.' : 'Reactivate Premium ($19.99/mo) and get your leads, photos, and placement back today.'}</p>
  <p style="margin:24px 0"><a href="${APP_URL}/${locale}/dashboard" style="background:#22d3ee;color:#000;font-weight:800;padding:12px 22px;border-radius:8px;text-decoration:none;text-transform:uppercase;letter-spacing:1px">${locale === 'es' ? 'Reactivar' : 'Reactivate'}</a></p>
  <p style="font-size:11px;color:#999">${ADDRESS} · <a href="${unsubUrl(tokenFor(key), 'r')}" style="color:#999">${locale === 'es' ? 'Cancelar' : 'Unsubscribe'}</a></p></div>`
    let sent = false
    if (!opts.dryRun) sent = (await sendEmail(to, subject, html)).sent
    await record(key, { type: 'winback', listing_id: lDoc.id, subscription_id: doc.id, email: to, status: sent ? 'sent' : opts.dryRun ? 'dry_run' : 'send_failed' })
    winbacks++
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
  // Bounded: sales_outreach grows by one doc per business ever contacted, so an
  // uncapped read here got more expensive every single day (flagged in
  // docs/SECURITY_AUDIT.md). Oldest-first so the earliest due follow-ups win.
  const dueSnap = await adminDb
    .collection('sales_outreach')
    .where('status', 'in', ['sent', 'opened', 'clicked'])
    .orderBy('last_sent_at', 'asc')
    .limit(Math.max(limit * 10, 200))
    .get()
    .catch(() => ({ docs: [] as any[] }))
  const now = Date.now()
  for (const doc of dueSnap.docs as any[]) {
    if (results.followups >= limit) break
    const o = doc.data()
    const step = (o.step ?? 0) + 1
    // Conversion is checked BEFORE the step guard: a doc that finished the drip
    // (step >= MAX_STEPS) used to be abandoned here, so claims landing after the
    // 9-day sequence were never recorded — censoring the A/B experiment's only
    // outcome metric, and hitting later-launched arms hardest.
    if (step >= MAX_STEPS) {
      const doneDoc = await adminDb.collection('directory_listings').doc(o.listing_id).get()
      if (doneDoc.exists && (doneDoc.data() as any).claim_status !== 'unclaimed') {
        await doc.ref.set({ status: 'converted', converted_at: FieldValue.serverTimestamp() }, { merge: true })
      }
      continue
    }
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
    if (await isSuppressed(o.email)) continue
    const listing: Listing = { id: o.listing_id, name: o.business_name, category: o.category, email: o.email }
    const base = templatePitch(listing, step, locale)
    const content = await enhanceWithClaude(listing, base, locale)
    const html = renderHtml(listing, content, doc.id, locale)
    let sent = false
    if (!opts.dryRun) {
      const r = await sendEmail(o.email, content.subject, html)
      sent = r.sent
    }
    if (!opts.dryRun) {
      // Never clobber a DELIVERED status with 'send_failed': the first touch did
      // reach the mailbox, and overwriting it both drops the row from the A/B
      // denominator and removes it from this query's status filter forever.
      const deliveredAlready = ['sent', 'opened', 'clicked', 'converted'].includes(String(o.status))
      await doc.ref.set(
        {
          step,
          ...(sent || deliveredAlready ? {} : { status: 'send_failed' }),
          ...(sent ? { last_sent_at: FieldValue.serverTimestamp() } : { last_send_failed_at: FieldValue.serverTimestamp() }),
        },
        { merge: true }
      )
    }
    results.followups++
    if (sent) results.sent++
  }

  // 2) New contacts: unclaimed listings with an email, not yet in sales_outreach.
  // Ordered + cursored across INVOCATIONS (not just within one run) — an
  // unordered, un-cursored query here used to reprocess the same lowest-doc-ID
  // ~80 listings forever, permanently missing everything scraped in after the
  // original backlog (new listings sort after old ones under any doc-ID-based
  // default ordering). See cron-cursor.ts.
  const cursorName = 'sales_agent_new_contacts'
  const cursorValue = await getCronCursor(cursorName)
  const batchSize = limit * 4
  let listingsQuery: FirebaseFirestore.Query = adminDb
    .collection('directory_listings')
    .where('claim_status', '==', 'unclaimed')
    .orderBy('created_at', 'asc')
    .limit(batchSize)
  if (cursorValue) listingsQuery = listingsQuery.startAfter(cursorValue)
  const listingsSnap = await listingsQuery.get()
  const lastDoc = listingsSnap.docs[listingsSnap.docs.length - 1]
  const reachedEnd = listingsSnap.docs.length < batchSize
  await setCronCursor(cursorName, reachedEnd ? null : (lastDoc?.data() as any)?.created_at || null)

  for (const lDoc of listingsSnap.docs) {
    if (results.contacted >= limit) break
    const l = { id: lDoc.id, ...(lDoc.data() as any) } as Listing
    if (!l.email) {
      results.skipped_no_email++
      continue
    }
    if (await isSuppressed(l.email)) {
      results.skipped_already++
      continue
    }
    const already = await adminDb.collection('sales_outreach').where('listing_id', '==', l.id).limit(1).get()
    if (!already.empty) {
      results.skipped_already++
      continue
    }
    const ref = adminDb.collection('sales_outreach').doc()
    // Downgrades to variant 0 when the mirror arms' data is missing, so the
    // recorded subject_variant always matches the copy that actually went out —
    // and records the intent + eligibility so the scoreboard can un-confound it.
    const assignment = pickFirstTouchVariant(l)
    const variant = assignment.variant
    const base = templatePitch(l, 0, locale, variant)
    // Mirror arms (3-4) quote the listing's own data — never let Claude
    // paraphrase that away.
    const content = variant >= 3 ? base : await enhanceWithClaude(l, base, locale)
    const html = renderHtml(l, content, ref.id, locale)
    let sent = false
    if (!opts.dryRun) {
      const r = await sendEmail(l.email, content.subject, html)
      sent = r.sent
    }
    // A dry run must not create experiment rows: the already-contacted guard is
    // status-agnostic, so a 'dry_run' doc used to block that listing from ever
    // being emailed for real while its arm assignment vanished from the analysis.
    if (opts.dryRun) {
      results.contacted++
      continue
    }
    await ref.set({
      listing_id: l.id,
      business_name: l.name || null,
      category: l.category || null,
      email: l.email,
      locale,
      step: 0,
      subject_variant: variant,
      variant_intended: assignment.variant_intended,
      variant_downgraded: assignment.variant_downgraded,
      had_description_es: assignment.had_description_es,
      had_contact_details: assignment.had_contact_details,
      status: sent ? 'sent' : 'send_failed',
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
