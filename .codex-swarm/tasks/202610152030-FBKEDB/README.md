---
id: "202610152030-FBKEDB"
title: "Add authenticated editor payouts dashboard"
status: "DONE"
priority: "high"
owner: "CODER"
depends_on: []
tags: ["code", "frontend", "backend", "auth"]
verify: ["npm test", "npm --prefix apps/web run type-check"]
commit: { hash: "0d6698f67eb9b6242fb274a8fc8013bb87d43f5a", message: "🎨 FBKEDB add a private editor payout dashboard with history, statements, transaction references, and YTD totals" }
comments:
  - { author: "CODER", body: "Start: expand the authenticated account payouts page with payee-scoped history, transaction references, accumulated and year-to-date totals, statements, and clear bank-deposit terminology." }
  - { author: "CODER", body: "verified: authenticated payee dashboard passes aggregation tests and full regression coverage | details: API queries only the signed-in user and exposes no bank numbers or cross-payee records." }
doc_version: 2
doc_updated_at: "2026-10-15T20:31:25+00:00"
doc_updated_by: "agentctl"
description: "Add an account payouts page scoped to the signed-in payee with held and upcoming commission, payout history and count, transaction references, current-period earnings, and year-to-date totals without exposing bank details."
---
## Summary

Give authenticated editors a payee-scoped payouts dashboard with held, upcoming, historical, current-period, and year-to-date commission data.

## Scope

Add the account route, secured data endpoint or server loader, transaction references, payout counts, totals, cadence copy, responsive UI, and bilingual text where required.

## Risks

Cross-account data exposure, confusing transfer versus bank-payout terminology, stale totals, and mobile accessibility regressions.

## Verify Steps

Test payee authorization and aggregation, verify empty and populated states, type-check, and review desktop and mobile layouts.

## Rollback Plan

Remove the navigation entry and route/API changes without altering underlying ledger or Stripe records.

