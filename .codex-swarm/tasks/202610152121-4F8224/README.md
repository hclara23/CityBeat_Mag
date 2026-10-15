---
id: "202610152121-4F8224"
title: "Deploy safeguards and publish first compliant expansion batch"
status: "DONE"
priority: "high"
owner: "INTEGRATOR"
depends_on: ["202610152121-SHHTPH"]
tags: ["release", "directory", "production"]
commit: { hash: "65e7e0cce74f35221ad85870fe6a4f2005acbc40", message: "✅ 4F8224 record production deployment and first validated batch" }
comments:
  - { author: "INTEGRATOR", body: "Start: deploy the verified directory safeguards within the approved two-dollar Google Cloud cap, verify production, then stage and audit the first official-source batch before bounded publication." }
  - { author: "INTEGRATOR", body: "verified: production revision citybeat-web-00322-hiq passed release checks | details: 274 active official-source candidates were imported hidden, 250 audited records were published, 23 remain queued, and all 1,729 merged duplicates remain unlisted." }
doc_version: 2
doc_updated_at: "2026-10-15T22:08:51+00:00"
doc_updated_by: "agentctl"
description: "After explicit deployment-cost approval, deploy the verified safeguards and source expansion, run a free-source dry run, publish only validated new records in a bounded batch, and verify canonical pages, sitemap inclusion, performance, and claim readiness."
---
## Summary

Deployed the guarded directory publication flow and official-source expansion to production revision citybeat-web-00322-hiq, then completed the first review-first West Texas electrical-contractor batch.

## Context

The pre-release audit found 1,728 hidden records were merged duplicates. Production deployment run 38813039699 succeeded and promoted revision citybeat-web-00322-hiq to 100 percent traffic. The new official-source templates were seeded disabled.

## Scope

Dry-ran the official TDLR West Texas electrical workflow, imported active unexpired candidates with Publish=false, audited all hidden records, and published one bounded batch of at most 250 eligible listings. No paid API, Google Places workflow, or recurring resource was enabled.

## Risks

One imported candidate was identified as a merged duplicate and remained hidden. The 23 remaining eligible candidates were intentionally left queued after the bounded 250-record publication. All 1,729 merged duplicates remain unlisted.

## Verify Steps

GitHub Actions production deployment 38813039699 passed tests, candidate smoke checks, promotion, and live verification. Public robots.txt, sitemap.xml, directory sitemap shard 0, directory page, and health endpoint returned HTTP 200. Production dry run returned 274 candidates. Live run inserted 274 hidden candidates. Publication audit returned 273 eligible and 1,729 merged duplicates. Bounded publication reported 250 published and 23 eligible remaining. Final directory totals: 9,785 total, 8,033 published, 1,752 unlisted.

## Rollback Plan

Route Cloud Run traffic back from citybeat-web-00322-hiq to citybeat-web-00320-tor if application behavior regresses. Newly imported records are identifiable by the West Texas electrical ScrapeFlow workflow; keep unpublished queued records hidden and use the guarded admin workflow for any corrective action.

## Notes

No additional recurring service was created. The first expansion source remains disabled after the manual run. Other West Texas official-source templates remain disabled for later staged review.

