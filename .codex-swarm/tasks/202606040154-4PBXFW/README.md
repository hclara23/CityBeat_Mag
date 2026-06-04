---
id: "202606040154-4PBXFW"
title: "Add directory publish all action"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["directory", "admin", "frontend"]
verify: ["npm run type-check --workspace=@citybeat/web", "npm run build --workspace=@citybeat/web"]
commit: { hash: "7e577c316cb947036a11a878ce299dbc584c18b2", message: "✨ 4PBXFW add directory publish all action" }
comments:
  - { author: "ORCHESTRATOR", body: "Start: implementing directory publish-all control and production publish pass." }
  - { author: "ORCHESTRATOR", body: "verified: added directory publish-all control and published current pending listings." }
doc_version: 2
doc_updated_at: "2026-06-04T01:59:18+00:00"
doc_updated_by: "agentctl"
description: "Add a bulk publish control for unpublished directory listings and use it to publish pending businesses."
---
## Summary
Add a bulk Publish All action to the admin directory manager so editors can publish every currently unlisted business in one operation.

## Scope
- Add an authenticated admin API endpoint at /api/admin/directory/publish-all.
- Add a Publish All button beside Add Listing on the directory manager page.
- Publish current production pending/unlisted directory listings.

## Risks
- Bulk publication is intentionally broad and affects every directory listing with is_published = false.
- The button includes a confirmation prompt and is disabled when there are no unlisted records in the loaded admin view.

## Verify Steps
- npm run type-check --workspace=@citybeat/web
- npm run build --workspace=@citybeat/web
- Confirm production pending count is 0 after the service-role update.

## Rollback Plan
- Revert the UI/API commit if the bulk action should be removed.
- To undo the production data change, manually set specific directory_listings rows back to is_published = false from Supabase backups or targeted IDs.

