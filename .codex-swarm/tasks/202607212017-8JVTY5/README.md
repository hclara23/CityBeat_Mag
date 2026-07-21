---
id: "202607212017-8JVTY5"
title: "Harden recurring card billing"
status: "DOING"
priority: "high"
owner: "CODER"
depends_on: []
tags: ["backend", "code", "stripe"]
verify: ["npm run type-check"]
comments:
  - { author: "CODER", body: "Start: harden recurring Stripe Checkout with validated customer reuse, duplicate-subscription protection, minimal data collection, and unchanged one-time payments." }
doc_version: 2
doc_updated_at: "2026-07-21T20:21:25+00:00"
doc_updated_by: "agentctl"
description: "Strengthen the sales checkout API so recurring products always create safe Stripe subscriptions, reuse validated customer records where appropriate, prevent duplicate active subscriptions, prefill customer data, and leave one-time charges unchanged."
---
## Summary

Hardened recurring sales checkout so Stripe always collects a payment method, first-time customers receive a prefilled email, safely matched returning customers can reuse their saved Stripe card, and listings with an existing non-terminal subscription cannot be charged twice.

## Context

The sales checkout already uses Stripe Checkout subscription mode for directory plans, but it does not validate an existing listing before reuse, block duplicate active subscriptions, or reuse a validated Stripe customer for a faster repeat checkout.

## Scope

Validate recurring customer email and selected listings, detect active or trialing directory subscriptions, safely reuse a listing Stripe customer where appropriate, configure optimized Stripe Checkout parameters, preserve attribution metadata, and leave custom one-time payment semantics unchanged.

## Risks

An unvalidated customer identifier could expose another customer payment method, while an incorrect duplicate check could block legitimate reactivation. Only customer IDs read from the validated listing may be reused.

## Verify Steps

Ran npm run type-check after the route and checkout-decision helper changes; all four workspace packages passed TypeScript compilation. Focused behavior tests are owned by dependent task 202607212017-MFYKEV.

## Rollback Plan

Revert the backend commit to restore the existing Stripe Checkout session parameters. No database migration or existing subscription mutation is required.

## Notes

Stripe Checkout remains the only card-data collection surface. Existing Customer reuse requires a syntactically valid Stripe customer ID and an exact normalized match between the listing email and sale email. Official Stripe Checkout documentation confirms subscription mode creates a Customer when needed and prefills a validated existing Customer's default or most recently saved card.

