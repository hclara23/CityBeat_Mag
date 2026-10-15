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
doc_updated_at: "2026-10-15T21:21:48+00:00"
doc_updated_by: "agentctl"
description: "Coordinate the approved rollout through safeguards 202610152121-B8B5RR, compliant source expansion 202610152121-YCE50A, 100k-scale SEO and discovery 202610152121-FR763D, verification 202610152121-SHHTPH, and production release/first bounded import 202610152121-4F8224. The live audit found all 1,728 hidden rows are merged duplicates that resolve to 884 published canonical listings, so they must remain unpublished. Do not purchase data, paid APIs, or new cloud resources without specific price approval."
---
## Summary

Safely expand CityBeat's published business directory from 7,782 toward 100,000 claim-ready Southwest listings without publishing merged duplicates or restricted-source content.

## Context

The live directory contains 9,510 records: 7,782 published and 1,728 hidden. Every hidden record is a merged sibling, and every merge chain resolves to one of 884 published canonical roots. The expansion must therefore add genuinely new businesses rather than publish the hidden duplicate rows.

## Scope

Publication safeguards, free official/open-data source templates, geographic expansion across the Southwest, deterministic deduplication, provenance and freshness, SEO/discovery scaling, staged verification, and a bounded first production import.

## Risks

Duplicate or closed businesses, restricted third-party content, malformed or thin pages, excessive database reads, crawl-budget waste, and unapproved paid API or deployment costs.

## Verify Steps

Require passing tests and type-checks, dry-run source counts, zero restricted-provenance writes, no broken merge chains, bounded publication batches, live canonical-page checks, sitemap validation, and measurable claim-readiness fields.

## Rollback Plan

Stop ingestion, unpublish only the new batch by recorded batch ID, retain source and audit records, and revert the release. Never republish merged siblings or delete canonical listings automatically.

## Notes

No paid source, API, cloud resource, or deployment is authorized by task creation. Obtain a price-specific approval before any such cost.

