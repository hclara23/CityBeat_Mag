---
id: "202604270132-T5MPW6"
title: "Fix admin review image lint warning"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["vercel", "lint", "nextjs"]
verify: ["npm run lint --workspace=@citybeat/web", "npm run type-check --workspace=@citybeat/web", "npm run build --workspace=@citybeat/web"]
comments:
  - { author: "ORCHESTRATOR", body: "Start: focused fix for the admin review image lint warning." }
doc_version: 2
doc_updated_at: "2026-04-27T01:33:31+00:00"
doc_updated_by: "agentctl"
description: "Replace the admin article review image preview with next/image and allow Supabase-hosted image URLs so Vercel lint/build stays clean."
---
## Summary

Replace the admin review page's raw img element with next/image and configure Next to allow Supabase-hosted images.

## Scope

- ...

## Risks

Low risk. The preview image remains decorative with empty alt text. next/image remote host validation requires Supabase domains to be allowlisted.

## Verify Steps

- ...

## Rollback Plan

Revert the two-file change to restore the previous img element and remove the Supabase remote image allowlist entry.


## Rollback Plan

- ...

