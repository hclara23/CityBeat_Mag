---
id: "202610151908-CSBGR8"
title: "Harden Premium sales flow against interrupted sales"
status: "TODO"
priority: "high"
owner: "CODER"
depends_on: ["202610151908-7SR37V"]
tags: ["sales", "checkout", "frontend", "backend"]
verify: ["npm --prefix apps/web run typecheck", "npm --prefix apps/web test"]
doc_version: 2
doc_updated_at: "2026-10-15T19:09:01+00:00"
doc_updated_by: "agentctl"
description: "Implement the approved sales-UI audit fixes for resilient creation, checkout sharing, resend/recovery, claim, payment-return, login, and listing editing across desktop and mobile. Preserve checkout idempotency and prevent duplicate orders, sessions, or sends. Include focused automated coverage."
---
## Summary

Make the Premium sales flow resilient to interruption and explicit about recovery actions.

## Scope

Implement approved desktop/mobile fixes across create, share, resend, claim, checkout return, login, edit, loading, and error states with idempotency safeguards.

## Risks

Changes must not create duplicate orders, checkout sessions, emails, ownership claims, or misleading payment state.

## Verify Steps

Run web typecheck/tests and focused journey coverage for retry, stale/expired links, interruption, duplicate prevention, and responsive UI.

## Rollback Plan

Revert the task commit and redeploy the prior revision if checkout, claim, login, or editing regresses.

