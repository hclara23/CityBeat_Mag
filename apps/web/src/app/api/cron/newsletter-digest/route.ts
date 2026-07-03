import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { getPublishedArticles } from '@/lib/articles'
import { sendEmail } from '@/lib/email'
import { reportFailure, reportSuccess } from '@/lib/alerts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://citybeatmag.co'
const FROM = process.env.NEWSLETTER_FROM_EMAIL || 'CityBeat <hello@citybeatmag.co>'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

type Sponsor = { sponsor_name?: string; title?: string; link_url?: string; image_url?: string } | null

// A single sellable "Sponsored by" unit: the first active ad_banners doc with
// placement 'newsletter'. Absent → the digest renders without it.
async function getNewsletterSponsor(): Promise<Sponsor> {
  try {
    const snap = await adminDb
      .collection('ad_banners')
      .where('placement', '==', 'newsletter')
      .where('is_active', '==', true)
      .limit(1)
      .get()
    return snap.empty ? null : (snap.docs[0].data() as any)
  } catch {
    return null
  }
}

function sponsorHtml(sponsor: Sponsor, locale: 'en' | 'es') {
  if (!sponsor) return ''
  const label = locale === 'es' ? 'Patrocinado por' : 'Sponsored by'
  const name = sponsor.sponsor_name || sponsor.title || ''
  if (!name) return ''
  const img = sponsor.image_url
    ? `<img src="${sponsor.image_url}" alt="${name}" width="560" style="width:100%;max-width:560px;border-radius:8px;display:block;margin:6px 0" />`
    : ''
  const inner = `${img}<span style="font-weight:800;color:#0a0a0a">${name}</span>`
  return `<tr><td style="padding:0 0 26px;border-top:1px solid #eee;padding-top:16px">
    <p style="color:#999;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px">${label}</p>
    ${sponsor.link_url ? `<a href="${sponsor.link_url}" style="text-decoration:none">${inner}</a>` : inner}
  </td></tr>`
}

function digestHtml(articles: any[], email: string, locale: 'en' | 'es', sponsor: Sponsor = null) {
  const isEs = locale === 'es'
  const unsub = `${APP_URL}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}`
  const items = articles
    .map((a) => {
      const title = isEs ? a.titleES || a.title : a.title
      const excerpt = (isEs ? a.excerptES || a.excerpt : a.excerpt) || ''
      const url = `${APP_URL}/${locale}/stories/${a.slug}`
      const img = a.image
        ? `<img src="${a.image}" alt="" width="560" style="width:100%;max-width:560px;border-radius:8px;display:block;margin-bottom:10px" />`
        : ''
      return `<tr><td style="padding:0 0 26px">
        ${img}
        <a href="${url}" style="color:#0a0a0a;text-decoration:none;font-size:20px;font-weight:800;line-height:1.25">${title}</a>
        <p style="color:#444;font-size:14px;line-height:1.5;margin:6px 0 8px">${excerpt}</p>
        <a href="${url}" style="color:#0891b2;font-weight:700;font-size:13px;text-decoration:none">${isEs ? 'Leer más →' : 'Read more →'}</a>
      </td></tr>`
    })
    .join('')

  return `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111">
    <h1 style="font-weight:900;font-size:28px;margin:0 0 4px">city<span style="color:#0891b2;font-style:italic">BEat</span></h1>
    <p style="color:#666;font-size:13px;margin:0 0 24px">${isEs ? 'Lo último de El Paso, Las Cruces y Ciudad Juárez' : 'The latest from El Paso, Las Cruces & Ciudad Juárez'}</p>
    <table style="width:100%;border-collapse:collapse">${items}${sponsorHtml(sponsor, locale)}</table>
    <hr style="border:none;border-top:1px solid #eee;margin:8px 0 16px" />
    <p style="font-size:11px;color:#999;line-height:1.5">
      ${isEs ? 'Recibes esto porque te suscribiste a CityBeat.' : 'You receive this because you subscribed to CityBeat.'}<br/>
      <a href="${unsub}" style="color:#999">${isEs ? 'Cancelar suscripción' : 'Unsubscribe'}</a> ·
      <a href="${APP_URL}/${locale}" style="color:#999">citybeatmag.co</a>
    </p>
  </div>`
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const dryRun = searchParams.get('dryRun') === '1'
  const max = Math.min(Number(searchParams.get('limit')) || 1000, 2000)

  // Recent published stories (last 7 days), newest first, top 6.
  const all = await getPublishedArticles().catch(() => [])
  const weekAgo = Date.now() - 7 * 86400000
  const recent = all
    .filter((a: any) => {
      const t = Date.parse(a.publishedAt)
      return Number.isNaN(t) || t >= weekAgo
    })
    .sort((a: any, b: any) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0))
    .slice(0, 6)

  if (recent.length === 0) {
    return NextResponse.json({ ok: true, skipped: 'no_recent_stories' })
  }

  // Active subscribers.
  const subsSnap = await adminDb.collection('newsletter_subscribers').get().catch(() => ({ docs: [] as any[] }))
  const subs = (subsSnap.docs as any[])
    .map((d) => d.data())
    .filter((s) => s.email && s.status !== 'unsubscribed')
    .slice(0, max)

  const subject = recent[0]
    ? `CityBeat: ${recent[0].title}`
    : 'CityBeat — this week in the borderland'

  const sponsor = await getNewsletterSponsor()

  let sent = 0
  let failed = 0
  if (!dryRun) {
    for (const s of subs) {
      const locale: 'en' | 'es' = s.locale === 'es' ? 'es' : 'en'
      try {
        const r = await sendEmail(s.email, subject, digestHtml(recent, s.email, locale, sponsor), FROM)
        if (r.sent) sent++
        else failed++
      } catch {
        failed++
      }
    }
    // If delivery is mostly failing (provider outage, bad key), tell a human.
    if (failed > 0 && failed >= sent) {
      await reportFailure('cron:newsletter-digest', new Error(`digest delivery failing: ${failed} failed vs ${sent} sent`), {
        recipients: subs.length,
      })
    }
  }

  // Don't declare recovery on a run whose delivery mostly failed (the
  // reportFailure above would be instantly contradicted).
  if (!(failed > 0 && failed >= sent)) await reportSuccess('cron:newsletter-digest')
  return NextResponse.json({
    ok: true,
    dryRun,
    stories: recent.length,
    recipients: subs.length,
    sent,
    failed,
    sponsored: Boolean(sponsor),
    ...(dryRun ? { preview_subject: subject, preview_html: digestHtml(recent, 'preview@citybeatmag.co', 'en', sponsor) } : {}),
  })
}
