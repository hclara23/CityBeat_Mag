---
id: "202610152121-FR763D"
title: "Scale directory SEO and discovery toward 100k listings"
status: "DONE"
priority: "high"
owner: "CODER"
depends_on: ["202610152121-B8B5RR"]
tags: ["code", "frontend", "seo"]
verify: ["npm test", "npm run type-check"]
commit: { hash: "85c16136fd103dfa9b620b41ea82952cc13b4939", message: "🔎 FR763D shard directory sitemaps and expand Southwest discovery" }
comments:
  - { author: "CODER", body: "Start: audit directory sitemaps, canonical routes, and discovery pagination, then implement scalable indexation for a six-figure listing catalog." }
  - { author: "CODER", body: "Start: audit directory sitemaps, canonical routes, and discovery pagination, then implement scalable indexation for a six-figure listing catalog." }
  - { author: "CODER", body: "Verified: scalable sitemap sharding and expanded local discovery passed 651 tests, TypeScript validation, and diff integrity checks." }
  - { author: "CODER", body: "verified: scalable directory sitemaps, regional guide coverage, 651 automated tests, and web type-check all pass without production writes." }
doc_version: 2
doc_updated_at: "2026-10-15T21:30:46+00:00"
doc_updated_by: "agentctl"
description: "Make directory browsing, sitemaps, canonical metadata, and operational metrics safe and indexable at 10k, 25k, 50k, and 100k published listings without full-collection public reads."
---
## Summary

Split directory listing discovery into scalable 45,000-URL sitemap shards while preserving the existing root sitemap, and expanded local guide coverage to West Texas and southern New Mexico cities.

## Scope

Added a cached published-listing count, generated directory sitemap shards under /directory/sitemap/{id}.xml, advertised the root and all directory shards in robots.txt, excluded unpublished and merged records, retained bilingual alternates, and added 13 regional cities to programmatic category/city guides.

## Risks

Firestore offset pagination reads skipped documents on later shards, so read cost grows with catalog size. Shards are hourly cached and limited to 45,000 URLs. Production release must verify generated sitemap routing and Firestore query compatibility before traffic promotion.

## Verify Steps

Run npm test and confirm 631 web tests plus 20 package tests pass. Run npm --prefix apps/web run type-check. Verify the 100,000-listing calculation produces three shards, each below 50,000 URLs, and robots.txt advertises the root plus every directory shard.

## Rollback Plan

Revert the implementation commit to restore a single root sitemap and the original eight-city guide coverage. No production content or billing state is changed by this task.

## Notes

Implemented against the Next.js 14 generateSitemaps contract. The root /sitemap.xml remains intact for existing Search Console submissions; directory shards are added separately. Full tests and TypeScript validation pass.

