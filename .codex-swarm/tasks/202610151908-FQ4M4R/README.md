---
id: "202610151908-FQ4M4R"
title: "Verify Premium SEO, sales flow, and payment safeguards"
status: "TODO"
priority: "high"
owner: "TESTER"
depends_on: ["202610151908-1V8V7X", "202610151908-CSBGR8", "202610151908-W3RZA8"]
tags: ["testing", "seo", "sales", "stripe"]
verify: ["npm --prefix apps/web run type-check", "npm test"]
doc_version: 2
doc_updated_at: "2026-10-15T19:09:02+00:00"
doc_updated_by: "agentctl"
description: "Run automated and manual regression checks against the completed SEO/referral and sales-flow changes. Confirm Premium differentiation, event attribution, desktop/mobile recovery states, checkout-link reuse, and that payment verification remained read-only with no real charge or payout. Record reproducible evidence and any blockers."
---
## Summary

Provide independent regression evidence for SEO, sales-flow, and financial safeguards.

## Scope

Test completed SEO/referral and sales changes, checkout-link reuse, mobile/desktop recovery, and validate that payout review stayed read-only.

## Risks

Testing must avoid real charges, payouts, customer email duplication, destructive production changes, or false analytics events.

## Verify Steps

Execute configured typecheck/tests plus focused manual cases; record results, evidence, and blockers for release gating.

## Rollback Plan

No production release; revert only test artifacts introduced by this task.

