---
id: "202604191853-PM1B0J"
title: "Import local author articles"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["content", "articles", "ui"]
verify: ["npm run type-check", "npm run lint", "npm run build"]
comments:
  - { author: "ORCHESTRATOR", body: "Start: inspect local author folders, convert article documents and media, wire them into the website, and verify." }
  - { author: "ORCHESTRATOR", body: "Start: convert local author folders into website article content and public media assets." }
doc_version: 2
doc_updated_at: "2026-04-19T19:07:09+00:00"
doc_updated_by: "agentctl"
description: "Import articles and media from the local articles and media author folders into the website, expose them on homepage and Stories pages, and keep Sanity data as an additional source where available."
---
## Summary

Imported the local author article folders into the website as published story content. The site now has 26 deduplicated local articles, each with a matching public media asset, visible from the homepage, Stories list, story detail pages, and the briefs API fallback.

## Scope

Converted DOCX article text from CityBeat_Admin and H.Caleb_Lara into apps/web/src/lib/localArticles.ts. Copied only referenced media into apps/web/public/articles-media. Updated the homepage to feature imported stories, updated Stories list/detail pages to render local content and images, kept Sanity briefs as an additional source, added API fallback data, and removed Ads/Studio from the shared default navigation fallback.

## Risks

The imported articles are static generated content, so future changes in the source articles and media folder require regenerating the dataset. The source articles include English copy only in the extracted files, so contentES currently mirrors contentEN. The raw source media folder remains untracked to avoid committing hundreds of megabytes.

## Verify Steps

npm run type-check passed. npm run lint passed. npm run build passed. Runtime smoke check passed on local dev server: /en/briefs returned 200, an imported story route returned 200, and /api/briefs?limit=3 returned imported article data with /articles-media image paths.

## Rollback Plan

Revert the task commit to remove apps/web/src/lib/localArticles.ts, apps/web/public/articles-media, the homepage and briefs route changes, API fallback changes, and the shared default navigation fallback change. The untracked source articles and media folder is not part of the rollback.

