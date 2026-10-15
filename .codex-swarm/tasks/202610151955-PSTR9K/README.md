---
id: "202610151955-PSTR9K"
title: "Implement monthly connected-payee payout statements"
status: "DOING"
priority: "high"
owner: "CODER"
depends_on: ["202610151955-H80208", "202610151955-D5BBRV"]
tags: ["code", "backend", "email", "reporting", "stripe"]
verify: ["npm --prefix apps/web test", "npm --prefix apps/web run type-check"]
comments:
  - { author: "CODER", body: "Start: implement privacy-safe, idempotent monthly connected-payee statements with dry-run, audit visibility, scheduler integration, and deterministic tests." }
doc_version: 2
doc_updated_at: "2026-10-15T20:07:14+00:00"
doc_updated_by: "agentctl"
description: "Implement automated monthly statements and email notifications for every connected payee, including attributed customer payments, gross amount, rate, commission earned, transfers, payout dates and statuses, refunds, disputes, adjustments, outstanding balance, reporting period, and year-to-date totals. Ensure idempotent generation, privacy-safe delivery, audit records, and no creation or movement of funds."
---
## Summary

Implemented automated previous-calendar-month commission and payout statements for every Stripe connected payee, with privacy-safe email delivery, dry-run previews, retry-safe idempotency, admin audit visibility, and scheduler liveness coverage.

## Context

Connected editors and future payees need a clear monthly record of attributed sales, earned commission, transfers, payouts, adjustments, outstanding amounts, and year-to-date totals.

## Scope

Added a pure statement engine that isolates each payee and reports attributed gross source payments when available; role, service and commission rate; earned, refund/dispute adjustments, held, due, transferred, reversed and outstanding amounts; stored Stripe transfer and bank-payout identifiers/status/dates; reporting-period and YTD totals. Added a CRON_SECRET-protected monthly route scheduled for the 2nd, monthly-report preference checks, no-send dry-run behavior, atomic one-send-per-payee-period reservations with failed/stale retry, durable audit records, and a 2FA-protected admin read endpoint. The route never calls Stripe or creates/moves funds and fails closed if a financial ledger scan is truncated.

## Risks

Statements depend on CityBeat's stored ledger. Bank payout details are explicitly shown as not recorded unless a payout identifier/status/date exists; a Connect transfer is never represented as a bank deposit. The checked-in scheduler job still requires infrastructure deployment, and live Cloud Scheduler inventory could not be listed because the active gcloud principal lacks cloudscheduler.jobs.list. Email failures remain retryable and sent/sending deliveries are deduplicated.

## Verify Steps

Passed: npx tsx --test apps/web/src/lib/payout-statements.test.ts apps/web/src/lib/cron-cadence.test.ts apps/web/src/lib/ops-health.test.ts (36/36); npm test (639/639 across web and lib); npm --prefix apps/web run type-check. The task's npm --prefix apps/web test command is not available because apps/web declares no test script; the repository test runner is npm test. Live scheduler listing was attempted but denied by cloudscheduler.jobs.list IAM.

## Rollback Plan

Remove or disable the citybeat-payout-statements scheduler entry, revert the cron/admin routes and statement module, and remove its ops-health expectation. Preserve payout_statement_deliveries as audit evidence; no rollback moves money or changes Stripe.

## Notes

No real email was sent, no Stripe setting was changed, no transfer or payout was created, and nothing was deployed. The scheduler contract runs at 10:00 America/Chihuahua on day 2 of each month and reports the prior complete UTC calendar month.

