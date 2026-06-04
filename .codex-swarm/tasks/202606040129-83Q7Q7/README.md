---
id: "202606040129-83Q7Q7"
title: "Automate Crawlee directory ingest"
status: "TODO"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["directory", "crawlee", "vercel"]
verify: ["npm run type-check --workspace=@citybeat/lib", "npm run type-check --workspace=@citybeat/web", "npm run build --workspace=@citybeat/web"]
doc_version: 2
doc_updated_at: "2026-06-04T01:31:00+00:00"
doc_updated_by: "agentctl"
description: "Deploy a protected Vercel Cron endpoint for Crawlee directory ingestion and seed restaurants plus auto dealers from OpenStreetMap into unpublished CityBeat directory review rows."
---
## Summary
Added a protected Vercel Cron endpoint for daily Crawlee directory ingestion and seeded El Paso County restaurants plus auto dealers into the CityBeat directory review workflow.

## Scope
- Refactored the Crawlee ingest implementation into a reusable @citybeat/lib directory module.
- Added Restaurant and Auto Dealer focused ingestion for the El Paso County bounding box.
- Added a protected Next.js route at /api/cron/directory-ingest that runs the ingest with Supabase service credentials.
- Added a Vercel Cron schedule for daily runs at 10:00 UTC.
- Added CRON_SECRET to Vercel Production.
- Ran a production ingest for Restaurants and Auto Dealers.

## Risks
Moderate. Vercel Cron on Hobby can only run daily and serverless runtime limits may constrain very large crawls. The endpoint is protected with CRON_SECRET, and all ingested records remain unpublished for editor review.

## Verify Steps
- npm run type-check --workspace=@citybeat/lib
- npm run type-check --workspace=@citybeat/web
- npm run build --workspace=@citybeat/web
- npm run directory:ingest:write --workspace=@citybeat/lib -- --categories=Restaurant,"Auto Dealer" --limit=5000
- Verified Supabase has 814 unpublished Restaurant rows and 43 unpublished Auto Dealer rows from OSM.

## Rollback Plan
Remove or disable the Vercel Cron entry, delete /api/cron/directory-ingest, revert the Crawlee ingest refactor, and delete unpublished OSM rows for Restaurant and Auto Dealer if the seed should be removed.

