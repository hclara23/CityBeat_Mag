---
id: "202607212040-E4YRZ8"
title: "Create secure post-payment intake wizard"
status: "DOING"
priority: "high"
owner: "CODER"
depends_on: ["202607212040-KXMN5S"]
tags: ["frontend", "backend", "code"]
verify: ["npm test"]
comments:
  - { author: "CODER", body: "Start: add paid-order token authorization, autosaved product-aware intake, secure resume delivery, and validated order-scoped image uploads." }
doc_version: 2
doc_updated_at: "2026-07-21T20:40:57+00:00"
doc_updated_by: "agentctl"
description: "Provide paid-order token access without account creation, product-aware adaptive steps, autosave, resumable links, and validated order-scoped asset uploads."
---
## Summary

Add a secure no-account customer wizard that starts after successful payment.

## Context

Customers need product-specific fulfillment intake after Checkout without creating an account or re-entering known information.

## Scope

Implement opaque order access, paid-order verification, adaptive schemas, prefill, autosave, resume support, completion state, and validated order-scoped image uploads.

## Risks

Token leakage, cross-order data access, unpaid access, unsafe uploads, and abandoned intake sessions.

## Verify Steps

Run npm test with authorization, unpaid-order, expiry, autosave, resume, upload validation, and order-isolation cases.

## Rollback Plan

Disable the fulfillment route and revert success URLs to the existing checkout result page.

## Notes

Card data remains exclusively in Stripe Checkout and is never collected by the CityBeat wizard.

