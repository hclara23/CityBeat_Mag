---
id: "202604270132-T5MPW6"
title: "Fix admin review image lint warning"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["vercel", "lint", "nextjs"]
verify: ["npm run lint --workspace=@citybeat/web", "npm run type-check --workspace=@citybeat/web", "npm run build --workspace=@citybeat/web"]
commit: { hash: "9bc076d0bb1a14d692d5637be2d90adf2ca08bce", message: "🛠️ T5MPW6 fix admin review image lint warning" }
comments:
  - { author: "ORCHESTRATOR", body: "Start: focused fix for the admin review image lint warning." }
  - { author: "ORCHESTRATOR", body: "verified: replaced raw admin review image with next/image, allowed Supabase image hosts, and verified lint, type-check, and production build." }
doc_version: 2
doc_updated_at: "2026-04-27T01:35:23+00:00"
doc_updated_by: "agentctl"
description: "Replace the admin article review image preview with next/image and allow Supabase-hosted image URLs so Vercel lint/build stays clean."
---
## Summary

Replace the admin review page's raw img element with next/image and configure Next to allow Supabase-hosted images.

## Scope

In scope: apps/web/src/app/[locale]/admin/review/[id]/page.tsx and apps/web/next.config.js. Out of scope: broader admin UI changes, Supabase schema changes, and auth changes.

## Risks

Low risk. The preview image remains decorative with empty alt text. next/image remote host validation requires Supabase domains to be allowlisted.

## Verify Steps

npm run lint --workspace=@citybeat/web passed. npm run type-check --workspace=@citybeat/web passed. npm run build --workspace=@citybeat/web passed.

## Rollback Plan

Revert commit 9bc076d to restore the previous img element and remove the Supabase remote image allowlist entry.

