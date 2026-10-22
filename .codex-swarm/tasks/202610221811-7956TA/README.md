---
id: "202610221811-7956TA"
title: "Deploy customer action tracking fixes and verify live revision"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: ["202610221253-QF37BA"]
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "start: deploy approved tracking fixes | details: verify exact release workflows and live revision without customer events" }
doc_version: 2
doc_updated_at: "2026-10-22T18:11:16+00:00"
doc_updated_by: "agentctl"
description: "Push approved tracking fixes; verify Test and Lint and Deploy Web App for the release SHA; confirm live revision using non-counting read-only probes. Approved deployment cap USD1 and image storage USD0.10 per GiB monthly; no billing changes."
---
## Summary

Deploy committed customer tracking repairs and verify both GitHub workflows plus the public production revision.

## Scope

Push main, observe existing deployment pipeline, inspect Cloud Run traffic and health, and check deployed tracking validation without generating customer events.

## Risks

User approved up to USD1 deployment plus image storage at USD0.10/GiB/month. No billing changes or synthetic valid tracking/lead submissions. Existing pipeline uses candidate smoke checks before promotion.

## Verify Steps

Confirm Test and Lint and Deploy Web App succeed for pushed SHA. Check live health revision matches Cloud Run 100 percent traffic revision and source build. Use raw HTTP GET and rejected invalid tracking probes only.

## Rollback Plan

Existing deployment workflow retains previous revision and restores it if promoted live smoke checks fail.

