// Pure, dependency-free half of the unclaimed-listing relay: eligibility rules,
// dedupe keys, and the bilingual email builder. Kept free of firebase imports so
// it unit-tests cleanly (node:test). The db-touching sender lives in
// ./unclaimed-relay.ts and consumes these.

export type RelayEventType = 'review' | 'question' | 'quote' | 'press_mention'

export interface RelayListing {
  claim_status?: string
  merged_into?: string | null
  email?: string | null
  contact_email?: string | null
  phone?: string | null
  name?: string | null
  // Rep-sold paid listings are created claim_status:'unclaimed' until admin
  // approval attaches the owner — they are PAYING CUSTOMERS, never relay targets.
  sold_by_rep?: string | null
  source?: string | null
  sales_order_id?: string | null
  relay_sent_at?: string[] | null
}

export type RelayDetail =
  | { type: 'review'; rating: number; comment?: string | null }
  | { type: 'question'; question: string }
  // full omitted → the sender decides (first-ever lead is forwarded in full,
  // claimed atomically AFTER all gates pass so a blocked send can't burn it).
  | { type: 'quote'; name: string; contact: string; message?: string | null; full?: boolean }
  | { type: 'press_mention'; articleTitle: string; articleUrl: string }

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'
const ADDRESS = process.env.SALES_PHYSICAL_ADDRESS || 'CityBeat Media Group, El Paso, TX, USA'

export const RELAY_COLLECTION = 'unclaimed_relays'
export const RELAY_MONTHLY_CAP = 4 // max relay emails per listing per 30 days, all types combined
export const RELAY_CAP_WINDOW_MS = 30 * 86400000

const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** The enriched contact address for a listing, or null when we have none. */
export function relayContactEmail(listing: RelayListing | null | undefined): string | null {
  const raw = listing?.contact_email || listing?.email
  const email = typeof raw === 'string' ? raw.trim() : ''
  return email.includes('@') ? email : null
}

/**
 * Only genuinely unclaimed, canonical (not consolidated-away) listings with a
 * known contact are relay targets. A pending_approval or approved listing has
 * an owner with real notifications — never relay those.
 */
export function relayEligible(listing: RelayListing | null | undefined): boolean {
  if (!listing) return false
  if (listing.claim_status !== 'unclaimed') return false
  if (listing.merged_into) return false
  // A rep-sold listing is 'unclaimed' only until admin approval — it belongs to
  // a PAYING customer with a rep. "Claim your page free" mail to them is wrong.
  if (listing.sold_by_rep || listing.source === 'sales_rep' || listing.sales_order_id) return false
  return relayContactEmail(listing) !== null
}

/** One relay per event, ever: the dedupe doc id. Event ids are Firestore auto-ids (unguessable). */
export function relayDedupeKey(type: RelayEventType, eventId: string): string {
  return `${type}:${eventId}`
}

function claimUrl(listingId: string, locale: 'en' | 'es'): string {
  return `${APP_URL}/${locale}/directory/${listingId}/claim`
}

function ctaButton(href: string, label: string): string {
  return `<p style="margin:20px 0"><a href="${href}" style="background:#22d3ee;color:#000;font-weight:800;padding:12px 22px;border-radius:8px;text-decoration:none;text-transform:uppercase;letter-spacing:1px">${label}</a></p>`
}

function stars(rating: number): string {
  const r = Math.max(1, Math.min(5, Math.round(rating)))
  return '★'.repeat(r) + '☆'.repeat(5 - r)
}

/**
 * Pure, testable email builder. Bilingual by construction: an English block,
 * a divider, then Spanish — the pattern buyer-emails uses when the recipient's
 * language is unknown. Every email carries the CAN-SPAM footer and an
 * unsubscribe link keyed by a random token.
 */
export function buildRelayEmail(input: {
  listingId: string
  businessName: string
  detail: RelayDetail
  unsubToken: string
}): { subject: string; html: string } {
  const { listingId, detail, unsubToken } = input
  const biz = esc(input.businessName || 'your business')
  const d = detail

  let subject = ''
  let bodyEn = ''
  let bodyEs = ''

  if (d.type === 'review') {
    subject = `Someone reviewed ${input.businessName || 'your business'} on CityBeat`
    const quoted = d.comment ? `<blockquote style="margin:12px 0;padding:10px 14px;border-left:3px solid #22d3ee;color:#333">${esc(d.comment).slice(0, 400)}</blockquote>` : ''
    bodyEn = `<p>A customer just left a <strong>${stars(d.rating)}</strong> review for <strong>${biz}</strong> on CityBeat, El Paso's bilingual local guide.</p>${quoted}
      <p>This review is public. <strong>Claim your listing (free)</strong> to reply as the owner and manage your page.</p>
      ${ctaButton(claimUrl(listingId, 'en'), 'Claim & reply')}`
    bodyEs = `<p>Un cliente acaba de dejar una reseña de <strong>${stars(d.rating)}</strong> para <strong>${biz}</strong> en CityBeat, la guía local bilingüe de El Paso.</p>${quoted}
      <p>Esta reseña es pública. <strong>Reclame su página (gratis)</strong> para responder como propietario y administrar su ficha.</p>
      ${ctaButton(claimUrl(listingId, 'es'), 'Reclamar y responder')}`
  } else if (d.type === 'question') {
    subject = `A customer asked ${input.businessName || 'your business'} a question on CityBeat`
    const q = `<blockquote style="margin:12px 0;padding:10px 14px;border-left:3px solid #22d3ee;color:#333">${esc(d.question).slice(0, 400)}</blockquote>`
    bodyEn = `<p>A customer just asked a public question about <strong>${biz}</strong> on CityBeat:</p>${q}
      <p>It's unanswered — and everyone browsing your page can see that. <strong>Claim your listing (free)</strong> to answer it.</p>
      ${ctaButton(claimUrl(listingId, 'en'), 'Claim & answer')}`
    bodyEs = `<p>Un cliente acaba de hacer una pregunta pública sobre <strong>${biz}</strong> en CityBeat:</p>${q}
      <p>Sigue sin respuesta — y cualquiera que visite su página puede verlo. <strong>Reclame su página (gratis)</strong> para responderla.</p>
      ${ctaButton(claimUrl(listingId, 'es'), 'Reclamar y responder')}`
  } else if (d.type === 'quote') {
    if (d.full) {
      subject = `A customer wants a quote from ${input.businessName || 'your business'} — here's their info`
      const lead = `<p><strong>From:</strong> ${esc(d.name)}<br/><strong>Contact:</strong> ${esc(d.contact)}</p>${d.message ? `<p><strong>Message:</strong><br/>${esc(d.message).slice(0, 800)}</p>` : ''}`
      bodyEn = `<p>A customer just requested a quote from <strong>${biz}</strong> through CityBeat. This first lead is on us — here it is in full:</p>${lead}
        <p><strong>Claim your listing (free)</strong> to get every future lead delivered instantly.</p>
        ${ctaButton(claimUrl(listingId, 'en'), 'Claim my business')}`
      bodyEs = `<p>Un cliente acaba de pedir una cotización a <strong>${biz}</strong> a través de CityBeat. Este primer contacto va por nuestra cuenta — aquí está completo:</p>${lead}
        <p><strong>Reclame su página (gratis)</strong> para recibir cada contacto futuro al instante.</p>
        ${ctaButton(claimUrl(listingId, 'es'), 'Reclamar mi negocio')}`
    } else {
      subject = `Another customer is trying to reach ${input.businessName || 'your business'} on CityBeat`
      bodyEn = `<p>Someone just asked to be contacted by <strong>${biz}</strong> through your CityBeat listing.</p>
        <p><strong>Claim your listing (free)</strong> to see who's trying to reach you — it takes two minutes.</p>
        ${ctaButton(claimUrl(listingId, 'en'), 'Claim my business')}`
      bodyEs = `<p>Alguien acaba de pedir que <strong>${biz}</strong> lo contacte a través de su ficha en CityBeat.</p>
        <p><strong>Reclame su página (gratis)</strong> para ver quién intenta comunicarse — toma dos minutos.</p>
        ${ctaButton(claimUrl(listingId, 'es'), 'Reclamar mi negocio')}`
    }
  } else {
    subject = `CityBeat mentioned ${input.businessName || 'your business'} in today's news`
    const link = `<p><a href="${esc(d.articleUrl)}" style="color:#0891b2;font-weight:700">${esc(d.articleTitle).slice(0, 160)}</a></p>`
    bodyEn = `<p><strong>${biz}</strong> was mentioned in a CityBeat news story:</p>${link}
      <p><strong>Claim your listing (free)</strong> and we'll pin your press coverage to your business page.</p>
      ${ctaButton(claimUrl(listingId, 'en'), 'Claim my business')}`
    bodyEs = `<p><strong>${biz}</strong> fue mencionado en una nota de CityBeat:</p>${link}
      <p><strong>Reclame su página (gratis)</strong> y fijamos su cobertura de prensa en su perfil.</p>
      ${ctaButton(claimUrl(listingId, 'es'), 'Reclamar mi negocio')}`
  }

  const html = `<div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111">
    <h2 style="font-weight:900;margin-bottom:4px">city<span style="font-style:italic;color:#0891b2">BEat</span></h2>
    ${bodyEn}
    <hr style="border:none;border-top:1px solid #ddd;margin:24px 0"/>
    ${bodyEs}
    <p style="font-size:11px;color:#999;margin-top:28px">You received this because your business appears in the public CityBeat directory. · Recibió esto porque su negocio aparece en el directorio público de CityBeat.<br/>
    ${esc(ADDRESS)} · <a href="${APP_URL}/api/track/unsub?x=${encodeURIComponent(unsubToken)}" style="color:#999">Unsubscribe / Cancelar suscripción</a></p>
  </div>`

  return { subject, html }
}
