---
id: "202610152120-4H2YQR"
title: "Publish validated backlog and scale Southwest directory"
status: "TODO"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["directory", "ingestion", "seo", "release"]
comments:
  - { author: "PLANNER", body: "Approved decomposition: protect merged records 202610152121-B8B5RR; expand free official sources 202610152121-YCE50A; scale SEO and discovery 202610152121-FR763D; verify 202610152121-SHHTPH; deploy and publish the first validated batch 202610152121-4F8224. Audit evidence: 1,728 hidden rows, all merged; 1,728 resolve to published canonical roots with no missing targets or cycles." }
doc_version: 2
doc_updated_at: "2026-10-15T22:09:25+00:00"
doc_updated_by: "agentctl"
description: "Coordinate the approved rollout through safeguards 202610152121-B8B5RR, compliant source expansion 202610152121-YCE50A, 100k-scale SEO and discovery 202610152121-FR763D, verification 202610152121-SHHTPH, and production release/first bounded import 202610152121-4F8224. The live audit found all 1,728 hidden rows are merged duplicates that resolve to 884 published canonical listings, so they must remain unpublished. Do not purchase data, paid APIs, or new cloud resources without specific price approval."
---
## Summary

Completed the approved directory scale foundation: protected canonical records, added disabled official-source workflows, scaled sitemap discovery, verified the release, deployed to production, and published the first audited expansion batch.

## Context

The original 1,728 hidden records were all merged duplicates resolving to published canonical roots and were not publication backlog. The rollout therefore focused on safe acquisition from official sources and bounded publication rather than exposing duplicates.

## Scope

Delivered tasks B8B5RR, YCE50A, FR763D, SHHTPH, and 4F8224: safe publication audit, official West Texas templates, sharded directory sitemaps, expanded Southwest city targeting, expiration filtering, full verification, production deployment, and first review-first import.

## Risks

Scaling toward 100,000 remains a staged operational program, not a one-time scrape. Twenty-three eligible electrical-contractor candidates remain queued after the first 250-record tranche. All expansion workflows remain disabled by default so later categories require their own dry run and audit.

## Verify Steps

All 652 automated tests passed, TypeScript passed, and the production Next build succeeded. GitHub deployment run 38813039699 succeeded. Production revision citybeat-web-00322-hiq serves 100 percent of traffic. The official electrical source produced 274 active candidates, 274 were imported hidden, 273 passed the audit, and 250 were published. Final counts are 9,785 total, 8,033 published, and 1,752 unlisted, comprising 1,729 merged duplicates and 23 queued eligible records.

## Rollback Plan

Revert Cloud Run traffic to citybeat-web-00320-tor for application rollback. Leave disabled workflows off. Use workflow provenance and the publication audit to isolate imported records; never bulk-publish merged or restricted records.

## Notes

No paid scraper or data API was used and no new recurring cloud resource was enabled. Future growth should repeat the same dry-run, hidden-import, audit, bounded-publication sequence for beauty, childcare, and hospitality sources.

