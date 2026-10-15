---
id: "202610151908-CSBGR8"
title: "Harden Premium sales flow against interrupted sales"
status: "DOING"
priority: "high"
owner: "CODER"
depends_on: ["202610151908-7SR37V"]
tags: ["sales", "checkout", "frontend", "backend"]
verify: ["npm --prefix apps/web run type-check", "npm test"]
commit: { hash: "0934cda8ccd0d5aae272b2069979d026a117dc59", message: "✨ CSBGR8 harden checkout recovery and duplicate prevention" }
comments:
  - { author: "CODER", body: "Start: implement approved sales-flow resilience fixes with local-only verification and no external sends, checkouts, charges, deployment, or financial mutations." }
  - { author: "CODER", body: "verified: sales-flow resilience implementation passed web type-check plus 608 web and 20 shared-library tests, including focused persistence, correction, idempotency, renewal, claim-first email, mobile, and error-state coverage." }
  - { author: "CODER", body: "Start: close the replacement compensation gap so an old-session expiry failure retires the newly created session and records the failed attempt without creating two live links." }
doc_version: 2
doc_updated_at: "2026-10-15T19:25:44+00:00"
doc_updated_by: "agentctl"
description: "Implement the approved sales-UI audit fixes for resilient creation, checkout sharing, resend/recovery, claim, payment-return, login, and listing editing across desktop and mobile. Preserve checkout idempotency and prevent duplicate orders, sessions, or sends. Include focused automated coverage."
---
## Summary

Hardened the Premium sales journey so interrupted and repeated checkout creation converges on one order/listing, the active handoff survives refresh and correction, expired orders can be renewed in place, and claim-first instructions lead owners into the editable dashboard only after ownership is established.

## Context

Implemented the approved findings from audit 202610151908-7SR37V. Work was local-only: no real checkout was created, no email or SMS was sent, no charge or payout occurred, and no deployment or financial configuration was changed.

## Scope

Added seller-scoped deterministic checkout attempt reservation, stable Stripe idempotency keys, retry recovery, safe claim-token rotation for authorized recovery, correction replacement that retains the previous handoff until the replacement succeeds and then expires/audits the old session, session-scoped handoff recovery across refresh, claim-before-dashboard payment email instructions, an authenticated expired-checkout renewal endpoint that reuses the original order/listing/attribution and writes an audit row, mobile recovery cards with visible Open/Email/Renew actions, and explicit loading/API failure UI with retry. Added focused resilience tests.

## Risks

Checkout creation and renewal remain financially sensitive server paths. Production release must verify Firestore transaction behavior and Stripe test-mode replacement/renewal before promotion. Claim secrets are never stored in browser persistent storage: the active signed URL is limited to sessionStorage, and retry recovery rotates its server-side hash for the authenticated creating seller.

## Verify Steps

Passed npm --prefix apps/web run type-check. Passed 68 focused node tests via .\\node_modules\\.bin\\tsx.cmd --test apps/web/src/lib/sales-resilience.test.ts apps/web/src/lib/sales-orders.test.ts apps/web/src/lib/sales-checkout.test.ts apps/web/src/lib/checkout-recovery.test.ts apps/web/src/lib/verification-audit.test.ts apps/web/src/app/[locale]/fulfill/intake-i18n.test.ts. Production tester should exercise refresh recovery, concurrent retry, corrected replacement, expired renewal, claim/login return, and 390px actions using Stripe test mode only.

## Rollback Plan

Revert the implementation commit. Existing sales orders and Stripe sessions remain authoritative; do not delete order, renewal, link-send, or claim audit history. A rollback may leave newly created deterministic order IDs and renewal audit rows intact without charging or granting ownership.

## Notes

Residual replacement compensation fix: if Stripe cannot expire the original checkout after creating its replacement, the route immediately expires the new session, records a failed replacement audit, keeps the old order unchanged, and returns a recoverable error. If compensation itself fails, the new order is marked needs_attention with no shareable URL and the audit preserves both session IDs. Type-check and full tests passed (610 web, 20 shared). No real sessions or production state were touched.

