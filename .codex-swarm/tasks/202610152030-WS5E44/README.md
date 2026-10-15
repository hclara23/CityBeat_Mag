---
id: "202610152030-WS5E44"
title: "Deploy semi-monthly editor payout release"
status: "DONE"
priority: "high"
owner: "INTEGRATOR"
depends_on: ["202610152030-TTPCR8"]
tags: ["release", "stripe", "production"]
verify: ["npm --prefix apps/web run type-check"]
commit: { hash: "45e7ca244fe63bfd8575bd574ddb24902cbbd903", message: "🐛 WS5E44 run semi-monthly payouts through existing daily reconciliation without scheduler IAM" }
comments:
  - { author: "INTEGRATOR", body: "Start: deploy the verified app and scheduler changes within the approved  one-time and approximately .10 monthly limits; run production-safe checks without initiating a payout or charge." }
  - { author: "INTEGRATOR", body: "verified: production deployment run 38805192285 passed tests, candidate smoke checks, promotion, and live checks | details: no new payout or charge was initiated." }
doc_version: 2
doc_updated_at: "2026-10-15T21:01:03+00:00"
doc_updated_by: "agentctl"
description: "Deploy the verified payout cadence, payout-triggered statements, and editor dashboard within the approved up-to- one-time Google Cloud deployment cost and approximately .10 monthly scheduler charge; verify production without initiating a new payout or charge."
---
## Summary

Deployed the semi-monthly editor payout, statement delivery, and private payouts dashboard release to production.

## Context

The first rollout succeeded except for a Cloud Scheduler IAM update. The final release reuses the existing daily payout reconciliation job and therefore requires no new scheduler resource or recurring scheduler charge.

## Scope

Production code, payout cadence, payout-attached statements, editor dashboard, monitoring alignment, and deployment workflow.

## Risks

No new payout or customer charge was initiated. Statement sends are idempotent, inactive payees are skipped, and owner Stripe payouts remain manual.

## Verify Steps

npm test passed 644 tests; npm run type-check passed 4 workspaces; GitHub Actions run 38805192285 deployed, smoke-tested, promoted, and verified production; public home, health, and payouts routes returned HTTP 200.

## Rollback Plan

Revert commits 45e7ca2, 0d6698f, and 73e0218, then redeploy; the Cloud Run workflow also retains automatic rollback to the previously serving revision when live verification fails.

## Notes

Release commit 45e7ca2. Deployment run: https://github.com/hclara23/CityBeat_Mag/actions/runs/38805192285. The approved approximately ten-cent monthly scheduler budget was not used.

