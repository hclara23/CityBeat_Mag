---
id: "202610162233-TW2MMC"
title: "Deploy Basic versus Premium directory clarification"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: ["202610162227-RFJMJW"]
tags: ["deployment", "production", "directory"]
verify: ["npm run type-check --workspace=@citybeat/web"]
comments:
  - { author: "ORCHESTRATOR", body: "Start: deploy the approved Basic-versus-Premium directory clarification within the user-approved one-time Google Cloud Build cap of one dollar." }
doc_version: 2
doc_updated_at: "2026-10-16T22:42:48+00:00"
doc_updated_by: "agentctl"
description: "Release commits c1a4822 and fd2f531 through the guarded Cloud Run pipeline, promote only after candidate smoke tests pass, and verify the public English and Spanish directory comparison."
---
## Summary

Deploy the committed Basic-versus-Premium directory clarification to the production CityBeat Cloud Run service using the guarded candidate-first workflow.

## Scope

Push the committed release to main, allow GitHub Actions to build and deploy a no-traffic candidate, require automated smoke and security checks, promote to 100% only on success, and verify the public bilingual directory.

## Risks

Cloud Build incurs an estimated one-time cost of approximately .03 under the user-approved  cap. The workflow protects customers with a no-traffic candidate and automatically rolls back if live verification fails.

## Verify Steps

1. GitHub Actions run 38976495925 completed successfully. 2. Install, type-check, and full test steps passed. 3. Candidate revision deployed without traffic and passed smoke and payment security guards. 4. Revision citybeat-web-00324-mom received 100% production traffic. 5. Live /en, /en/directory, and /api/health returned HTTP 200. 6. English and Spanish directory HTML contains the localized plan comparison.

## Rollback Plan

The workflow automatically restores the previously serving Cloud Run revision if live verification fails. If a later issue appears, route 100% traffic back to the recorded prior revision.

## Notes

Deployment approved for one Google Cloud Build execution estimated at approximately .03 and capped at , with no recurring charge. Scoped production commit 52c721171cb7a63b84c4149b6989edbac05a6764 triggered GitHub Actions run 38976495925. Candidate smoke tests passed, including checkout input guards and unsigned webhook rejection; revision citybeat-web-00324-mom was promoted to 100% traffic from citybeat-web-00322-hiq. Live checks returned HTTP 200 for /en, /en/directory, and /api/health. Independent checks confirmed both /en/directory and /es/directory return 200 and contain their localized Basic-versus-Premium comparison headings.

