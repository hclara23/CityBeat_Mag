import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { sendEmail } from '@/lib/email'
import { scanCollection } from '@/lib/firestore-scan'
import {
  buildPayoutStatement,
  payoutStatementHtml,
  statementDeliveryId,
  type PayoutStatementPeriod,
  type StatementPayment,
  type StatementTransfer,
} from '@/lib/payout-statements'

const FROM = process.env.REPORTS_FROM_EMAIL || 'CityBeat <hello@citybeatmag.co>'

async function reserveDelivery(ref: FirebaseFirestore.DocumentReference, data: Record<string, unknown>) {
  return adminDb.runTransaction(async (transaction) => {
    const current = await transaction.get(ref)
    const existing = current.exists ? (current.data() as any) : null
    const reservedMs = Date.parse(String(existing?.reserved_at || ''))
    const stale = Number.isFinite(reservedMs) && Date.now() - reservedMs > 60 * 60 * 1000
    if (existing && existing.status !== 'failed' && !(existing.status === 'sending' && stale)) return false
    transaction.set(
      ref,
      { ...data, status: 'sending', attempts: FieldValue.increment(1), reserved_at: new Date().toISOString() },
      { merge: true }
    )
    return true
  })
}

export async function deliverPayoutStatements(params: {
  period: PayoutStatementPeriod
  payeeUserIds?: string[]
  dryRun?: boolean
}) {
  const transfers: StatementTransfer[] = []
  const payments: StatementPayment[] = []
  const [accounts, transferScan, paymentScan] = await Promise.all([
    adminDb.collection('stripe_connected_accounts').get(),
    scanCollection(adminDb.collection('transfers'), (doc) => transfers.push({ id: doc.id, ...(doc.data() as any) })),
    scanCollection(adminDb.collection('payments'), (doc) => payments.push({ id: doc.id, ...(doc.data() as any) })),
  ])
  if (transferScan.truncated || paymentScan.truncated) {
    throw new Error(`financial_ledger_scan_truncated: transfers=${transferScan.scanned}, payments=${paymentScan.scanned}`)
  }

  const connectedIds = new Set(accounts.docs.map((d) => d.id).filter(Boolean))
  const requestedIds = params.payeeUserIds
    ? [...new Set(params.payeeUserIds.filter((id) => connectedIds.has(id)))]
    : [...connectedIds]
  const profileDocs = requestedIds.length
    ? await adminDb.getAll(...requestedIds.map((id) => adminDb.collection('profiles').doc(id)))
    : []
  const profiles = new Map(profileDocs.filter((d) => d.exists).map((d) => [d.id, d.data() as any]))
  const summary = {
    payees: requestedIds.length,
    sent: 0,
    failed: 0,
    previewed: 0,
    skipped_no_email: 0,
    skipped_no_activity: 0,
    skipped_already_sent: 0,
  }

  for (const payeeId of requestedIds) {
    const profile = profiles.get(payeeId)
    if (!profile?.email) {
      summary.skipped_no_email++
      continue
    }
    const statement = buildPayoutStatement({
      payeeUserId: payeeId,
      period: params.period,
      transfers,
      payments,
    })
    // A cycle statement accompanies money actually transferred in this period.
    // This also makes a broad retry safe: connected payees with no payout are
    // not emailed an empty financial statement.
    if (statement.totals.paid <= 0) {
      summary.skipped_no_activity++
      continue
    }
    if (params.dryRun) {
      summary.previewed++
      continue
    }

    const deliveryId = statementDeliveryId(payeeId, params.period.key)
    const ref = adminDb.collection('payout_statement_deliveries').doc(deliveryId)
    const reserved = await reserveDelivery(ref, {
      payee_user_id: payeeId,
      payee_email: String(profile.email).toLowerCase(),
      period: params.period.key,
      period_start: params.period.start,
      period_end: params.period.end,
      currency: statement.currency,
      totals: statement.totals,
      line_count: statement.lines.length,
      statement,
      delivery_kind: 'payout_cycle',
    })
    if (!reserved) {
      summary.skipped_already_sent++
      continue
    }

    const result = await sendEmail(
      String(profile.email),
      `CityBeat commission statement · ${params.period.label}`,
      payoutStatementHtml(statement),
      FROM
    )
    await ref.set(
      {
        status: result.sent ? 'sent' : 'failed',
        provider_error: result.error || null,
        delivered_at: result.sent ? new Date().toISOString() : null,
        last_attempt_at: new Date().toISOString(),
      },
      { merge: true }
    )
    if (result.sent) summary.sent++
    else summary.failed++
  }

  return { ...summary, scans_truncated: false }
}
