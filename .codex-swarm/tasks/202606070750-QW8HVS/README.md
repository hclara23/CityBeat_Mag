---
id: "202606070750-QW8HVS"
title: "Fix audit review findings"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "Start: fix approved audit findings with regression tests for claim trust, public reviews, duplicate review points, upload gating, and Stripe worker integrity." }
doc_version: 2
doc_updated_at: "2026-06-07T07:57:52+00:00"
doc_updated_by: "agentctl"
description: "Fix audit findings for directory claim trust, public reviewer email exposure, duplicate review point inflation, creator upload gating, and worker Stripe webhook/refund integrity."
---
## Summary

Fixed the approved audit findings across directory claims, public reviews, creator uploads, and worker Stripe webhook/refund handling. Added focused regression tests for the security helper behavior and a Supabase migration for database-level backstops.

## Context

This task follows audit task 202606070742-HNSYN8. The fixes address the high-risk surfaces identified there without redesigning unrelated workflows.

## Scope

- Directory claim start now uses trusted listing phone data for SMS verification and rejects email verification until a trusted listing email exists.
- Directory claim verify now only self-verifies code_sent claims; postcard claims remain pending for manual/admin handling.
- Public review responses no longer select or return reviewer email addresses.
- Review POST rejects duplicate user/listing reviews and awards points only for a user's first review on a listing.
- Creator uploads now require creator-role access, enforce image size/type validation before buffering, and include a per-user in-process rate gate.
- Worker Stripe webhook validation now rejects stale signatures, stores payment intent IDs, and matches refunds by exact Stripe identifiers instead of amount.
- Migration 20260607080000_audit_security_fixes.sql de-duplicates existing reviews, adds a unique review index, and adds Stripe identity columns/indexes.

## Risks

Email-based directory claim verification is intentionally unavailable until a trusted listing email field is added. Existing ad purchase rows created before the new Stripe identity columns may not be exactly matchable for future refund events unless backfilled from Stripe. The upload rate gate is in-process and should be replaced with durable shared rate limiting for multi-instance production hardening.

## Verify Steps

Commands run:

- node --import tsx --test apps/web/src/lib/directory-security.test.ts
- node --import tsx --test services/worker/src/handlers/stripe-security.test.ts
- npm run type-check --workspace @citybeat/web
- npm run type-check --workspace @citybeat/worker
- npm run lint --workspace @citybeat/web
- npm run type-check --workspace @citybeat/lib
- npm run build --workspace @citybeat/web
- git diff --check

Result: all passed. The web build still emits the pre-existing Crawlee/browserslist critical dependency warning from the directory-ingest route.

## Rollback Plan

Revert the implementation commit and, if the Supabase migration has already been applied, drop idx_directory_reviews_listing_user_unique, idx_ad_purchases_stripe_charge_id, idx_ad_purchases_stripe_payment_intent_id, and the ad_purchases stripe_charge_id / stripe_payment_intent_id columns only if no newer code depends on them.

## Notes

Recommended follow-up: add a durable rate limiter for uploads and backfill existing ad_purchases Stripe identity fields from Stripe where possible.

