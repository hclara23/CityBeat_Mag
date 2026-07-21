---
id: "202607211917-Q5D837"
title: "Build directory referral rewards"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["directory", "billing", "backend", "frontend"]
verify: ["npm run type-check", "npx tsx --test apps/web/src/lib/referrals.test.ts"]
comments:
  - { author: "ORCHESTRATOR", body: "Start: implement the approved directory referral program, automatic Stripe rewards, dashboard tracking, finance disclosure, tests, and operations documentation." }
doc_version: 2
doc_updated_at: "2026-07-21T19:17:24+00:00"
doc_updated_by: "agentctl"
description: "Create a paid-directory referral program with personalized listing links, 30-day server-validated attribution, three-month active qualification, automatic Stripe rewards (three monthly cycles at 25% or 6.25% of the next annual renewal per qualified referral), a 16-qualified-referral annual cap, anti-abuse/idempotency safeguards, customer dashboard tracking, detailed finance reporting, tests, and operating documentation."
---
## Summary

Build an end-to-end referral rewards program for paid directory listings. Each eligible listing receives a stable link; referred subscriptions qualify after three active paid months; rewards are applied automatically and shown transparently to customers and administrators.

## Context

Directory checkout already creates Stripe subscriptions with listing and owner metadata. Stripe webhooks persist subscriptions and invoice payments, while the advertiser dashboard and admin finance dashboard expose customer and payment data. The current system has no referral attribution, reward ledger, discount application, or gross-versus-discount reporting.

## Scope

Add stable per-listing referral codes and 30-day cookie attribution; validate referral ownership server-side at checkout; create idempotent referral records; qualify active paid referred subscriptions after three calendar months; cap rewards at 16 qualified referrals per referrer listing per calendar year; apply 25% for three monthly invoices or 6.25% per referral to the next annual renewal; prevent self-referrals and duplicates; expose referral stats in the customer dashboard; show listing, plan, gross fee, discount source, discount amount, and net paid in admin finance; add deterministic tests and scheduler documentation.

## Risks

Stripe discount state must remain idempotent across webhook retries and cron retries. Annual and monthly rewards require different accounting while preserving equivalent value. Referral attribution must not trust client-supplied identities, and Firestore queries must avoid unsupported compound indexes. Existing non-referral subscription discounts must not be silently overwritten.

## Verify Steps

Run npm run type-check. Run npx tsx --test apps/web/src/lib/referrals.test.ts. Inspect the task-scoped git diff and confirm the repository remains clean after commits.

## Rollback Plan

Revert the task implementation commit. The new Firestore collections are additive; leaving historical referral records is harmless, or they can be archived after rollback. Remove the referral qualification Cloud Scheduler job if it has been deployed. Existing directory subscriptions and payments continue using their prior webhook paths.

## Notes

Approved policy: the 16-referral cap counts qualified referrals per listing and calendar year. Monthly rewards queue without exceeding 25% on any invoice. Annual rewards aggregate at 6.25 percentage points per referral on the next renewal, capped at 100%.

