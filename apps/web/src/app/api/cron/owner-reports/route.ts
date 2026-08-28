import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { sendEmail } from '@/lib/email'
import { getNotifyPrefs } from '@/lib/notify-prefs'
import { notifyUser } from '@/lib/user-notifications'
import { reportFailure, reportSuccess } from '@/lib/alerts'
import { dayKey, daysAgoKey, totalsForRange, type DailyStatRow } from '@/lib/listing-analytics'

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
  clicks: number
  leads: number
  reviews: number
  viewsPrev: number
  leadsPrev: number
  rating: number | null
}

// A "vs previous 30 days" delta chip.
function delta(cur: number, prev: number): string {
  if (prev <= 0) return cur > 0 ? '<span style="color:#059669;font-size:11px">▲ new</span>' : ''
  const p = Math.round(((cur - prev) / prev) * 100)
  if (p === 0) return '<span style="color:#999;font-size:11px">—</span>'
  const up = p > 0
  return `<span style="color:${up ? '#059669' : '#dc2626'};font-size:11px">${up ? '▲' : '▼'} ${Math.abs(p)}%</span>`
}

function reportHtml(ownerListings: ListingStats[], locale: 'en' | 'es') {
  const isEs = locale === 'es'
  const anyBasic = ownerListings.some((l) => l.tier === 'basic')
  const rows = ownerListings
    .map(
      (l) => `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid #eee"><strong>${l.name}</strong><br/>
        <span style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:1px">${l.tier}${l.rating ? ` · ★ ${l.rating}` : ''}</span></td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center"><span style="font-size:20px;font-weight:800">${l.views}</span><br/>${delta(l.views, l.viewsPrev)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;font-size:20px;font-weight:800">${l.clicks}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center"><span style="font-size:20px;font-weight:800">${l.leads}</span><br/>${delta(l.leads, l.leadsPrev)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;font-size:20px;font-weight:800">${l.reviews}</td>
    </tr>`
    )
    .join('')

  const upsell = anyBasic
    ? `<p style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;font-size:13px;color:#92400e">
        ${isEs
          ? 'Tu ficha Basic no muestra los datos de contacto de tus leads. Mejora a <strong>Premium ($19.99/mes)</strong> para recibir cada lead al instante y aparecer más arriba en el directorio.'
          : "Your Basic listing doesn't reveal your leads' contact details. Upgrade to <strong>Premium ($19.99/mo)</strong> to get every lead instantly and rank higher in the directory."}
        <br/><a href="${APP_URL}/${locale}/dashboard" style="color:#92400e;font-weight:800">${isEs ? 'Mejorar ahora →' : 'Upgrade now →'}</a></p>`
    : ''

  return `<div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111">
  <h1 style="font-weight:900;font-size:24px;margin:0 0 4px">city<span style="color:#0891b2;font-style:italic">BEat</span></h1>
  <p style="color:#666;font-size:14px;margin:0 0 20px">${isEs ? 'Tu reporte mensual — últimos 30 días' : 'Your monthly report — last 30 days'}</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <thead><tr style="text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#999">
      <th style="padding:8px 12px;text-align:left">${isEs ? 'Negocio' : 'Business'}</th>
      <th style="padding:8px 12px">${isEs ? 'Vistas' : 'Views'}</th>
      <th style="padding:8px 12px">${isEs ? 'Clics' : 'Clicks'}</th>
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
    const now = new Date()
    // Reporting period (idempotency key component) + current vs previous windows.
    const period = dayKey(now).slice(0, 7) // YYYY-MM
    const curStart = daysAgoKey(now, 29)
    const curEnd = dayKey(now)
    const prevStart = daysAgoKey(now, 59)
    const prevEnd = daysAgoKey(now, 30)
    const curStartMs = Date.parse(curStart)

    // Approved listings with owners.
    const listingsSnap = await adminDb.collection('directory_listings').where('claim_status', '==', 'approved').get()
    const listings = listingsSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((l: any) => l.owner_id)
    if (listings.length === 0) return NextResponse.json({ ok: true, skipped: 'no_claimed_listings' })

    // Listing-scoped stats over the last 60 days (current + previous window),
    // grouped by listing — the accurate views/clicks/leads the owner CMS shows.
    const statsByListing = new Map<string, DailyStatRow[]>()
    const statsSnap = await adminDb.collection('listing_stats').where('day', '>=', prevStart).get()
    for (const doc of statsSnap.docs) {
      const x = doc.data() as DailyStatRow & { listing_id?: string }
      if (!x.listing_id) continue
      const arr = statsByListing.get(x.listing_id) || []
      arr.push(x)
      statsByListing.set(x.listing_id, arr)
    }
    // Reviews in the current window (directory_reviews is not day-aggregated).
    const reviewsById = new Map<string, number>()
    const reviewsSnap = await adminDb.collection('directory_reviews').get()
    for (const doc of reviewsSnap.docs) {
      const x = doc.data() as any
      if (toMs(x.created_at) >= curStartMs && x.listing_id) {
        reviewsById.set(x.listing_id, (reviewsById.get(x.listing_id) || 0) + 1)
      }
    }

    // Group listings per owner → one email per owner.
    const byOwner = new Map<string, ListingStats[]>()
    for (const l of listings as any[]) {
      const rows = statsByListing.get(l.id) || []
      const cur = totalsForRange(rows, curStart, curEnd)
      const prev = totalsForRange(rows, prevStart, prevEnd)
      const stats: ListingStats = {
        id: l.id,
        name: l.name || 'Your business',
        tier: l.tier || 'basic',
        owner_id: l.owner_id,
        views: cur.view,
        clicks: cur.click_website + cur.click_directions + cur.click_action,
        leads: cur.lead,
        reviews: reviewsById.get(l.id) || 0,
        viewsPrev: prev.view,
        leadsPrev: prev.lead,
        rating: typeof l.rating === 'number' ? l.rating : null,
      }
      const arr = byOwner.get(l.owner_id) || []
      arr.push(stats)
      byOwner.set(l.owner_id, arr)
    }

    let sent = 0
    let skippedNoEmail = 0
    let skippedOptedOut = 0
    let skippedAlreadySent = 0
    for (const [ownerId, ownerListings] of byOwner) {
      const profile = await adminDb.collection('profiles').doc(ownerId).get().catch(() => null)
      const p = profile?.exists ? (profile.data() as any) : null
      const email = p?.email
      if (!email) {
        skippedNoEmail++
        continue
      }
      // Honor the owner's monthly-report preference (default on).
      if (!getNotifyPrefs(p).monthly_report) {
        skippedOptedOut++
        continue
      }

      // Idempotency: one report per owner per reporting month. Reserve the slot
      // ATOMICALLY with create() (fails if the doc already exists) so a retry or
      // two concurrent runs can't both send.
      const deliveryRef = adminDb.collection('report_deliveries').doc(`${ownerId}_${period}`)

      const locale: 'en' | 'es' = p?.locale === 'es' ? 'es' : 'en'
      const totalViews = ownerListings.reduce((s, l) => s + l.views, 0)
      const subject =
        locale === 'es'
          ? `Tu reporte CityBeat: ${totalViews} vistas este mes`
          : `Your CityBeat report: ${totalViews} views this month`
      if (dryRun) {
        sent++
        continue
      }

      try {
        await deliveryRef.create({ owner_id: ownerId, period, status: 'sending', reserved_at: new Date().toISOString() })
      } catch {
        // Already reserved/sent by another run → skip (don't double-send).
        skippedAlreadySent++
        continue
      }

      const r = await sendEmail(email, subject, reportHtml(ownerListings, locale), FROM)
      // Record delivery status/provider outcome/timestamp — never claim a send
      // that didn't happen. A failed send is left NOT 'sent' so a later run can
      // retry; a persistence failure here throws to the outer catch rather than
      // silently masking a re-send.
      await deliveryRef.set(
        {
          status: r.sent ? 'sent' : 'failed',
          provider_error: r.error || null,
          listings: ownerListings.length,
          total_views: totalViews,
          delivered_at: new Date().toISOString(),
        },
        { merge: true }
      )
      if (r.sent) {
        sent++
        // First-party inbox record (email already sent above → skip the channel).
        await notifyUser({
          userId: ownerId,
          type: 'report',
          title: `Your ${period} CityBeat report is ready`,
          title_es: `Tu reporte CityBeat de ${period} está listo`,
          body: `${totalViews} views across your listings this month.`,
          body_es: `${totalViews} vistas en tus fichas este mes.`,
          link: '/dashboard',
          emailChannel: false,
        }).catch(() => {})
      }
    }

    await reportSuccess('cron:owner-reports')
    return NextResponse.json({
      ok: true,
      dryRun,
      period,
      owners: byOwner.size,
      sent,
      skipped_no_email: skippedNoEmail,
      skipped_opted_out: skippedOptedOut,
      skipped_already_sent: skippedAlreadySent,
    })
  } catch (error) {
    await reportFailure('cron:owner-reports', error)
    return NextResponse.json({ error: 'Owner reports failed' }, { status: 500 })
  }
}
