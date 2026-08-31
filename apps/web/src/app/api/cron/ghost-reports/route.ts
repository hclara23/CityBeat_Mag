import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { dayKey, daysAgoKey, totalsForRange, type DailyStatRow } from '@/lib/listing-analytics'
import { sendEmail } from '@/lib/email'
import { isSuppressed } from '@/lib/suppression'
import { reportFailure, reportSuccess } from '@/lib/alerts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'
const FROM = process.env.SALES_FROM_EMAIL || 'CityBeat <hello@citybeatmag.co>'
const ADDRESS = process.env.SALES_PHYSICAL_ADDRESS || 'CityBeat Media Group, El Paso, TX, USA'

// The "ghost traffic report" — Google Business Profile's highest-converting claim
// email, adapted: a monthly, REAL-numbers report to UNCLAIMED listings that got
// meaningful traffic. "87 el paseños viewed your business this month; 3 tried to
// contact you; you rank #6 of 41 plumbers viewed" — every number is measured, and
// the full monthly report (daily trends, benchmarks) is the free-claim unlock.
//
// Discipline (cold outbound to scraped addresses):
//   • traffic floor — only listings whose numbers actually impress (≥ MIN_VIEWS)
//   • one report per listing per quarter (last_ghost_report_at), plus a per-period
//     atomic reservation in unclaimed_relays (ghost:{listingId}:{period})
//   • honors the shared per-listing relay cap, the suppression list, and every
//     email carries the relay unsubscribe (?x=token) + CAN-SPAM footer
//   • hottest listings first; ?limit= caps a run (default 25); ?dryRun=1 previews
function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

const MIN_VIEWS = 20 // 30-day floor — below this the number undercuts the pitch
const QUARTER_MS = 90 * 86400000
const RELAY_CAP = 4
const RELAY_CAP_WINDOW_MS = 30 * 86400000

const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

interface GhostRow {
  listingId: string
  name: string
  category: string
  email: string
  views: number
  prevViews: number
  leads: number
  clicks: number
  reviews: number
  rank: number
  rankOf: number
}

function reportHtml(row: GhostRow, unsubToken: string): { subject: string; html: string } {
  const biz = esc(row.name || 'your business')
  const cat = esc(row.category || 'business')
  const delta =
    row.prevViews > 0 ? Math.round(((row.views - row.prevViews) / row.prevViews) * 100) : null
  const deltaChip =
    delta === null ? '' : delta >= 0 ? ` <span style="color:#059669">▲ ${delta}%</span>` : ` <span style="color:#dc2626">▼ ${Math.abs(delta)}%</span>`

  const statCell = (n: number, labelEn: string, labelEs: string) =>
    `<td style="padding:10px 14px;text-align:center"><div style="font-size:26px;font-weight:900">${n.toLocaleString('en-US')}</div><div style="font-size:11px;color:#666">${labelEn}<br/>${labelEs}</div></td>`

  const statsTable = `<table style="margin:16px auto;border-collapse:collapse"><tr>
      ${statCell(row.views, 'views (30 days)', 'vistas (30 días)')}
      ${statCell(row.clicks, 'clicks to contact', 'clics para contactar')}
      ${statCell(row.leads, 'quote requests', 'cotizaciones')}
      ${row.reviews > 0 ? statCell(row.reviews, 'reviews', 'reseñas') : ''}
    </tr></table>`

  const rankLine =
    row.rankOf >= 3
      ? `<p style="text-align:center;font-weight:700">#${row.rank} of ${row.rankOf} ${cat} listings viewed on CityBeat · #${row.rank} de ${row.rankOf} en su categoría</p>`
      : ''

  const cta = (locale: 'en' | 'es', label: string) =>
    `<p style="margin:20px 0;text-align:center"><a href="${APP_URL}/${locale}/directory/${row.listingId}/claim" style="background:#22d3ee;color:#000;font-weight:800;padding:12px 22px;border-radius:8px;text-decoration:none;text-transform:uppercase;letter-spacing:1px">${label}</a></p>`

  const subject = `${row.views.toLocaleString('en-US')} people viewed ${row.name || 'your business'} on CityBeat this month`

  const html = `<div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111">
    <h2 style="font-weight:900;margin-bottom:4px">city<span style="font-style:italic;color:#0891b2">BEat</span></h2>
    <p><strong>${biz}</strong> is getting noticed on CityBeat, El Paso's bilingual local guide — and nobody is managing the page.</p>
    <p style="text-align:center;font-size:15px"><strong>Your last 30 days${deltaChip}:</strong></p>
    ${statsTable}
    ${rankLine}
    <p><strong>Claim your listing (free, ~2 minutes)</strong> to get this report every month, reply to reviews, answer customer questions, fix your hours &amp; phone, and receive customer leads.</p>
    ${cta('en', 'Claim my business — free')}
    <hr style="border:none;border-top:1px solid #ddd;margin:24px 0"/>
    <p><strong>${biz}</strong> está llamando la atención en CityBeat — y nadie administra la página.</p>
    <p><strong>Reclame su página (gratis, ~2 minutos)</strong> para recibir este reporte cada mes, responder reseñas y preguntas, corregir su horario y teléfono, y recibir clientes.</p>
    ${cta('es', 'Reclamar mi negocio — gratis')}
    <p style="font-size:11px;color:#999;margin-top:28px">You received this because your business appears in the public CityBeat directory. · Recibió esto porque su negocio aparece en el directorio público de CityBeat.<br/>
    ${esc(ADDRESS)} · <a href="${APP_URL}/api/track/unsub?x=${encodeURIComponent(unsubToken)}" style="color:#999">Unsubscribe / Cancelar suscripción</a></p>
  </div>`

  return { subject, html }
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const dryRun = searchParams.get('dryRun') === '1'
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '25', 10) || 25, 1), 100)

  try {
    const now = new Date()
    const period = dayKey(now).slice(0, 7) // YYYY-MM
    const curStart = daysAgoKey(now, 29)
    const curEnd = dayKey(now)
    const prevStart = daysAgoKey(now, 59)
    const prevEnd = daysAgoKey(now, 30)

    // One collection-wide stats read (60 days), grouped per listing — the set of
    // listings with ANY traffic is far smaller than the directory itself.
    const statsSnap = await adminDb.collection('listing_stats').where('day', '>=', prevStart).get()
    const rowsByListing = new Map<string, DailyStatRow[]>()
    for (const doc of statsSnap.docs) {
      const row = doc.data() as DailyStatRow
      const lid = String((row as any).listing_id || '')
      if (!lid) continue
      const arr = rowsByListing.get(lid) || []
      arr.push(row)
      rowsByListing.set(lid, arr)
    }

    // Current-window views per listing (for ranks + floor).
    const viewsByListing = new Map<string, number>()
    for (const [lid, rows] of rowsByListing) {
      viewsByListing.set(lid, totalsForRange(rows, curStart, curEnd).view)
    }

    // Load the listing docs for everything that met the floor (chunked getAll).
    const candidateIds = [...viewsByListing.entries()]
      .filter(([, v]) => v >= MIN_VIEWS)
      .sort((a, b) => b[1] - a[1])
      .map(([lid]) => lid)
    const listingById = new Map<string, any>()
    for (let i = 0; i < candidateIds.length; i += 100) {
      const chunk = candidateIds.slice(i, i + 100)
      const docs = await adminDb.getAll(...chunk.map((lid) => adminDb.collection('directory_listings').doc(lid)))
      for (const d of docs) if (d.exists) listingById.set(d.id, d.data())
    }

    // Categories for EVERY viewed listing (not just floor-qualified ones), so the
    // rank denominator honestly means "of all <category> listings viewed" — a
    // projected read keeps it cheap.
    const categoryByListing = new Map<string, string>()
    for (const [lid, l] of listingById) categoryByListing.set(lid, String(l?.category || ''))
    const missingCatIds = [...viewsByListing.keys()].filter((lid) => !categoryByListing.has(lid))
    for (let i = 0; i < missingCatIds.length; i += 100) {
      const chunk = missingCatIds.slice(i, i + 100)
      const docs = await adminDb.getAll(
        ...chunk.map((lid) => adminDb.collection('directory_listings').doc(lid)),
        { fieldMask: ['category'] }
      )
      for (const d of docs) categoryByListing.set(d.id, d.exists ? String((d.data() as any)?.category || '') : '')
    }

    // Category ranks among listings with measured views (claimed or not — honest
    // competitive framing: "#6 of 41 plumbers viewed").
    const byCategory = new Map<string, Array<{ lid: string; views: number }>>()
    for (const [lid, views] of viewsByListing) {
      const cat = categoryByListing.get(lid) || ''
      if (!cat) continue
      const arr = byCategory.get(cat) || []
      arr.push({ lid, views })
      byCategory.set(cat, arr)
    }
    for (const arr of byCategory.values()) arr.sort((a, b) => b.views - a.views)
    const rankOf = (lid: string, cat: string): { rank: number; of: number } => {
      const arr = byCategory.get(cat) || []
      const idx = arr.findIndex((x) => x.lid === lid)
      return { rank: idx >= 0 ? idx + 1 : 0, of: arr.length }
    }

    // Recent review counts (30d) per listing — bounded range query (created_at is
    // a Firestore serverTimestamp, so the operand must be a Timestamp and parsing
    // must handle both Timestamp and ISO-string shapes).
    const curStartMs = Date.parse(`${curStart}T00:00:00Z`)
    const reviewsSnap = await adminDb
      .collection('directory_reviews')
      .where('created_at', '>=', Timestamp.fromMillis(curStartMs))
      .select('listing_id', 'created_at')
      .get()
      .catch(() => ({ docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] }))
    const reviewCount = new Map<string, number>()
    for (const doc of reviewsSnap.docs) {
      const r = doc.data() as any
      const t = r?.created_at?.toDate ? r.created_at.toDate().getTime() : Date.parse(String(r?.created_at || ''))
      if (!Number.isFinite(t) || t < curStartMs) continue
      const lid = String(r.listing_id || '')
      reviewCount.set(lid, (reviewCount.get(lid) || 0) + 1)
    }

    let sent = 0
    let skippedNotEligible = 0
    let skippedRecentReport = 0
    let skippedSuppressed = 0
    let skippedCapped = 0
    let skippedAlreadySent = 0
    const preview: Array<{ listing: string; email: string; views: number }> = []

    for (const lid of candidateIds) {
      if (sent >= limit) break
      const listing = listingById.get(lid)
      // Unclaimed, canonical, with a contact — same eligibility as the relay.
      // Rep-sold listings are 'unclaimed' only until admin approval: they belong
      // to PAYING customers and must never get "nobody manages this page" mail.
      const email = String(listing?.contact_email || listing?.email || '').trim()
      if (
        !listing ||
        listing.claim_status !== 'unclaimed' ||
        listing.merged_into ||
        listing.sold_by_rep ||
        listing.source === 'sales_rep' ||
        listing.sales_order_id ||
        !email.includes('@')
      ) {
        skippedNotEligible++
        continue
      }
      // One report per quarter.
      const lastReport = Date.parse(String(listing.last_ghost_report_at || ''))
      if (Number.isFinite(lastReport) && now.getTime() - lastReport < QUARTER_MS) {
        skippedRecentReport++
        continue
      }
      // Shared relay frequency cap (event relays + ghost reports together).
      const history: string[] = Array.isArray(listing.relay_sent_at) ? listing.relay_sent_at : []
      const recent = history.filter((iso) => {
        const t = Date.parse(String(iso))
        return Number.isFinite(t) && now.getTime() - t < RELAY_CAP_WINDOW_MS
      })
      if (recent.length >= RELAY_CAP) {
        skippedCapped++
        continue
      }
      if (await isSuppressed(email)) {
        skippedSuppressed++
        continue
      }

      const rows = rowsByListing.get(lid) || []
      const cur = totalsForRange(rows, curStart, curEnd)
      const prev = totalsForRange(rows, prevStart, prevEnd)
      const { rank, of } = rankOf(lid, String(listing.category || ''))
      const row: GhostRow = {
        listingId: lid,
        name: String(listing.name || ''),
        category: String(listing.category || ''),
        email,
        views: cur.view,
        prevViews: prev.view,
        leads: cur.lead,
        clicks: cur.click_website + cur.click_directions + cur.click_action,
        reviews: reviewCount.get(lid) || 0,
        rank,
        rankOf: of,
      }

      if (dryRun) {
        sent++
        preview.push({ listing: row.name, email, views: row.views })
        continue
      }

      // Atomic per-period reservation (rerunning the cron can't double-send).
      const unsubToken = crypto.randomBytes(18).toString('hex')
      const relayRef = adminDb.collection('unclaimed_relays').doc(`ghost:${lid}:${period}`)
      try {
        await relayRef.create({
          listing_id: lid,
          type: 'ghost_report',
          email,
          unsub_token: unsubToken,
          status: 'sending',
          created_at: now.toISOString(),
        })
      } catch {
        skippedAlreadySent++
        continue
      }

      const { subject, html } = reportHtml(row, unsubToken)
      const result = await sendEmail(email, subject, html, FROM)
      await relayRef
        .set({ status: result.sent ? 'sent' : 'failed', ...(result.error ? { provider_error: result.error } : {}), sent_at: new Date().toISOString() }, { merge: true })
        .catch(() => {})

      if (result.sent) {
        sent++
        // arrayUnion: an event relay racing this cron can't have its cap stamp
        // erased by a whole-array overwrite from our run-start snapshot.
        await adminDb
          .collection('directory_listings')
          .doc(lid)
          .set(
            { last_ghost_report_at: now.toISOString(), relay_sent_at: FieldValue.arrayUnion(now.toISOString()) },
            { merge: true }
          )
          .catch(() => {})
      }
    }

    await reportSuccess('cron:ghost-reports')
    return NextResponse.json({
      ok: true,
      dryRun,
      period,
      candidates: candidateIds.length,
      sent,
      skipped_not_eligible: skippedNotEligible,
      skipped_recent_report: skippedRecentReport,
      skipped_suppressed: skippedSuppressed,
      skipped_capped: skippedCapped,
      skipped_already_sent: skippedAlreadySent,
      ...(dryRun ? { preview } : {}),
    })
  } catch (error: any) {
    await reportFailure('cron:ghost-reports', error)
    return NextResponse.json({ error: 'Ghost reports failed' }, { status: 500 })
  }
}
