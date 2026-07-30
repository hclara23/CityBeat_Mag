---
id: "202607301957-HJ89QQ"
title: "Restore New Sale access and checkout sharing"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["frontend", "sales", "checkout", "deployment"]
verify: ["npm run lint", "npm run build"]
comments:
  - { author: "ORCHESTRATOR", body: "Start: trace the current developer and Sales Desk routes, restore a direct New Sale entry point, verify checkout-link and QR sharing, then deploy and smoke-test production." }
doc_version: 2
doc_updated_at: "2026-07-30T20:12:05+00:00"
doc_updated_by: "agentctl"
description: "Restore a prominent, low-click New Sale entry point for platform sales staff; preserve the product and variation selector; verify Stripe payment-link and QR generation plus text and email sharing; deploy and confirm the production workflow."
---
## Summary

Restore the missing New Sale shortcut on the developer dashboard and make the unified Sales Desk clearly expose the existing product checkout, payment-link, QR, email, text, and copy-link workflow.

## Context

The July Sales Desk consolidation kept the checkout engine but removed the separate New Sale card and button from the developer dashboard. The Sales Desk still contains the full sales form, but developers could only discover it through a general Sales Desk card.

## Scope

Add a prominent localized New Sale button to Developer Control, route it through the compatibility entry point to the unified Sales Desk, add an in-page New Sale control, label the form explicitly, and make hash deep-link scrolling reliable after client-side authorization finishes. Preserve server-owned prices and the existing secure checkout APIs.

## Risks

The shortcut must remain restricted by existing role middleware and must not create a second checkout implementation. Hash navigation must wait until the authenticated Sales Desk renders. No payment, customer, or card data handling is changed.

## Verify Steps

Run npm run test, npm run lint, npm run type-check, and npm run build. Confirm both localized New Sale routes are generated, the developer CTA points to /admin/sales/new, the Sales Desk renders a product selector and link/QR/email/text actions, then deploy and verify health, routing, and the protected checkout response in production.

## Rollback Plan

Route Cloud Run traffic back to production revision citybeat-web-00152-9lb and revert the implementation commit. The change is navigation-only and creates no data migration or payment records.

## Notes

The existing Sales Desk retains the complete product catalog, recurring and one-time Stripe checkout, customer fulfillment handoff, QR generation, secure order-bound email/SMS delivery, and copy-link fallback. The frontend-design skill kept the restored action within CityBeat's editorial dark/neon design system. Initial production revision citybeat-web-00153-cqj verified Stripe and Resend configuration but found Twilio absent; the Text action now keeps automatic Twilio delivery when available and otherwise opens the salesperson's native SMS composer with the customer number and payment message prefilled while copying the link as a fallback. All 52 tests, lint, type checks, and the production build pass after this fallback.

