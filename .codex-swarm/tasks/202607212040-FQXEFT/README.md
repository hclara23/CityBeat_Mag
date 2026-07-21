---
id: "202607212040-FQXEFT"
title: "Review unified sales fulfillment security"
status: "DOING"
priority: "high"
owner: "REVIEWER"
depends_on: ["202607212040-7XJF9K", "202607212040-HTN28A", "202607212123-1CBZQV"]
tags: ["review", "security"]
comments:
  - { author: "REVIEWER", body: "Start: audit authorization, server-side pricing, order-token isolation, payment-state verification, upload boundaries, webhook idempotency, discounts, commissions, and fulfillment side effects across the final implementation." }
doc_version: 2
doc_updated_at: "2026-07-21T21:23:10+00:00"
doc_updated_by: "agentctl"
description: "Review the completed payment and fulfillment implementation for authorization, price integrity, sensitive data handling, order isolation, operational completeness, and regression risk."
---
## Summary

Perform the final authorization, payment-integrity, fulfillment, and regression review.

## Context

The feature creates public order-access links and changes how paid products become operational records.

## Scope

Review price authority, token handling, order isolation, upload safety, webhook idempotency, commissions, discounts, intake requirements, and operational status visibility.

## Risks

A missed security or payment flaw could expose customer data or mischarge orders.

## Verify Steps

Inspect the final diff and recorded quality-gate output, then document every finding with severity and file references.

## Rollback Plan

Keep the parent task open and return defects to the owning implementation task.

## Notes

Review findings (must fix before closure): [MEDIUM] apps/web/src/app/api/sales/send-link/route.ts accepts any checkout.stripe.com or buy.stripe.com URL and caller-supplied recipient/order labels; validate the URL against a sales_orders record owned by the signed-in rep and use canonical order contact data. [MEDIUM] apps/web/src/app/api/sales/checkout/route.ts creates a new directory_listings record before payment and before the required customer brief, conflicting with the paid-and-complete provisioning boundary; defer new listing creation and make fulfillment choose a deterministic listing id. [MEDIUM] apps/web/src/app/api/stripe/webhook/route.ts leaves refunded sales orders in fulfillment_status=in_review and may miss subscription refunds when checkout has no payment_intent; resolve the exact order through payment intent or invoice subscription and mark fulfillment needs_attention. [MEDIUM] Sales Desk handoff state can diverge if customer fields are edited after checkout generation; freeze the canonical handoff snapshot or invalidate the generated checkout. Additional hardening: reject invalid canonical product ids instead of silently falling back, fail closed when Founding availability cannot be read, and validate select/email/date/time/number intake values server-side. No high-severity finding identified.

