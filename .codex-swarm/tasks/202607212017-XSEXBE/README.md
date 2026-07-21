---
id: "202607212017-XSEXBE"
title: "Simplify recurring payment handoff"
status: "DOING"
priority: "high"
owner: "CODER"
depends_on: ["202607212017-8JVTY5"]
tags: ["frontend", "code", "checkout"]
verify: ["npm run type-check"]
comments:
  - { author: "CODER", body: "Start: streamline the recurring sales handoff with clear renewal disclosure, salesperson-prefilled email, locally generated QR codes, and a public post-checkout result page." }
doc_version: 2
doc_updated_at: "2026-07-21T20:25:15+00:00"
doc_updated_by: "agentctl"
description: "Refine the sales wizard, recurring-payment disclosure, link sharing, and QR generation so customers can understand and complete a mobile checkout with minimal input."
---
## Summary

Streamlined the sales handoff into a three-action customer journey: scan or tap, review prefilled purchase details, and pay. Recurring terms are prominent, QR codes are generated locally, and customers now return to a public bilingual result page instead of the staff-only sales dashboard.

## Context

The current wizard generates links and externally hosted QR images, but recurring terms are not prominent and a missing customer email forces the customer to enter more information in Stripe.

## Scope

Clearly distinguish recurring and one-time products, show the due-now and renewal cadence, require salesperson-provided email for recurring links, explain Stripe card-on-file billing, preserve one-tap open/copy/email/text actions, and generate the QR in the CityBeat client using the existing QR library.

## Risks

Extra disclosure must not become an extra step. QR generation must remain accessible and recover cleanly if the browser cannot generate an image.

## Verify Steps

Ran git diff --check, npm run type-check, and npm run lint. All four workspace packages passed typecheck; both linting packages passed with no warnings or errors. The public result route compiles for English and Spanish through the typed Next.js route tree.

## Rollback Plan

Revert the frontend commit; existing Stripe Checkout URLs and the prior external QR rendering remain compatible.

## Notes

The browser now creates the QR data URL with the existing qrcode dependency, so Stripe Checkout URLs are not disclosed to an external QR image service. The salesperson supplies recurring customer email once, while phone remains optional and is used only to text the generated link.

