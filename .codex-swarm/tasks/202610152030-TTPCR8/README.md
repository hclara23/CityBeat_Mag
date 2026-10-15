---
id: "202610152030-TTPCR8"
title: "Verify semi-monthly commission payout workflow"
status: "TODO"
priority: "high"
owner: "TESTER"
depends_on: ["202610152030-YPJ8P9", "202610152030-FBKEDB"]
tags: ["testing", "stripe", "payouts"]
verify: ["npm --prefix apps/web test -- --runInBand", "npm --prefix apps/web run type-check"]
doc_version: 2
doc_updated_at: "2026-10-15T20:31:26+00:00"
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

