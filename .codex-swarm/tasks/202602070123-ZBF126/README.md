---
id: "202602070123-ZBF126"
title: " Backend API architecture check^"
status: "TODO"
priority: "high"
owner: "CODER"
depends_on: ["^[]^"]
tags: []
doc_version: 2
doc_updated_at: "2026-02-07T02:06:18+00:00"
doc_updated_by: "agentctl"
description: "^Role: Backend API Architect. Confirm backend approach such as Firebase or Supabase or Cloud Run. Identify missing endpoints and auth boundaries and data model gaps for next milestone. Propose changes.^"
---
## Summary

Align ads data model and API routes with Supabase, harden Stripe webhook verification, add Sanity server client for briefs.

## Scope

Schema updates: add profiles, campaigns, analytics, ad_purchases, and brief_submissions tables with RLS policies; ads API routes now use Supabase data; Stripe webhook verification corrected and campaign status updated on payment; briefs API uses Sanity server client.

## Risks

Supabase migrations are required before APIs work. Ads API now requires auth or ADS_DEMO_USER_ID in development; missing configuration will return 401. Stripe webhook verification changes must be validated with test events.

## Verify Steps

- ...

## Rollback Plan

- ...

## Verify Steps^

Run: npm run lint; npm run type-check; npm run build. Smoke: curl /api/campaigns with auth token; curl /api/briefs; Stripe webhook test event against /webhooks/stripe.

## Rollback Plan^

Revert commit f4a2c7f and restore prior schema and API routes. Re-run Supabase migrations if needed.

