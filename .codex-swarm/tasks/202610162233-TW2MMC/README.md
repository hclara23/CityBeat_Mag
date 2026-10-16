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
doc_updated_at: "2026-10-16T22:33:12+00:00"
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

Confirm the deploy-web GitHub Actions run passes tests, candidate smoke checks, promotion, and live verification. Confirm English and Spanish public directory pages return HTTP 200 and expose the plan-comparison copy.

## Rollback Plan

The workflow automatically restores the previously serving Cloud Run revision if live verification fails. If a later issue appears, route 100% traffic back to the recorded prior revision.

## Notes

Approved vendor and cost: Google Cloud Build, one-time deployment estimated around .03 with a hard cap of . No new recurring service is authorized or created.

