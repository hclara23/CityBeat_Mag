---
id: "202607301822-ZSCD9X"
title: "Repair article review queue route"
status: "TODO"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: ["202607212230-WQPVHN"]
tags: ["frontend", "routing", "admin", "deployment"]
verify: ["npm run test", "npm run type-check", "npm run build"]
comments:
  - { author: "ORCHESTRATOR", body: "Approved by the user: repair the article Review Queue 404, preserve English and Spanish direct URLs, deploy the fix, and verify production routing." }
doc_version: 2
doc_updated_at: "2026-07-30T18:22:21+00:00"
doc_updated_by: "agentctl"
description: "Fix the Developer Control article Review Queue link, preserve localized /admin/review bookmarks with canonical redirects to /admin, verify individual /admin/review/[id] routes remain intact, deploy the web repair, and record production evidence."
---
## Summary

Repair the article Review Queue 404 while keeping the existing editorial admin experience and individual article review routes intact.

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

User approved implementation and production deployment on 2026-07-30. The frontend-design guidance will preserve the established CityBeat editorial admin styling rather than introduce a duplicate queue interface. No data migration or secret changes are required.

