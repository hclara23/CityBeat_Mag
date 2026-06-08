---
id: "202606080453-BEW9TX"
title: "Publish pending articles and full app review"
status: "BLOCKED"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "Start: publish pending articles, audit app gaps and incomplete logic, and assess operational error notification readiness." }
  - { author: "ORCHESTRATOR", body: "Blocked: publishing pending articles needs a populated Supabase service key or authenticated Vercel/Supabase session; app review and verification completed locally." }
doc_version: 2
doc_updated_at: "2026-06-08T04:57:25+00:00"
doc_updated_by: "agentctl"
description: "Publish all pending_review articles, then review the CityBeat app for gaps, bugs, errors, incomplete logic, and operational error notification readiness."
---
## Summary

Reviewed the app for gaps, bugs, errors, incomplete logic, and error notification readiness. Publishing pending articles could not be completed because no usable Supabase service credentials are available locally and Vercel CLI is not authenticated.

## Context

The user approved publishing all pending articles and reviewing the whole app. The local `.env.vercel.production.local` file contains empty Supabase values, and `vercel env pull` failed because no Vercel credentials are present.

## Scope

Checked Supabase/Vercel credential availability, article publish paths, Sentry/error notification wiring, Next API routes, admin/creator workflows, directory claims/reviews, Stripe checkout/webhook paths, cron automation, worker scheduled flows, and local verification commands.

## Risks

Pending articles remain unpublished until a valid Supabase service-role key or an authenticated production admin/API path is available. Operational error notifications are incomplete: Sentry config exists but is not initialized by Next, shared logger is unused in API/worker paths, and worker scheduled failures only go to console logs. The review also found a Stripe checkout origin trust issue and admin article role-check drift.

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

Result: all passed. The web build still emits the existing Crawlee/browserslist critical dependency warning from the directory-ingest route.

## Rollback Plan

No application changes were made for this task. Roll back only the task record if desired.

## Notes

Required to publish articles: provide populated Supabase env values, log in Vercel CLI so `vercel env pull --environment=production` works, or provide an authenticated admin/API path that can publish pending articles. Recommended error notification path: wire existing Sentry config through Next instrumentation and `withSentryConfig`, use the shared logger in API/cron routes, and add worker alert forwarding via Sentry/HTTP/email for scheduled and webhook failures.

