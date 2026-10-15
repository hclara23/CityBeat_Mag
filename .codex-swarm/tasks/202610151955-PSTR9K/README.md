---
id: "202610151955-PSTR9K"
title: "Implement monthly connected-payee payout statements"
status: "TODO"
priority: "high"
owner: "CODER"
depends_on: ["202610151955-H80208", "202610151955-D5BBRV"]
tags: ["code", "backend", "email", "reporting", "stripe"]
verify: ["npm --prefix apps/web test", "npm --prefix apps/web run type-check"]
doc_version: 2
doc_updated_at: "2026-10-15T19:56:55+00:00"
doc_updated_by: "agentctl"
description: "Implement automated monthly statements and email notifications for every connected payee, including attributed customer payments, gross amount, rate, commission earned, transfers, payout dates and statuses, refunds, disputes, adjustments, outstanding balance, reporting period, and year-to-date totals. Ensure idempotent generation, privacy-safe delivery, audit records, and no creation or movement of funds."
---
## Summary

Build monthly, auditable commission and payout statements with privacy-safe email notifications for every connected payee.

## Context

Connected editors and future payees need a clear monthly record of attributed sales, earned commission, transfers, payouts, adjustments, outstanding amounts, and year-to-date totals.

## Scope

Implement statement-period calculations, idempotent generation and sending, payee-scoped access, email delivery, durable audit status, refunds and dispute adjustments, transfer and payout states, outstanding balance, and year-to-date totals. Add operational retry and failure visibility without creating financial transactions.

## Risks

Duplicate emails, cross-payee data leakage, timezone cutoffs, late refunds, and transfer-versus-payout confusion could make statements inaccurate. Financial amounts must use integer cents and deterministic period keys.

## Verify Steps

Run npm --prefix apps/web test and npm --prefix apps/web run type-check; add focused tests for period boundaries, idempotency, multiple payees, refunds, disputes, pending amounts, year-to-date totals, authorization, and email retry behavior.

## Rollback Plan

Disable the statement scheduler or feature flag, stop new sends, preserve existing audit records, and revert application changes. Corrected statements must be versioned rather than silently overwritten.

## Notes

Statement delivery reports financial activity only and must never trigger transfers or payouts. Cadence and terminology should follow task 202610151955-D5BBRV.

