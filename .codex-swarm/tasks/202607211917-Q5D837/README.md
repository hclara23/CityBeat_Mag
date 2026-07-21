---
id: "202607211917-Q5D837"
title: "Build directory referral rewards"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["directory", "billing", "backend", "frontend"]
verify: ["npm run type-check", "npx tsx --test apps/web/src/lib/referrals.test.ts"]
commit: { hash: "81a308462b06984d77015a2e1e5d6b17f11858ba", message: "✨ Q5D837 add directory referrals, automatic Stripe rewards, and discount reporting" }
comments:
  - { author: "ORCHESTRATOR", body: "Start: implement the approved directory referral program, automatic Stripe rewards, dashboard tracking, finance disclosure, tests, and operations documentation." }
  - { author: "ORCHESTRATOR", body: "verified: referral attribution, three-month qualification, Stripe reward application and consumption, customer dashboard sharing, finance discount disclosure, anti-abuse checks, and retry idempotency are complete | details: tests, type-check, lint, production build, and declared task verification all pass." }
doc_version: 2
doc_updated_at: "2026-07-21T19:40:32+00:00"
doc_updated_by: "agentctl"
description: "Create a paid-directory referral program with personalized listing links, 30-day server-validated attribution, three-month active qualification, automatic Stripe rewards (three monthly cycles at 25% or 6.25% of the next annual renewal per qualified referral), a 16-qualified-referral annual cap, anti-abuse/idempotency safeguards, customer dashboard tracking, detailed finance reporting, tests, and operating documentation."
---
## Summary

Implemented an end-to-end referral rewards program for paid directory listings. Each eligible listing receives a stable personalized link; attribution survives the Firebase Hosting cookie policy; referred subscriptions qualify after three paid calendar months; equivalent monthly or annual Stripe discounts are applied and consumed automatically; customer and finance dashboards expose the complete reward state.

## Context

Directory checkout already creates Stripe subscriptions with listing and owner metadata. Stripe webhooks persist subscriptions and invoice payments, while the advertiser dashboard and admin finance dashboard expose customer and payment data. The current system has no referral attribution, reward ledger, discount application, or gross-versus-discount reporting.

## Scope

Add stable per-listing referral codes and 30-day cookie attribution; validate referral ownership server-side at checkout; create idempotent referral records; qualify active paid referred subscriptions after three calendar months; cap rewards at 16 qualified referrals per referrer listing per calendar year; apply 25% for three monthly invoices or 6.25% per referral to the next annual renewal; prevent self-referrals and duplicates; expose referral stats in the customer dashboard; show listing, plan, gross fee, discount source, discount amount, and net paid in admin finance; add deterministic tests and scheduler documentation.

## Risks

Stripe discount state must remain idempotent across webhook retries and cron retries. Annual and monthly rewards require different accounting while preserving equivalent value. Referral attribution must not trust client-supplied identities, and Firestore queries must avoid unsupported compound indexes. Existing non-referral subscription discounts must not be silently overwritten.

## Verify Steps

Passed npm run type-check across all four workspaces. Passed npm test with 20 tests, including six referral policy tests. Passed npm run lint with one pre-existing no-img-element warning in the sales page. Passed npm run build; the production Next.js build includes /[locale]/refer/[code] and /api/cron/referrals. agentctl verify passed both declared task commands.

## Rollback Plan

Revert the task implementation commit. The new Firestore collections are additive; leaving historical referral records is harmless, or they can be archived after rollback. Remove the referral qualification Cloud Scheduler job if it has been deployed. Existing directory subscriptions and payments continue using their prior webhook paths.

## Notes

Planning commit: f8493ef. Implementation commit: 81a3084. Monthly rewards consume one of three earned discount months per 25%-discounted invoice. Annual rewards convert each three-month award to 6.25% of the next renewal and can aggregate to 100%, with excess balance rolling forward. Stripe and Firestore operations use deterministic coupon IDs, transaction-backed ledgers, invoice usage IDs, and retry repair. Deploy the web change before creating the documented daily citybeat-referrals Cloud Scheduler job.

