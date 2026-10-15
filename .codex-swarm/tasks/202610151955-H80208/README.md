---
id: "202610151955-H80208"
title: "Forensic audit of recurring Stripe editor commissions"
status: "DONE"
priority: "high"
owner: "REVIEWER"
depends_on: []
tags: ["stripe", "connect", "commissions", "audit"]
commit: { hash: "144640c8a770c5a52764f14a202c2fbbf0351a7b", message: "🔍 H80208 document missing recurring editor commission and exact catch-up liability" }
comments:
  - { author: "REVIEWER", body: "Start: trace the active 9.99 USD subscription across Stripe invoices, metadata, commission ledger, Connect transfers, and editor payouts; calculate any catch-up amount without changing settings or moving funds." }
  - { author: "REVIEWER", body: "verified: reconciled the .99 subscription across Stripe invoices, production finance, Connect transfer and bank payout evidence | details: identified a missing September renewal commission of .50 and documented the nested subscription reference root cause without moving funds." }
doc_version: 2
doc_updated_at: "2026-10-15T20:02:03+00:00"
doc_updated_by: "agentctl"
description: "Read-only trace of the active $9.99 monthly subscription across invoices, payment intents, charges, subscription attribution, commission ledger entries, Connect transfers, holds, and bank payouts. Determine whether renewals were paid, held, omitted, or not yet due; calculate the exact editor catch-up amount without initiating any transfer or payout."
---
## Summary

Read-only forensic reconciliation found one missing editor residual commission. The active USD 9.99/month Founding subscription produced two successful paid invoices: the originating payment on 2026-08-21 and a renewal on 2026-09-21. Only the originating USD 4.50 editor share was accrued, transferred, and paid to the connected account. The September renewal produced no commission ledger row or Stripe Connect transfer. Exact catch-up principal is USD 4.50, subject to separate approval before any money movement.

## Context

Evidence was collected read-only on 2026-10-15 from the authenticated live CityBeat Stripe dashboard, production CityBeat finance and payout-settings endpoints, and repository source/history. The subscription is active, started 2026-08-21, bills USD 9.99 monthly, and has its next invoice scheduled for 2026-10-21. Subscription metadata attributes the sale to the configured editor UID. Production payout settings have been residual since 2026-07-31, before both customer payments.

## Scope

Reconciled the single active USD 9.99 monthly subscription, both paid invoices, Stripe payment and availability timing, editor connected-account transfer and bank-payout history, CityBeat incoming-payment and outgoing-payout ledgers, residual configuration, hold and payout-cycle rules, invoice webhook handler, and future billing date. No Stripe, Firestore, payout, bank, subscription, customer, or production setting was changed.

## Risks

HIGH: renewal invoices are recorded in production with subscription_id null even though Stripe visibly links them to the subscription. The webhook code resolves only invoice.subscription; when that field is absent it returns before residual commission accrual. This is consistent with newer Stripe invoice payloads that nest subscription data under the invoice parent object. Until corrected and regression-tested, every renewal can collect customer money without creating payee commission. HIGH: the September editor liability of USD 4.50 is absent from the ledger and finance summary, so dashboards understate commission owed. MEDIUM: platform automatic payout behavior can remove funds before delayed commission repair; platform payout settings are outside this read-only task. No refund, dispute, failed payment, or later Stripe transfer explains the missing share.

## Verify Steps

1. Stripe Subscriptions showed exactly one active subscription at USD 9.99/month, started 2026-08-21, with paid invoices dated 2026-08-21 and 2026-09-21 and the next USD 9.99 invoice scheduled for 2026-10-21. 2. September invoice NNR2MHK0-0002 and its payment both show Paid/Succeeded, USD 9.99 gross, USD 0.59 fee, USD 9.40 net, and funds available 2026-09-23. 3. The editor Connect account shows lifetime volume USD 4.50, one USD 4.50 transfer on 2026-08-28, and one USD 4.50 bank payout initiated 2026-08-30; there is no September transfer or payout. 4. Production /api/admin/finance reports USD 19.98 collected, USD 4.50 paid out, exactly one outgoing directory row at 45%, and both invoice rows with subscription_id null. 5. Production /api/admin/payout-settings reports residual mode updated 2026-07-31, no split override, and the configured editor UID. 6. Current split logic assigns 45% to an editor-sold directory payment: round(999 x 0.45) = 450 cents. The September sale cleared on 2026-09-23, matured after the seven-day hold, and was due on the 2026-10-01 cycle. 7. Code inspection identified the early return in payResidualCommissionIfDue when stripeObjectId(invoice.subscription) is empty, while recordPayment stores the same missing field as null. 8. Local direct Firestore access was denied by IAM and local Stripe credentials returned no live invoice inventory, so authoritative live checks used the authenticated dashboard and production read-only admin endpoints.

## Rollback Plan

This audit changed no financial or production state. Revert only its documentation commit if contrary evidence appears. Remediation should add a version-compatible invoice subscription resolver, backfill the missing September ledger row idempotently, verify no other paid renewals were skipped, then obtain explicit approval before issuing the USD 4.50 catch-up transfer.

## Notes

Invoice reconciliation: 2026-08-21 origin, USD 9.99 paid, editor commission USD 4.50 paid; 2026-09-21 renewal, USD 9.99 paid and available 2026-09-23, expected editor commission USD 4.50, no ledger row/transfer/payout, currently overdue; 2026-10-21 next invoice, not yet charged and therefore no commission due. Recommendation: keep the task DOING until the documented audit commit is accepted, then mark the audit DONE. A separate implementation task should repair invoice subscription extraction and safely backfill the missing liability. Never initiate the catch-up transfer without action-time approval.

