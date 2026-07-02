import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { sendEmail } from '@/lib/email'
import { reportFailure } from '@/lib/alerts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'
const FROM = process.env.REPORTS_FROM_EMAIL || 'CityBeat <hello@citybeatmag.co>'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

function toMs(v: any): number {
  if (!v) return 0
  if (v?.toDate) return v.toDate().getTime()
  if (typeof v === 'string') return Date.parse(v) || 0
  return 0
}

type ListingStats = {
  id: string
  name: string
  tier: string
  owner_id: string
  views: number
  leads: number
  reviews: number
}

function reportHtml(ownerListings: ListingStats[], locale: 'en' | 'es') {
  const isEs = locale === 'es'
  const anyBasic = ownerListings.some((l) => l.tier === 'basic')
  const rows = ownerListings
    .map(
      (l) => `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid #eee"><strong>${l.name}</strong><br/>
        <span style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:1px">${l.tier}</span></td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;font-size:20px;font-weight:800">${l.views}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;font-size:20px;font-weight:800">${l.leads}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;font-size:20px;font-weight:800">${l.reviews}</td>
    </tr>`
    )
    .join('')

  const upsell = anyBasic
    ? `<p style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;font-size:13px;color:#92400e">
        ${isEs
          ? 'Tu ficha Basic no muestra los datos de contacto de tus leads. Mejora a <strong>Premium ($19/mes)</strong> para recibir cada lead al instante y aparecer más arriba en el directorio.'
          : "Your Basic listing doesn't reveal your leads' contact details. Upgrade to <strong>Premium ($19/mo)</strong> to get every lead instantly and rank higher in the directory."}
        <br/><a href="${APP_URL}/${locale}/dashboard" style="color:#92400e;font-weight:800">${isEs ? 'Mejorar ahora →' : 'Upgrade now →'}</a></p>`
    : ''

  return `<div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111">
  <h1 style="font-weight:900;font-size:24px;margin:0 0 4px">city<span style="color:#0891b2;font-style:italic">BEat</span></h1>
  <p style="color:#666;font-size:14px;margin:0 0 20px">${isEs ? 'Tu reporte mensual — últimos 30 días' : 'Your monthly report — last 30 days'}</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <thead><tr style="text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999">
      <th style="padding:8px 12px;text-align:left">${isEs ? 'Negocio' : 'Business'}</th>
      <th style="padding:8px 12px">${isEs ? 'Vistas' : 'Views'}</th>
      <th style="padding:8px 12px">Leads</th>
      <th style="padding:8px 12px">${isEs ? 'Reseñas' : 'Reviews'}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${upsell}
  <p style="margin:20px 0"><a href="${APP_URL}/${locale}/dashboard" style="background:#22d3ee;color:#000;font-weight:800;padding:10px 20px;border-radius:8px;text-decoration:none;text-transform:uppercase;letter-spacing:1px;font-size:12px">${isEs ? 'Ver mi panel' : 'Open my dashboard'}</a></p>
  <p style="font-size:11px;color:#999">${isEs ? 'Recibes esto porque tienes una ficha verificada en CityBeat.' : 'You receive this because you own a verified listing on CityBeat.'}</p>
</div>`
}

// Monthly ROI report to every claimed-listing owner: views, leads, reviews per
// listing over the last 30 days. Owners who can SEE the value churn less; basic
// owners get the Premium upsell alongside their real numbers.
export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const dryRun = searchParams.get('dryRun') === '1'

  try {
    const since = Date.now() - 30 * 86400000
    const sinceDay = new Date(since).toISOString().slice(0, 10)

    // Approved listings with owners.
    const listingsSnap = await adminDb.collection('directory_listings').where('claim_status', '==', 'approved').get()
    const listings = listingsSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((l: any) => l.owner_id)
    if (listings.length === 0) return NextResponse.json({ ok: true, skipped: 'no_claimed_listings' })

    // Page views: one range query over the window, aggregated in memory by
    // listing id extracted from the path (/{locale}/directory/{id}).
    const viewsById = new Map<string, number>()
    const eventsSnap = await adminDb.collection('analytics_events').where('day', '>=', sinceDay).get()
    for (const doc of eventsSnap.docs) {
      const path = String((doc.data() as any).path || '')
      const m = path.match(/^\/(?:en|es)\/directory\/([^/]+)$/)
      if (m) viewsById.set(m[1], (viewsById.get(m[1]) || 0) + 1)
    }

    // Leads + reviews in the window, aggregated in memory.
    const leadsById = new Map<string, number>()
    const leadsSnap = await adminDb.collection('quote_requests').get()
    for (const doc of leadsSnap.docs) {
      const x = doc.data() as any
      if (toMs(x.created_at) >= since && x.listing_id) {
        leadsById.set(x.listing_id, (leadsById.get(x.listing_id) || 0) + 1)
      }
    }
    const reviewsById = new Map<string, number>()
    const reviewsSnap = await adminDb.collection('directory_reviews').get()
    for (const doc of reviewsSnap.docs) {
      const x = doc.data() as any
      if (toMs(x.created_at) >= since && x.listing_id) {
        reviewsById.set(x.listing_id, (reviewsById.get(x.listing_id) || 0) + 1)
      }
    }

    // Group listings per owner → one email per owner.
    const byOwner = new Map<string, ListingStats[]>()
    for (const l of listings as any[]) {
      const stats: ListingStats = {
        id: l.id,
        name: l.name || 'Your business',
        tier: l.tier || 'basic',
        owner_id: l.owner_id,
        views: viewsById.get(l.id) || 0,
        leads: leadsById.get(l.id) || 0,
        reviews: reviewsById.get(l.id) || 0,
      }
      const arr = byOwner.get(l.owner_id) || []
      arr.push(stats)
      byOwner.set(l.owner_id, arr)
    }

    let sent = 0
    let skippedNoEmail = 0
    for (const [ownerId, ownerListings] of byOwner) {
      const profile = await adminDb.collection('profiles').doc(ownerId).get().catch(() => null)
      const p = profile?.exists ? (profile.data() as any) : null
      const email = p?.email
      if (!email) {
        skippedNoEmail++
        continue
      }
      const locale: 'en' | 'es' = p?.locale === 'es' ? 'es' : 'en'
      const subject =
        locale === 'es'
          ? `Tu reporte CityBeat: ${ownerListings.reduce((s, l) => s + l.views, 0)} vistas este mes`
          : `Your CityBeat report: ${ownerListings.reduce((s, l) => s + l.views, 0)} views this month`
      if (!dryRun) {
        const r = await sendEmail(email, subject, reportHtml(ownerListings, locale), FROM)
        if (r.sent) sent++
      } else {
        sent++
      }
    }

    return NextResponse.json({ ok: true, dryRun, owners: byOwner.size, sent, skipped_no_email: skippedNoEmail })
  } catch (error) {
    await reportFailure('cron:owner-reports', error)
    return NextResponse.json({ error: 'Owner reports failed' }, { status: 500 })
  }
}
