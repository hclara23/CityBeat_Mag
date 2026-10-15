---
id: "202610151955-KPZ1PN"
title: "Verify recurring commissions payouts and monthly statements"
status: "DOING"
priority: "high"
owner: "TESTER"
depends_on: ["202610151955-098Z3A", "202610151955-PSTR9K"]
tags: ["testing", "stripe", "reconciliation"]
verify: ["npm test", "npm --prefix apps/web run type-check"]
comments:
  - { author: "TESTER", body: "Start: verify recurring renewal commission attribution and idempotency, platform manual-payout isolation, catch-up ledger behavior, monthly statement totals and privacy, scheduler cadence and ops health, plus payout refund and reconciliation regressions; run focused, full web, repository, and type-check validation without external financial or email side effects" }
doc_version: 2
doc_updated_at: "2026-10-15T19:56:56+00:00"
doc_updated_by: "agentctl"
description: "Reconcile the forensic findings and implemented behavior end to end: recurring renewal attribution, commission calculation, available-balance timing, Connect transfer and payout-state handling, platform manual-payout isolation, statement totals, idempotency, refunds and disputes, and notification delivery. Use tests and read-only production evidence; do not initiate payments, transfers, or payouts."
---
## Summary

Verify and reconcile the complete recurring commission, payout-schedule, and monthly-statement workflow before release.

## Context

The audit, payout configuration, and statement implementation must operate as one coherent workflow without moving unauthorized funds or conflating Connect transfers with bank payouts.

## Scope

Test renewal attribution, commission math, available-balance timing, transfer and payout status handling, platform manual payout isolation, report accuracy, idempotency, refund and dispute adjustments, authorization, email delivery and retries, webhook replay, and scheduler observability. Reconcile against read-only production evidence.

## Risks

Test-mode behavior may differ from live funds availability. Production inspection must remain read-only. False confidence can arise if only first-payment paths are tested.

## Verify Steps

Run npm --prefix apps/web test and npm --prefix apps/web run type-check plus focused tests added by the implementation; document production-readiness evidence, remaining manual checks, and proof that no transfer, payout, or customer charge was initiated.

## Rollback Plan

If any reconciliation or privacy check fails, block release, restore the prior configuration where safe, disable statement sending, and preserve evidence for correction.

## Notes

Depends on both configuration and reporting. Verification must explicitly cover recurring invoices after the initial sale.

