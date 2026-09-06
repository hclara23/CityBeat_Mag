import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { getPublishedArticles } from '@/lib/articles'
import { sendEmail } from '@/lib/email'
import { reportCronAuthRejected, reportFailure, reportSuccess } from '@/lib/alerts'
import { emailHash, isSuppressedStatus, mintUnsubToken, normalizeNewsletterEmail } from '@/lib/newsletter'
import { loadSuppressedHashes } from '@/lib/newsletter-server'
import { unsubHeaders } from '@/lib/unsub-headers'

const POSTAL = process.env.NEWSLETTER_POSTAL_ADDRESS || 'CityBeat Mag, El Paso, TX, USA'

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

// Every value below reaches this from a PUBLIC, token-authenticated customer
// brief and is mailed to the whole subscriber list from CityBeat's own address,
// so it must be escaped at the sink. Without this, a sponsor could break out of
// an attribute and inject markup into the newsletter — and a perfectly innocent
// name or URL containing & or a quote would render their paid ad broken.
function escapeHtml(value: unknown) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character
  )
}

function sponsorHtml(sponsor: Sponsor, locale: 'en' | 'es') {
  if (!sponsor) return ''
  const label = locale === 'es' ? 'Patrocinado por' : 'Sponsored by'
  const name = escapeHtml(sponsor.sponsor_name || sponsor.title || '')
  if (!name) return ''
  const img = sponsor.image_url
    ? `<img src="${escapeHtml(sponsor.image_url)}" alt="${name}" width="560" style="width:100%;max-width:560px;border-radius:8px;display:block;margin:6px 0" />`
    : ''
  const inner = `${img}<span style="font-weight:800;color:#0a0a0a">${name}</span>`
  return `<tr><td style="padding:0 0 26px;border-top:1px solid #eee;padding-top:16px">
    <p style="color:#999;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 6px">${label}</p>
    ${sponsor.link_url ? `<a href="${escapeHtml(sponsor.link_url)}" style="text-decoration:none">${inner}</a>` : inner}
  </td></tr>`
}

function digestHtml(articles: any[], email: string, locale: 'en' | 'es', sponsor: Sponsor = null) {
  const isEs = locale === 'es'
  // Signed, opaque unsubscribe token — never puts the email in the URL. The
  // (non-sensitive) locale hint localizes the confirmation page.
  const unsub = `${APP_URL}/api/newsletter/unsubscribe?u=${mintUnsubToken(normalizeNewsletterEmail(email))}&l=${locale}`
  const items = articles
    .map((a) => {
      // Same escaping the sponsor slot already gets: titles/excerpts are
      // written by signed-in users and re-reported from external outlets, and
      // this HTML ships to the ENTIRE subscriber list from CityBeat's address.
      const title = escapeHtml(isEs ? a.titleES || a.title : a.title)
      const excerpt = escapeHtml((isEs ? a.excerptES || a.excerpt : a.excerpt) || '')
      const url = `${APP_URL}/${locale}/stories/${encodeURIComponent(a.slug || '')}`
      const img = a.image && /^https?:\/\//.test(String(a.image))
        ? `<img src="${escapeHtml(a.image)}" alt="" width="560" style="width:100%;max-width:560px;border-radius:8px;display:block;margin-bottom:10px" />`
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
      <a href="${APP_URL}/${locale}" style="color:#999">citybeatmag.co</a><br/>
      <span style="color:#bbb">${POSTAL}</span>
    </p>
  </div>`
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    // A rejected BEARER token is our own scheduler running against a rotated
    // CRON_SECRET — the failure that silences every cron at once, before any of
    // their try/catch blocks. See reportCronAuthRejected.
    await reportCronAuthRejected('cron:newsletter-digest', request.headers.get('authorization'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
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

  // Active, non-suppressed subscribers only. Dedupe by normalized email so a
  // legacy duplicate doc can't double-send, and honor the suppression list.
  const [subsSnap, suppressed] = await Promise.all([
    adminDb.collection('newsletter_subscribers').get().catch(() => ({ docs: [] as any[] })),
    loadSuppressedHashes(),
  ])
  if (suppressed === null) {
    // Fail closed: never blast marketing when the suppression list can't be read.
    await reportFailure('cron:newsletter-digest', new Error('suppression list unavailable'))
    return NextResponse.json({ ok: false, skipped: 'suppression_unavailable' })
  }
  const seen = new Set<string>()
  const subs = (subsSnap.docs as any[])
    .map((d) => d.data())
    .map((s) => ({
      // New consent records store email_normalized/consent_locale; legacy auto-id
      // docs used email/locale. Resolve both.
      ...s,
      _email: normalizeNewsletterEmail(s.email_normalized || s.email_display || s.email),
      _locale: (s.consent_locale || s.locale) === 'es' ? 'es' : 'en',
    }))
    .filter((s) => {
      if (!s._email.includes('@')) return false
      if (isSuppressedStatus(s.status)) return false
      const eid = emailHash(s._email)
      if (suppressed.has(eid) || seen.has(eid)) return false
      seen.add(eid)
      return true
    })
    .slice(0, max)

  const subject = recent[0]
    ? `CityBeat: ${recent[0].title}`
    : 'CityBeat — this week in the borderland'

  const sponsor = await getNewsletterSponsor()

  // Send journal: without it, a mid-blast crash or a scheduler retry re-sent
  // early subscribers and skipped late ones. One doc per RUN DAY holding the
  // emailHashes already delivered; safe under the 1MB doc cap for the current
  // list size (~48KB at 2000 subscribers).
  //
  // Read as the union of the last three daily docs, not just today's. A Cloud
  // Scheduler retry or a manual re-run that lands after UTC midnight used to
  // look at a brand-new, empty journal and mail the ENTIRE list a second time.
  // Three days is wide enough for any retry of the current send and far short of
  // the weekly cadence, so next Friday's digest still goes out.
  const JOURNAL_LOOKBACK_DAYS = 3
  const dayKey = (offsetDays: number) =>
    `digest-${new Date(Date.now() - offsetDays * 86400000).toISOString().slice(0, 10)}`
  const journalRef = adminDb.collection('newsletter_send_log').doc(dayKey(0))
  const journalRefs = Array.from({ length: JOURNAL_LOOKBACK_DAYS }, (_, i) =>
    adminDb.collection('newsletter_send_log').doc(dayKey(i))
  )

  // FAIL CLOSED. This read used to be `.catch(() => null)`, which turned a
  // Firestore hiccup into an empty de-dup set and re-blasted the whole
  // subscriber list — the single most expensive mistake this job can make, and
  // one that cannot be undone once the mail is out. A missing doc is `exists:
  // false`; only a real read failure throws, so throwing means we genuinely do
  // not know who has already been mailed, and the only safe answer is not to
  // send.
  let journalSnaps
  try {
    journalSnaps = await adminDb.getAll(...journalRefs)
  } catch (error) {
    await reportFailure('cron:newsletter-digest', error, { phase: 'journal_read', recipients: subs.length })
    return NextResponse.json({ ok: false, skipped: 'journal_unavailable' })
  }
  const alreadySent = new Set<string>()
  for (const snap of journalSnaps) {
    if (!snap.exists) continue
    for (const hash of ((snap.data() as any)?.hashes as string[]) || []) alreadySent.add(hash)
  }

  let journalBuffer: string[] = []
  // Returns false when the journal could not be written. arrayUnion makes the
  // write idempotent, so a retried flush lands on the same value.
  const flushJournal = async (): Promise<boolean> => {
    if (!journalBuffer.length) return true
    const flushing = journalBuffer
    journalBuffer = []
    try {
      await journalRef.set(
        { hashes: FieldValue.arrayUnion(...flushing), updated_at: new Date().toISOString() },
        { merge: true }
      )
      return true
    } catch {
      return false
    }
  }

  let sent = 0
  let failed = 0
  let journalBroken = false
  if (!dryRun) {
    for (const s of subs) {
      const locale: 'en' | 'es' = s._locale
      try {
        const hash = emailHash(s._email)
        if (alreadySent.has(hash)) continue
        // The newsletter is the single most likely stream to be marked as spam,
        // and the one-click header is what gives a recipient the button that is
        // NOT 'report spam'. Same helper as every other stream, so the header is
        // identical across campaigns.
        const r = await sendEmail(s._email, subject, digestHtml(recent, s._email, locale, sponsor), FROM, {
          headers: unsubHeaders(s._email, locale),
        })
        if (r.sent) {
          sent++
          alreadySent.add(hash)
          journalBuffer.push(hash)
          // Stop the blast if delivery can no longer be RECORDED. This used to
          // swallow the write error and keep mailing: every subscriber sent
          // after a failed flush is one the next run has no record of, and the
          // retry mails them all again.
          if (journalBuffer.length >= 25 && !(await flushJournal())) {
            journalBroken = true
            break
          }
        }
        else failed++
      } catch {
        failed++
      }
    }
    if (!(await flushJournal())) journalBroken = true

    // If delivery is mostly failing (provider outage, bad key), tell a human.
    if (failed > 0 && failed >= sent) {
      await reportFailure('cron:newsletter-digest', new Error(`digest delivery failing: ${failed} failed vs ${sent} sent`), {
        recipients: subs.length,
      })
    }
    if (journalBroken) {
      await reportFailure(
        'cron:newsletter-digest',
        new Error(`send journal unwritable after ${sent} deliveries — run halted to avoid re-sending on retry`),
        { recipients: subs.length, sent }
      )
    }
  }

  // Don't declare recovery on a run whose delivery mostly failed, or one that
  // stopped because it could not journal (either reportFailure above would be
  // instantly contradicted).
  if (!journalBroken && !(failed > 0 && failed >= sent)) await reportSuccess('cron:newsletter-digest')
  return NextResponse.json({
    ok: true,
    dryRun,
    stories: recent.length,
    recipients: subs.length,
    sent,
    failed,
    ...(journalBroken ? { halted: 'journal_unwritable' } : {}),
    sponsored: Boolean(sponsor),
    ...(dryRun ? { preview_subject: subject, preview_html: digestHtml(recent, 'preview@citybeatmag.co', 'en', sponsor) } : {}),
  })
}
