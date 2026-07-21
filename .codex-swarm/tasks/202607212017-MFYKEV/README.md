---
id: "202607212017-MFYKEV"
title: "Verify recurring checkout behavior"
status: "TODO"
priority: "high"
owner: "TESTER"
depends_on: ["202607212017-8JVTY5", "202607212017-XSEXBE"]
tags: ["test", "stripe"]
verify: ["npm test", "npm run type-check", "npm run lint", "npm run build"]
doc_version: 2
doc_updated_at: "2026-07-21T20:18:13+00:00"
doc_updated_by: "agentctl"
description: "Add deterministic automated coverage for recurring versus one-time checkout, customer reuse and duplicate-subscription safeguards, then run lint, typecheck, tests, and the production build."
---
## Summary

Prove the recurring checkout safeguards and customer handoff changes with deterministic tests and full repository verification.

## Context

Payment regressions can charge incorrectly or create duplicate subscriptions. Tests must exercise pure checkout decisions without making network calls to Stripe.

## Scope

Add focused unit tests for billing-mode classification, recurring email validation, duplicate subscription decisions, safe customer reuse, recurring disclosure values, and one-time preservation; then run tests, typecheck, lint, and production build.

## Risks

Tests tied directly to Stripe SDK implementation details can become brittle. Extract and test small deterministic decision helpers while retaining route-level type safety.

## Verify Steps

Run npm test, npm run type-check, npm run lint, and npm run build. Record any pre-existing warnings separately from failures.

## Rollback Plan

Revert the test commit if necessary; production behavior is unaffected by test-only changes.

## Notes

Review must confirm no raw payment data enters CityBeat and that one-time custom sales still use payment mode.

