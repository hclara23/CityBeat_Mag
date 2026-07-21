---
id: "202607212040-7XJF9K"
title: "Verify unified sales and fulfillment flows"
status: "TODO"
priority: "high"
owner: "TESTER"
depends_on: ["202607212040-G73WWE"]
tags: ["test", "stripe", "security"]
verify: ["npm test", "npm run type-check", "npm run lint", "npm run build"]
doc_version: 2
doc_updated_at: "2026-07-21T20:40:59+00:00"
doc_updated_by: "agentctl"
description: "Add deterministic coverage for catalog pricing, recurring and one-time checkout, access tokens, unpaid rejection, autosave, uploads, field requirements, fulfillment, discounts, and commissions; run the full quality gate."
---
## Summary

Add regression coverage and run the complete sales and fulfillment release gate.

## Context

The unified flow crosses security, Stripe, data validation, uploads, UI state, and multiple fulfillment destinations.

## Scope

Test the canonical catalog, checkout modes, order authorization, autosave, uploads, required fields, fulfillment idempotency, discounts, commissions, and existing recurring behavior.

## Risks

False confidence from mocked Stripe behavior and build-only issues not covered by focused tests.

## Verify Steps

Run npm test, npm run type-check, npm run lint, and npm run build with no unresolved failures.

## Rollback Plan

Revert test-only changes if they are invalid; implementation defects return to the owning task.

## Notes

Tests must be deterministic and make no network calls.

