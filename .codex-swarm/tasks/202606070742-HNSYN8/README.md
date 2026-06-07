---
id: "202606070742-HNSYN8"
title: "Audit review"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "Start: audit review of auth, directory claims, reviews, upload, payment webhooks, and local verification commands." }
doc_version: 2
doc_updated_at: "2026-06-07T07:46:55+00:00"
doc_updated_by: "agentctl"
description: "Review the CityBeat codebase for correctness, security, data access, auth/session, and release-readiness risks without modifying application code."
---
## Summary

Audit completed for CityBeat app auth, directory claims/reviews, creator upload, Stripe/Supabase payment handlers, and local type/lint health. Findings were review-only; no application files were changed.

## Context

The review followed the approved audit plan for task 202606070742-HNSYN8 and focused on recent production-sensitive areas in the CityBeat monorepo.

## Scope

Reviewed targeted high-risk surfaces: apps/web API route handlers, Supabase server/client helpers, directory claim and review flows, creator article/upload APIs, cron routes, Stripe Connect and webhook code, worker webhook handlers, and relevant SQL policy files.

## Risks

Confirmed risks: directory claims can be approved using claimant-supplied contact info; public reviews expose reviewer email; repeated reviews can inflate review_points and listing ratings; creator uploads lack creator-role and size/rate gates; worker Stripe refund matching and webhook replay protections are weak if deployed.

## Verify Steps

Commands run:

- npm run type-check --workspace @citybeat/web
- npm run type-check --workspace @citybeat/lib
- npm run lint --workspace @citybeat/web
- npm run type-check --workspace @citybeat/worker

Result: all passed.

## Rollback Plan

No application changes were made. Rollback is limited to reverting this audit task record if the workflow artifact is not desired.

## Notes

Recommended next work: fix directory claim trust model first, then remove reviewer email exposure, add review uniqueness/points guards, gate upload by creator role and file size, and harden worker Stripe webhook replay/refund matching.

