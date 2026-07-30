---
id: "202607301822-ZSCD9X"
title: "Repair article review queue route"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: ["202607212230-WQPVHN"]
tags: ["frontend", "routing", "admin", "deployment"]
verify: ["npm run test", "npm run type-check", "npm run build"]
commit: { hash: "2e293b0a40e57a4fa69d754208776942b41bf810", message: "🐛 ZSCD9X repair article review queue route" }
comments:
  - { author: "ORCHESTRATOR", body: "Approved by the user: repair the article Review Queue 404, preserve English and Spanish direct URLs, deploy the fix, and verify production routing." }
  - { author: "ORCHESTRATOR", body: "Start: correct the canonical Developer Control queue link, add locale-preserving compatibility redirects, verify route precedence and authentication behavior, then deploy and smoke-test production." }
  - { author: "ORCHESTRATOR", body: "verified: Cloud Run revision citybeat-web-00150-f2b is Ready with 100% traffic | details: English and Spanish article Review Queue URLs no longer return 404, the deployed Developer Control card targets /admin, individual review routing remains protected, health returned 200, and all tests, type checks, and production build passed." }
doc_version: 2
doc_updated_at: "2026-07-30T18:36:17+00:00"
doc_updated_by: "agentctl"
description: "Fix the Developer Control article Review Queue link, preserve localized /admin/review bookmarks with canonical redirects to /admin, verify individual /admin/review/[id] routes remain intact, deploy the web repair, and record production evidence."
---
## Summary

Repaired the article Review Queue 404 by correcting the Developer Control card and adding locale-preserving compatibility routes without changing the canonical admin queue or individual article review pages.

## Context

Production /en/admin/review and /es/admin/review return 404. The Developer Control team link points to /admin/review, but the queue is rendered by /[locale]/admin and individual reviews are rendered by /[locale]/admin/review/[id]. The current production rollback revision is citybeat-web-00149-nrk.

## Scope

Change the Developer Control Review Queue card to the canonical /admin route; add a localized /admin/review page that redirects to /admin for existing bookmarks and direct visits; leave /admin/review/[id] unchanged; validate routes, authentication redirects, tests, typecheck, and build; deploy and verify production English and Spanish behavior.

## Risks

A route collision could interfere with individual article review pages, or an incorrect redirect could lose locale or authentication return paths. The implementation uses a sibling static page alongside the existing [id] route and redirects within the current locale to the established queue.

## Verify Steps

Run npm run test, npm run type-check, and npm run build. Confirm the build contains both /[locale]/admin/review and /[locale]/admin/review/[id]. In production, confirm /en/admin/review and /es/admin/review redirect through their localized canonical /admin routes, the Developer Control HTML no longer contains a direct /admin/review card destination, and individual article review routing remains defined.

## Rollback Plan

Route Cloud Run traffic back to citybeat-web-00149-nrk if the new revision is unhealthy or review routing regresses. Reverting the link correction and redirect page restores the prior behavior without data changes.

## Notes

User approved implementation and production deployment on 2026-07-30. The frontend-design guidance preserved the established CityBeat editorial admin experience: no duplicate queue UI was introduced; the existing /admin workspace remains canonical. Pre-deployment verification passed: focused source regression check, all 46 automated tests, all four TypeScript package checks, and the full Next.js production build with 104 generated static pages. The build registers both localized /admin/review compatibility pages and the dynamic /admin/review/[id] article route. Cloud Run revision citybeat-web-00150-f2b became Ready at 2026-07-30T18:33:04Z and serves 100% of traffic; rollback target is citybeat-web-00149-nrk. Production /en/admin/review and /es/admin/review no longer return 404 and correctly enter localized admin authentication with redirectTo=/admin; protected individual review URLs also enter the admin authentication flow. The deployed Developer Control page bundle contains Review Queue with canonical /admin and no /admin/review destination. GET /api/health returned 200. No data migration or secret changes occurred.

