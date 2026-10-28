import crypto from 'crypto'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { sendEmail as sendEmailViaProvider } from './email'
import { isSuppressed } from './suppression'
import { reportFailure } from './alerts'
import { traceClaude, traceClaudeFailure } from '@/lib/observability'
import { DIRECTORY_PLANS } from './pricing'
import { fetchWithTimeout, FETCH_TIMEOUT_LLM } from './http'

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
  website?: string
  is_published?: boolean
  merged_into?: unknown
  publication_hold?: unknown
}

// Cursor helpers live in ./listing-cursor. New-contact selection no longer pages
// with them (see "Who gets contacted next" below) but they stay re-exported here
// because sales-agent-cursor.test.ts imports them from this module.
import { unsubHeaders } from './unsub-headers'
import { isChainLocatorUrl, isOwnInbox } from './enrich-contacts'
export { encodeListingCursor, decodeListingCursor, type ListingCursor } from './listing-cursor'

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

// ─── Who gets contacted next ────────────────────────────────────────────────
//
// WHY THIS IS NOT A PAGED SCAN ANY MORE. New contacts used to be found by paging
// `unclaimed` listings in created_at order, 4 x limit (80) at a time, and
// skipping the ones with no email. Only ~4% of listings have an email (1,109 of
// 29,430 in October 2026), so a window of 80 held about three candidates — and
// the cursor only ever moved forward, past every listing that was enriched
// AFTER it went by. The scraper then appended ~17,000 email-less rows to the end
// of the order. Result: the last first-touch went out on 2026-10-16, twelve days
// of silence from a cron that reported "ok" every morning, while 839 enriched,
// never-contacted listings sat behind the cursor.
//
// Selection is now a direct query for listings that HAVE an email (a single-field
// index, ~1.1k reads), filtered and ordered in memory by planNewContacts().

/**
 * Categories contacted FIRST. A category earns a place here by matching a
 * business that has actually paid (Auto Repair, Home Services — a roofer) or by
 * being B2B with a clean inbox and the best click rate seen so far (October
 * 2026, 361 first touches: Automation & Controls 17%, Industrial Supply 7%,
 * Logistics & Freight 6%, every one of them 100% deliverable).
 *
 * This is a HYPOTHESIS built on small samples — 2 customers, 16-27 sends per B2B
 * category. It sets the order, never excludes anyone, and `category_priority` is
 * stamped on every outreach row so it can be re-measured and changed.
 */
const FIRST_CATEGORIES = new Set(['auto repair', 'home services', 'automation & controls', 'industrial supply', 'logistics & freight'])
/** Contacted LAST: restaurants and cafes were 56% of all sends at a 4.5% click
 *  rate (8 of 177), with 40-55% of the inboxes later found to belong to someone
 *  else (an ordering platform, a web agency) rather than the owner. */
const LAST_CATEGORIES = new Set(['restaurant', 'cafe'])

export function outreachPriority(category?: string | null): 0 | 1 | 2 {
  const c = String(category || '').trim().toLowerCase()
  if (FIRST_CATEGORIES.has(c)) return 0
  if (LAST_CATEGORIES.has(c)) return 2
  return 1
}

/** Share of new first touches sent in Spanish unless a run forces a language.
 *  El Paso is ~80% bilingual and every send so far was English, so this is a
 *  50/50 test: the same hash-assigned split also makes the result readable. */
export const DEFAULT_SPANISH_SHARE = 0.5

/**
 * Deterministic per-listing language for a first touch. Hashed with its own salt
 * so it is independent of the subject-line arm (subjectVariant hashes the bare
 * id): each subject arm receives both languages in the same proportion, which is
 * what lets one be compared against the other.
 */
export function outreachLocale(listingId: string, spanishShare: number = DEFAULT_SPANISH_SHARE): 'en' | 'es' {
  const share = Number.isFinite(spanishShare) ? Math.min(1, Math.max(0, spanishShare)) : 0
  if (share <= 0) return 'en'
  if (share >= 1) return 'es'
  const u = crypto.createHash('sha1').update(`outreach-locale:${listingId}`).digest().readUInt32BE(0) / 0x1_0000_0000
  return u < share ? 'es' : 'en'
}

const normEmail = (v: unknown) => String(v ?? '').trim().toLowerCase()
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function websiteHost(website: unknown): string | undefined {
  if (typeof website !== 'string' || !website.trim()) return undefined
  try {
    return new URL(/^https?:/i.test(website) ? website : `https://${website}`).hostname || undefined
  } catch {
    return undefined
  }
}

export interface NewContactPlan {
  /** Contactable listings, best-first. The caller applies the async suppression check. */
  ordered: Listing[]
  skipped: Record<
    'not_unclaimed' | 'unpublished' | 'merged' | 'held' | 'invalid_email' | 'already_contacted' | 'duplicate_inbox' | 'chain_locator' | 'foreign_inbox',
    number
  >
}

/**
 * Pure: who may receive a first touch, in the order they should. Everything that
 * makes an email to this listing wrong is excluded here and COUNTED, so a short
 * queue says why:
 *   unpublished / merged / held   the pitch says "your business is listed in the
 *                                 public CityBeat directory"; for a hidden or
 *                                 folded-in sibling card that is false, and the
 *                                 "view your listing" link would 404
 *   already_contacted             this listing, or this INBOX via another listing
 *                                 (a chain's branches share one address; 26 queued
 *                                 inboxes had already been mailed that way)
 *   duplicate_inbox               the same address on several queued listings:
 *                                 the best-priority one wins, the rest wait
 *   chain_locator / foreign_inbox head-office or web-agency addresses, never the
 *                                 local owner (lib/enrich-contacts.ts)
 */
export function planNewContacts(
  pool: Listing[],
  contacted: { listingIds: ReadonlySet<string>; emails: ReadonlySet<string> }
): NewContactPlan {
  const skipped: NewContactPlan['skipped'] = {
    not_unclaimed: 0, unpublished: 0, merged: 0, held: 0, invalid_email: 0,
    already_contacted: 0, duplicate_inbox: 0, chain_locator: 0, foreign_inbox: 0,
  }
  const sorted = [...pool].sort(
    (a, b) => outreachPriority(a.category) - outreachPriority(b.category) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
  const seenInboxes = new Set<string>()
  const ordered: Listing[] = []
  for (const l of sorted) {
    const email = normEmail(l.email)
    if (l.claim_status !== 'unclaimed') { skipped.not_unclaimed++; continue }
    if (l.is_published !== true) { skipped.unpublished++; continue }
    if (l.merged_into) { skipped.merged++; continue }
    if (l.publication_hold) { skipped.held++; continue }
    if (!EMAIL_SHAPE.test(email)) { skipped.invalid_email++; continue }
    if (contacted.listingIds.has(l.id) || contacted.emails.has(email)) { skipped.already_contacted++; continue }
    if (isChainLocatorUrl(l.website)) { skipped.chain_locator++; continue }
    if (!isOwnInbox(email, websiteHost(l.website))) { skipped.foreign_inbox++; continue }
    if (seenInboxes.has(email)) { skipped.duplicate_inbox++; continue }
    seenInboxes.add(email)
    ordered.push({ ...l, email })
  }
  return { ordered, skipped }
}

const NEW_CONTACT_FIELDS = [
  'name', 'category', 'email', 'phone', 'address', 'description', 'description_es', 'hours', 'website',
  'claim_status', 'is_published', 'merged_into', 'publication_hold',
] as const

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
    const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
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
    }, FETCH_TIMEOUT_LLM)
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

// CAN-SPAM (15 U.S.C. 7704(a)(5)) requires every commercial email to carry a
// valid PHYSICAL POSTAL ADDRESS — a street address, or a registered PO box /
// private mailbox. The fallback below is a company name, a city and a state: it
// names no place mail can be delivered, so every outbound send was shipping a
// footer that only LOOKS compliant, and the env var that fixes it appears in no
// .env.example and no runbook. Set it to the real mailing address:
//   SALES_PHYSICAL_ADDRESS="CityBeat Media Group, 000 Example St Ste 1, El Paso, TX 79901"
// The same variable is read by lib/unclaimed-relay-email.ts and
// api/cron/ghost-reports; the newsletter has its own NEWSLETTER_POSTAL_ADDRESS.
const ADDRESS = process.env.SALES_PHYSICAL_ADDRESS || 'CityBeat Media Group, El Paso, TX, USA'

/**
 * True when `address` contains a line mail could actually be delivered to: a
 * numbered street line, or a PO box / PMB. Deliberately structural, NOT a
 * validator — it exists to catch the city-and-state placeholder, not to certify
 * an address as compliant. Passing it means "worth sending"; failing it means
 * "certainly not a postal address".
 */
export function hasDeliverableAddressLine(address: string): boolean {
  const s = String(address || '').trim()
  if (!s) return false
  if (/\b(p\.?\s?o\.?\s*box|post\s+office\s+box|pmb)\b/i.test(s)) return true
  // A street line starts a comma-separated part with a house number:
  // "123 N Oregon St" / "1200 Golden Key Ct Apt 4". A trailing ZIP ("El Paso,
  // TX 79901") does not, because the digits do not open the part.
  return /(^|,\s*)\d+[a-z]?\s+\S+/i.test(s)
}

// Alerting, not blocking: a placeholder address is a compliance defect for the
// operator to fix, and silently halting the only outbound revenue channel is not
// this module's call. reportFailure dedupes to 3 emails per 6h per source, and
// the once-per-process latch keeps a warm instance from re-reporting on every
// send. Every commercial send in this file goes through sendEmail() below, so
// that is the one place that sees all of them.
let postalAddressReported = false
async function reportPlaceholderPostalAddress() {
  if (postalAddressReported || hasDeliverableAddressLine(ADDRESS)) return
  postalAddressReported = true
  await reportFailure(
    'sales-agent:postal-address',
    new Error(
      'SALES_PHYSICAL_ADDRESS has no street address or PO box. CAN-SPAM 7704(a)(5) requires a valid physical postal address in every commercial email; outbound sales mail is going out with a city/state placeholder.'
    ),
    { address: ADDRESS },
    { skipHealth: true }
  ).catch(() => {
    /* alerting must never break a send */
  })
}

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

// Every commercial send in this file funnels through here, which is exactly why
// the one-click unsubscribe header belongs at this point rather than at each of
// the seven call sites. The footer link alone does not satisfy the Gmail/Yahoo
// bulk-sender rules, and without the header the button a recipient reaches for
// is 'report spam' - which damages deliverability for every stream at once,
// including the transactional mail telling a paying customer their listing is live.
function sendEmail(to: string, subject: string, html: string, locale?: 'en' | 'es') {
  void reportPlaceholderPostalAddress()
  return sendEmailViaProvider(to, subject, html, FROM, { headers: unsubHeaders(to, locale) })
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
    // Same trap as recovery_outreach: the `already` check above keys on this
    // collection, so a 'dry_run' row would block that listing's real upsell for good.
    if (opts.dryRun) {
      results.contacted++
      continue
    }
    await ref.set({
      listing_id: l.id, business_name: l.name || null, email, locale,
      status: sent ? 'sent' : 'send_failed',
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

  // The ONE write in this function, and a dry run must not make it. The ledger is
  // the dedupe: alreadySent(key) skips any target that has a row, whatever the
  // row's status. A 'dry_run' row therefore kept that target out of every future
  // real run, so a harmless-looking preview ("who would you nudge?") permanently
  // cancelled the nudges it listed. Counters still advance, so the dry run reports
  // exactly what a real run would do; it just leaves no trace. (The first-touch
  // path made the same fix earlier: "a dry run must not create experiment rows".)
  const record = async (key: string, fields: Record<string, unknown>) => {
    if (opts.dryRun) return
    await adminDb
      .collection('recovery_outreach')
      .doc(key)
      .set({ ...fields, unsub_token: tokenFor(key), created_at: FieldValue.serverTimestamp() })
  }

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
  <p>${locale === 'es' ? 'Con <strong>Premium ($19.99/mes)</strong> recibes cada lead al instante, añades fotos y contenido enriquecido, y muestras una tarjeta más grande antes de las fichas Básicas.' : 'With <strong>Premium ($19.99/mo)</strong> you get every customer lead instantly, add photos and richer content, and show a larger card before Basic listings.'}</p>
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
  <p>${locale === 'es' ? 'Reactiva Premium ($19.99/mes) y recupera tus leads completos, fotos y tarjeta Premium hoy mismo.' : 'Reactivate Premium ($19.99/mo) and get your full leads, photos, and Premium card back today.'}</p>
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
//
// Language: `opts.locale` forces one language for every send in the run (an
// operator override). Left unset, each NEW listing is assigned a language by
// outreachLocale() at `spanishShare` and the choice is stored on its outreach row
// (`locale`, `locale_source`); follow-ups then keep whatever that row says.
export async function runSalesOutreach(
  opts: { limit?: number; dryRun?: boolean; locale?: 'en' | 'es'; spanishShare?: number } = {}
) {
  const limit = Math.max(1, Math.min(opts.limit ?? 25, 100))
  const spanishShare = opts.spanishShare ?? DEFAULT_SPANISH_SHARE
  const results: {
    contacted: number
    followups: number
    skipped_no_email: number
    skipped_already: number
    sent: number
    dryRun: boolean
    queue_size?: number
    spanish_share?: number
    contacted_by_locale?: { en: number; es: number }
    skipped_ineligible?: NewContactPlan['skipped']
  } = { contacted: 0, followups: 0, skipped_no_email: 0, skipped_already: 0, sent: 0, dryRun: Boolean(opts.dryRun) }

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
    // A follow-up continues in the language the first touch used. It used to take
    // the RUN's language, which would have sent a Spanish first touch an English
    // reminder the moment any run was not English-only.
    const rowLocale: 'en' | 'es' = o.locale === 'es' ? 'es' : 'en'
    const base = templatePitch(listing, step, rowLocale)
    const content = await enhanceWithClaude(listing, base, rowLocale)
    const html = renderHtml(listing, content, doc.id, rowLocale)
    let sent = false
    if (!opts.dryRun) {
      const r = await sendEmail(o.email, content.subject, html, rowLocale)
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

  // 2) New contacts — see "Who gets contacted next" above for why this is a
  // direct query and not a paged scan. Reads: every listing that has an email
  // (~1.1k) plus the outreach ledger (listing_id + email only), once per run.
  const [emailSnap, outreachSnap] = await Promise.all([
    adminDb.collection('directory_listings').where('email', '>', '').select(...NEW_CONTACT_FIELDS).get(),
    adminDb.collection('sales_outreach').select('listing_id', 'email').get(),
  ])
  const pool = emailSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Listing[]
  const plan = planNewContacts(pool, {
    listingIds: new Set(outreachSnap.docs.map((d) => String(d.get('listing_id') || '')).filter(Boolean)),
    emails: new Set(outreachSnap.docs.map((d) => normEmail(d.get('email'))).filter(Boolean)),
  })
  results.queue_size = plan.ordered.length
  results.spanish_share = opts.locale ? (opts.locale === 'es' ? 1 : 0) : spanishShare
  results.contacted_by_locale = { en: 0, es: 0 }
  results.skipped_ineligible = plan.skipped

  for (const l of plan.ordered) {
    if (results.contacted >= limit) break
    if (await isSuppressed(l.email as string)) {
      results.skipped_already++
      continue
    }
    const ref = adminDb.collection('sales_outreach').doc()
    const rowLocale = opts.locale ?? outreachLocale(l.id, spanishShare)
    // Downgrades to variant 0 when the mirror arms' data is missing, so the
    // recorded subject_variant always matches the copy that actually went out —
    // and records the intent + eligibility so the scoreboard can un-confound it.
    const assignment = pickFirstTouchVariant(l)
    const variant = assignment.variant
    const base = templatePitch(l, 0, rowLocale, variant)
    // Mirror arms (3-4) quote the listing's own data — never let Claude
    // paraphrase that away.
    const content = variant >= 3 ? base : await enhanceWithClaude(l, base, rowLocale)
    const html = renderHtml(l, content, ref.id, rowLocale)
    let sent = false
    if (!opts.dryRun) {
      const r = await sendEmail(l.email as string, content.subject, html, rowLocale)
      sent = r.sent
    }
    // A dry run must not create experiment rows: the already-contacted guard is
    // status-agnostic, so a 'dry_run' doc used to block that listing from ever
    // being emailed for real while its arm assignment vanished from the analysis.
    if (opts.dryRun) {
      results.contacted++
      results.contacted_by_locale[rowLocale]++
      continue
    }
    await ref.set({
      listing_id: l.id,
      business_name: l.name || null,
      category: l.category || null,
      category_priority: outreachPriority(l.category),
      email: l.email,
      locale: rowLocale,
      locale_source: opts.locale ? 'forced' : 'ab',
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
    results.contacted_by_locale[rowLocale]++
    if (sent) results.sent++
  }

  return results
}
