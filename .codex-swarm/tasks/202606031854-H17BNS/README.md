---
id: "202606031854-H17BNS"
title: "Implement City Directory and Google Maps Scraper"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
verify: ["npm run lint --workspace=@citybeat/web", "npm run type-check --workspace=@citybeat/web", "npm run build --workspace=@citybeat/web"]
commit: { hash: "627a271c60618c2f6d6e921181acba882a9c84aa", message: "✅ 25PSWJ close: update task status to DONE and document verification details" }
comments:
  - { author: "ORCHESTRATOR", body: "Start: implement local business directory with Puppeteer scraper, Stripe monthly claims, and manual editor approval workflow." }
doc_version: 2
doc_updated_at: "2026-06-03T18:55:04+00:00"
doc_updated_by: "agentctl"
description: "Create local business directory with Puppeteer scraper, Stripe monthly claims, and manual editor approval workflow."
---
## Summary

Implement local business directory with a Puppeteer crawler for pre-populating businesses, Stripe-based claiming subscription upgrade, and manual editor approval dashboard.

## Scope

Includes database schema modifications (directory_listings table), a Puppeteer scraper script, Stripe checkout endpoints, and directory UI pages.

## Risks

Low. The feature is modular and self-contained; it does not impact core article pages or existing login/auth flows.

## Verify Steps

Run full typecheck, linting, and Next.js production builds. Validate scraper and Stripe checkout handoff manually.

## Rollback Plan

Delete the new database tables, routes, and views, and revert commits to restore the clean main branch status.

