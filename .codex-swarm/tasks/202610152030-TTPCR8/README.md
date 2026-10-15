---
id: "202610152030-TTPCR8"
title: "Verify semi-monthly commission payout workflow"
status: "DOING"
priority: "high"
owner: "TESTER"
depends_on: ["202610152030-YPJ8P9", "202610152030-FBKEDB"]
tags: ["testing", "stripe", "payouts"]
verify: ["npm test", "npm --prefix apps/web run type-check"]
comments:
  - { author: "TESTER", body: "Start: verify month-end date handling, duplicate delivery protection, refund holds, transfer/report consistency, payee-only authorization, dashboard totals, and retained platform funds." }
doc_version: 2
doc_updated_at: "2026-10-15T20:39:17+00:00"
doc_updated_by: "agentctl"
description: "Test 15th and variable month-end scheduling, leap years, clearance holds, refunds, duplicate jobs, statement consistency, payee authorization, account totals, and assurance that platform funds remain under manual payout control."
---
## Summary

Verify the complete semi-monthly commission workflow and protect CityBeat's retained platform balance.

## Scope

Exercise cadence, clearance, refund, retry, duplicate-job, statement, authorization, aggregation, timezone, and payout-setting behavior.

## Risks

Insufficient edge coverage could allow duplicate transfers, early payments, incorrect reports, or private data exposure.

## Verify Steps

Run focused tests, the full relevant suite, type-check, and production-safe smoke checks that do not create transfers or charges.

## Rollback Plan

Block deployment and revert failing implementation commits while preserving audit evidence.

## Notes

Verified 2026-10-15: 624 web tests and 20 shared-library tests passed; all four workspace type-checks passed; focused cadence, statement-period, dashboard aggregation, refund, and idempotency tests passed. Static scan found no stale 1st/15th copy or old scheduler expressions in production code. Live scheduler inventory remains unreadable to the current gcloud principal and will be verified through the deployment workflow.

