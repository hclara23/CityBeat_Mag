---
id: "202606040049-89S6AR"
title: "Add Crawlee directory ingest"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["directory", "crawlee", "ingest"]
verify: ["npm run type-check --workspace=@citybeat/lib"]
commit: { hash: "1a559257848c170a4505dc0270bdbbe7cc55ce84", message: "✨ 202606040049-89S6AR add Crawlee directory ingest" }
comments:
  - { author: "ORCHESTRATOR", body: "verified: added Crawlee OpenStreetMap directory ingest, ran dry-run and write-mode checks, and confirmed 250 unpublished OSM listings in Supabase." }
doc_version: 2
doc_updated_at: "2026-06-04T01:00:08+00:00"
doc_updated_by: "agentctl"
description: "Replace direct-publish directory scraping with a Crawlee-based OpenStreetMap ingest script that rate limits requests, deduplicates records, and inserts unpublished listings for editor review."
---
## Summary
Added a Crawlee-based directory ingest script that pulls El Paso business candidates from OpenStreetMap/Overpass, deduplicates them, and writes unpublished review candidates to Supabase.

## Scope
- Installed Crawlee and tsx in @citybeat/lib.
- Added npm scripts for dry-run and write-mode directory ingestion.
- Added packages/lib/src/scripts/ingest-directory-crawlee.ts with rate-limited Overpass crawling, category mapping, normalization, and Supabase upserts.
- Added packages/lib/src/scripts/README.md with operating instructions and safety defaults.
- Ran a controlled production write of 250 unpublished OSM listings for admin review.

## Risks
Moderate. The crawler touches production data when run with --write, but inserted rows are unpublished and use source-prefixed IDs to avoid collisions with existing Google place IDs. Overpass may rate-limit large runs, so imports should be batched.

## Verify Steps
- npm run type-check --workspace=@citybeat/lib
- npm run directory:ingest --workspace=@citybeat/lib -- --limit=5 --category=Restaurant
- npm run directory:ingest:write --workspace=@citybeat/lib -- --limit=250
- Verified Supabase has 250 unpublished OSM directory listings.

## Rollback Plan
Delete unpublished rows where google_place_id starts with osm:, then revert the Crawlee dependency, ingest scripts, and package script changes.

