---
id: "202607212017-XSEXBE"
title: "Simplify recurring payment handoff"
status: "TODO"
priority: "high"
owner: "CODER"
depends_on: ["202607212017-8JVTY5"]
tags: ["frontend", "code", "checkout"]
verify: ["npm run type-check"]
doc_version: 2
doc_updated_at: "2026-07-21T20:18:12+00:00"
doc_updated_by: "agentctl"
description: "Refine the sales wizard, recurring-payment disclosure, link sharing, and QR generation so customers can understand and complete a mobile checkout with minimal input."
---
## Summary

Reduce customer input and ambiguity when a salesperson hands off a recurring payment link or QR code.

## Context

The current wizard generates links and externally hosted QR images, but recurring terms are not prominent and a missing customer email forces the customer to enter more information in Stripe.

## Scope

Clearly distinguish recurring and one-time products, show the due-now and renewal cadence, require salesperson-provided email for recurring links, explain Stripe card-on-file billing, preserve one-tap open/copy/email/text actions, and generate the QR in the CityBeat client using the existing QR library.

## Risks

Extra disclosure must not become an extra step. QR generation must remain accessible and recover cleanly if the browser cannot generate an image.

## Verify Steps

Run npm run type-check, npm run lint, and inspect the mobile and desktop states for product selection, client details, recurring disclosure, generated QR, and one-time custom sales.

## Rollback Plan

Revert the frontend commit; existing Stripe Checkout URLs and the prior external QR rendering remain compatible.

## Notes

Use the existing CityBeat design tokens and a refined, mobile-first layout rather than introducing a new visual system.

