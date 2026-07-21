---
id: "202607212017-MFYKEV"
title: "Verify recurring checkout behavior"
status: "DONE"
priority: "high"
owner: "TESTER"
depends_on: ["202607212017-8JVTY5", "202607212017-XSEXBE"]
tags: ["test", "stripe"]
verify: ["npm test", "npm run type-check", "npm run lint", "npm run build"]
commit: { hash: "f1701c8b1e87ca641c27e42e0c08800e1e6db362", message: "🧪 MFYKEV verify recurring and one-time checkout behavior" }
comments:
  - { author: "TESTER", body: "Start: add deterministic recurring-checkout decision tests, preserve the existing test runner, and execute tests, typecheck, lint, and the production build before review." }
  - { author: "TESTER", body: "verified: 27 automated tests pass | details: recurring and one-time Stripe defaults are directly covered; all workspace typechecks and lint jobs pass; and the production build emits both bilingual public checkout result routes." }
doc_version: 2
doc_updated_at: "2026-07-21T20:30:30+00:00"
doc_updated_by: "agentctl"
description: "Add deterministic automated coverage for recurring versus one-time checkout, customer reuse and duplicate-subscription safeguards, then run lint, typecheck, tests, and the production build."
---
## Summary

Added deterministic tests that prove recurring sales use Stripe subscription mode, always collect a card for future renewals, safely prefill matched returning customers, require valid email, reject duplicate non-terminal subscriptions, disclose cadence, and keep custom sales in one-time payment mode.

## Context

Payment regressions can charge incorrectly or create duplicate subscriptions. Tests must exercise pure checkout decisions without making network calls to Stripe.

## Scope

Add focused unit tests for billing-mode classification, recurring email validation, duplicate subscription decisions, safe customer reuse, recurring disclosure values, and one-time preservation; then run tests, typecheck, lint, and production build.

## Risks

Tests tied directly to Stripe SDK implementation details can become brittle. Extract and test small deterministic decision helpers while retaining route-level type safety.

## Verify Steps

Ran npm test: 27 passed, 0 failed. Ran npm run type-check: 4 of 4 workspace packages passed. Ran npm run lint: 2 of 2 lint packages passed with zero warnings or errors. Ran npm run build: the Next.js production build compiled, checked types, generated 102 static pages, and emitted both /en/checkout/result and /es/checkout/result.

## Rollback Plan

Revert the test commit if necessary; production behavior is unaffected by test-only changes.

## Notes

The tests exercise pure session-default and customer-selection helpers without Stripe network calls. Existing non-failing build notices remain for the age of caniuse-lite and an unrelated edge-runtime static-generation limitation.

