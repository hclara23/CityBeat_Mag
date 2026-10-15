import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { sendEmail } from '@/lib/email'
import { getNotifyPrefs } from '@/lib/notify-prefs'
import { reportCronAuthRejected, reportFailure, reportSuccess } from '@/lib/alerts'
import { scanCollection } from '@/lib/firestore-scan'
import {
  buildPayoutStatement,
  payoutStatementHtml,
  previousCalendarMonth,
  statementDeliveryId,
  type StatementPayment,
  type StatementTransfer,
} from '@/lib/payout-statements'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

const FROM = process.env.REPORTS_FROM_EMAIL || 'CityBeat <hello@citybeatmag.co>'

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`
}

async function reserveDelivery(ref: FirebaseFirestore.DocumentReference, data: Record<string, unknown>) {
  return adminDb.runTransaction(async (transaction) => {
    const current = await transaction.get(ref)
    const existing = current.exists ? (current.data() as any) : null
    const reservedMs = Date.parse(String(existing?.reserved_at || ''))
    const stale = Number.isFinite(reservedMs) && Date.now() - reservedMs > 60 * 60 * 1000
    if (existing && existing.status !== 'failed' && !(existing.status === 'sending' && stale)) return false
    transaction.set(ref, { ...data, status: 'sending', attempts: FieldValue.increment(1), reserved_at: new Date().toISOString() }, { merge: true })
    return true
  })
}

// Sends one privacy-safe statement per connected payee for the PREVIOUS full
// calendar month. This route is reporting-only: it never creates a Stripe
// transfer, payout, refund, or adjustment.
export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    await reportCronAuthRejected('cron:payout-statements', request.headers.get('authorization'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const params = new URL(request.url).searchParams
  const dryRun = params.get('dryRun') === '1'
  const requestedPeriod = params.get('period')
  const period = previousCalendarMonth(new Date())
  if (requestedPeriod && /^\d{4}-\d{2}$/.test(requestedPeriod)) {
    const start = new Date(`${requestedPeriod}-01T00:00:00.000Z`)
    period.key = requestedPeriod
    period.start = start.toISOString()
    period.end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)).toISOString()
  }

  try {
    const transfers: StatementTransfer[] = []
    const payments: StatementPayment[] = []
    const [accounts, transferScan, paymentScan] = await Promise.all([
      adminDb.collection('stripe_connected_accounts').get(),
      scanCollection(adminDb.collection('transfers'), (doc) => transfers.push({ id: doc.id, ...(doc.data() as any) })),
      scanCollection(adminDb.collection('payments'), (doc) => payments.push({ id: doc.id, ...(doc.data() as any) })),
    ])
    // An incomplete financial ledger must never produce an authoritative-looking
    // statement. Page ops and retry after the scan capacity is increased.
    if (transferScan.truncated || paymentScan.truncated) {
      throw new Error(`financial_ledger_scan_truncated: transfers=${transferScan.scanned}, payments=${paymentScan.scanned}`)
    }
    const payeeIds = accounts.docs.map((d) => d.id).filter(Boolean)
    const profileDocs = payeeIds.length
      ? await adminDb.getAll(...payeeIds.map((id) => adminDb.collection('profiles').doc(id)))
      : []
    const profiles = new Map(profileDocs.filter((d) => d.exists).map((d) => [d.id, d.data() as any]))

    const summary = { payees: payeeIds.length, sent: 0, failed: 0, previewed: 0, skipped_no_email: 0, skipped_opted_out: 0, skipped_already_sent: 0 }
    for (const payeeId of payeeIds) {
      const profile = profiles.get(payeeId)
      if (!profile?.email) { summary.skipped_no_email++; continue }
      if (!getNotifyPrefs(profile).monthly_report) { summary.skipped_opted_out++; continue }
      const statement = buildPayoutStatement({ payeeUserId: payeeId, period, transfers, payments })
      const deliveryId = statementDeliveryId(payeeId, period.key)
      if (dryRun) { summary.previewed++; continue }

      const ref = adminDb.collection('payout_statement_deliveries').doc(deliveryId)
      const reserved = await reserveDelivery(ref, {
        payee_user_id: payeeId,
        payee_email: String(profile.email).toLowerCase(),
        period: period.key,
        period_start: period.start,
        period_end: period.end,
        currency: statement.currency,
        totals: statement.totals,
        line_count: statement.lines.length,
        statement,
      })
      if (!reserved) { summary.skipped_already_sent++; continue }

      const result = await sendEmail(
        String(profile.email),
        `CityBeat payout statement · ${period.key}`,
        payoutStatementHtml(statement),
        FROM
      )
      await ref.set({
        status: result.sent ? 'sent' : 'failed',
        provider_error: result.error || null,
        delivered_at: result.sent ? new Date().toISOString() : null,
        last_attempt_at: new Date().toISOString(),
      }, { merge: true })
      if (result.sent) summary.sent++
      else summary.failed++
    }

    if (!dryRun) await reportSuccess('cron:payout-statements')
    return NextResponse.json({ ok: true, dry_run: dryRun, period: period.key, ...summary, scans_truncated: false })
  } catch (error) {
    await reportFailure('cron:payout-statements', error)
    return NextResponse.json({ error: 'Payout statements failed' }, { status: 500 })
  }
}
