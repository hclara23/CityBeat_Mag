---
id: "202610151908-1V8V7X"
title: "Implement Premium SEO and pass-through traffic improvements"
status: "TODO"
priority: "high"
owner: "CODER"
depends_on: ["202610151908-65QK5Z"]
tags: ["seo", "directory", "analytics", "frontend", "backend"]
verify: ["npm --prefix apps/web run typecheck", "npm --prefix apps/web test"]
doc_version: 2
doc_updated_at: "2026-10-15T19:09:01+00:00"
doc_updated_by: "agentctl"
description: "Implement the approved findings from the Premium SEO audit so Premium listings receive valid crawl/indexing, metadata, structured-data, internal-linking, social-preview, and measurable outbound referral benefits while preserving Basic behavior and privacy. Include focused automated coverage."
---
## Summary

Implement verified SEO and pass-through measurement improvements for Premium listings.

## Scope

Apply approved audit findings to crawl/index controls, metadata, schema, sitemap/internal links, social previews, outbound tracking, and focused tests while preserving Basic behavior.

## Risks

SEO regressions, duplicate canonicals, invalid schema, analytics overcounting, or privacy leakage could harm listings.

## Verify Steps

Run web typecheck and tests; validate representative Premium and Basic output plus deduplicated outbound events.

## Rollback Plan

Revert the task commit and redeploy the prior revision if metadata, indexing, rendering, or tracking regresses.

