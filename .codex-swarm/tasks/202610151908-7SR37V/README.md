---
id: "202610151908-7SR37V"
title: "Audit end-to-end Premium sales UI resilience"
status: "TODO"
priority: "high"
owner: "REVIEWER"
depends_on: ["202610151907-QDRGY5"]
tags: ["sales", "ui", "checkout"]
comments:
  - { author: "REVIEWER", body: "Verified: read-only source audit completed; 55 focused unit tests passed. Two P0 sale-continuity defects and three P1 recovery/ownership/idempotency gaps are documented in the task README. Keep TODO until dependency 202610151907-QDRGY5 is DONE." }
doc_version: 2
doc_updated_at: "2026-10-15T19:11:37+00:00"
doc_updated_by: "agentctl"
description: "Walk the Premium sale journey on desktop and mobile from listing selection through checkout sharing, resend/recovery, claim, payment return, login, and listing editing. Document loading, error, expired-link, duplicate-prevention, interruption-recovery, and accessibility gaps without changing code or production records."
---
## Summary

Read-only audit of the Premium sales journey found two sale-blocking recovery defects, three high-priority continuity gaps, and two mobile/loading usability gaps. No checkout, email, charge, production record, deployment, or application code was changed.

## Context

Reviewed the Sales Desk create/share UI, checkout API and duplicate guard, checkout return URLs, abandoned-checkout board, payment email, claim/accept flow, paid fulfillment wizard, and owner dashboard/CMS. Verification was source-based and used existing pure unit tests only; production was not mutated.

## Scope

Findings, ordered by severity:

P0 — Correct details dead-ends every paid directory sale. Reproduction: create a paid directory checkout, select Correct details, change a field, submit. The client clears its handoff and explicitly promises a fresh checkout (sales/me/page.tsx:438-448,838), but retains listingId; the server sees the original live subscription order and returns subscription_already_exists (api/sales/checkout/route.ts:55-71). Acceptance: correction must update the still-pending order/session safely or explicitly expire the original before replacement; the UI must keep the old link available until replacement succeeds and must present a recoverable conflict action.

P0 — Refresh/reopen destroys the signed ownership handoff. Reproduction: create a new paid listing using verification bypass, then refresh before sharing. All form, checkout, claim, QR, and handoff state is memory-only (sales/me/page.tsx:35-82,125-158); recovery exposes only checkout_url and Email (RecoveryLeadsBoard.tsx:131-150,251-259), not the signed single-use claim URL. Acceptance: persist/reconstruct the complete authorized handoff by order ID, including payment and claim links, expiry/status, copy/open/email/text/QR actions; never expose token material to unauthorized roles.

P1 — The official payment email sends an unowned customer to a dashboard they cannot access. It tells the buyer to sign in and open /dashboard/listings/{id} (api/sales/send-link/route.ts:74-96), while the CMS authorizes only owner/staff/manager (dashboard/listings/[listingId]/page.tsx:62-80). Standard new paid sales still require claiming. Acceptance: email and paid-success journey must lead through ownership claim/acceptance first, preserve returnTo through login, then deep-link to the editable listing after ownership is confirmed; test both standard verification and bypass flows.

P1 — Expired checkout rows have no recovery action. RecoveryLeadsBoard marks Expired but renders Email only for ready links and offers only Remove otherwise (lines 223-287). Acceptance: provide a server-authorized Renew checkout action that reuses the same order/listing/customer attribution, prevents duplicate subscriptions, shows the new expiry, and leaves an audit trail.

P1 — Checkout creation lacks a request idempotency key. busy disables repeat clicks only in one mounted client (sales/me/page.tsx:742-749); the API allocates a new order before Stripe creation (api/sales/checkout/route.ts:311-330), and the existing-listing query is not an atomic reservation (lines 55-71). Acceptance: client-generated idempotency key survives retries; server transaction/reservation returns the existing live handoff for the same attempt; parallel requests yield one listing, order, and Stripe session.

P2 — Mobile recovery hides the primary action offscreen. The table is min-width 880px with Action last (RecoveryLeadsBoard.tsx:191-203), requiring horizontal scrolling on a phone. Acceptance: mobile renders stacked lead cards or pins actions/contact so Email/Renew/Copy are visible without lateral discovery.

P2 — Sales Desk has a blank boot/failure state. It returns null until ready (sales/me/page.tsx:100-119,455), and failed dashboard/lead requests are silently converted to null/empty. Acceptance: visible loading skeleton, differentiated auth/API errors, retry, and preservation of draft/handoff during retry.

Verified strengths: server-priced catalog; Stripe-host validation; seller-bound live-link resend; checkout access tokens hashed and expiring; login redirectTo preserves signed claim URL; payment success enters autosaving fulfillment; fulfillment removes only session_id and retains access token; claim acceptance is signed, expiring, email-bound, and single-use; loading/error/submission states exist in the fulfillment wizard.

## Risks

Do not solve recovery by exposing checkout or claim tokens in broad listing APIs. Replacement checkout logic must expire the old session before advertising a new link, remain race-safe, and preserve seller commission attribution. Claim and payment may occur in either order; both sequences must converge to one owned Premium listing without granting ownership merely because someone paid.

## Verify Steps

1. Existing tests executed: .\\node_modules\\.bin\\tsx.cmd --test apps/web/src/lib/sales-orders.test.ts apps/web/src/lib/sales-checkout.test.ts apps/web/src/lib/verification-audit.test.ts apps/web/src/app/[locale]/fulfill/intake-i18n.test.ts — 55 passed, 0 failed.
2. Add E2E coverage for refresh after checkout creation, correction/replacement, concurrent double submit, expired renewal, email-to-claim-to-dashboard, payment-before-claim, claim-before-payment, login returnTo, and mobile 390px recovery actions.
3. Use Stripe test mode only for implementation verification; assert one session/subscription/order/listing and no representational sends.

## Rollback Plan

Audit-only change: revert the task documentation commit if necessary. Future implementation should be independently revertible; retain existing orders and Stripe sessions, and never delete payment or claim audit history during rollback.

## Notes

Task dependency 202610151907-QDRGY5 was not complete when the audit ran, so this task was not started or finished in the canonical backend. Recommendation: keep TODO until dependency readiness, then implement P0 items before another live sale and P1 items before scaling sales outreach.

