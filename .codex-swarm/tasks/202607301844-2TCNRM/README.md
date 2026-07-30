---
id: "202607301844-2TCNRM"
title: "Replenish newsroom queue and vary article visuals"
status: "BLOCKED"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: ["202607301822-ZSCD9X"]
tags: ["frontend", "backend", "newsroom", "articles", "deployment"]
verify: ["npm run test", "npm run type-check", "npm run build"]
comments:
  - { author: "ORCHESTRATOR", body: "Approved by the user: populate the empty article review queue with a secure newsroom crawl, eliminate the repeated default article image everywhere, deploy the change, and verify production." }
  - { author: "ORCHESTRATOR", body: "Start: securely trigger the bounded newsroom crawl through Cloud Scheduler, verify pending-review records, repair any zero-draft failure if necessary, then replace recycled article imagery with deterministic editorial visuals and deploy." }
  - { author: "ORCHESTRATOR", body: "blocked: production is deployed and the retry path is verified, but Anthropic is rejecting rewrites because the account credit balance is too low | details: restore credits before the review queue can populate." }
doc_version: 2
doc_updated_at: "2026-07-30T19:12:43+00:00"
doc_updated_by: "agentctl"
description: "Securely trigger and verify the autonomous newsroom queue, diagnose any zero-draft ingestion failure, replace the fixed recycled article fallback photo across public surfaces with truthful deterministic CityBeat editorial visuals, test and visually verify the change, deploy it, and record production evidence."
---
## Summary

Populate the empty editorial review queue through the existing autonomous newsroom and replace the repeated missing-image stock photo with honest, varied CityBeat editorial visuals.

## Context

The enabled citybeat-auto-articles scheduler has returned HTTP 200, but Firestore currently contains zero articles with status pending_review. The public home, Stories, Topics, and Saved pages all substitute the same picsum.photos seed when article.image is absent, creating repetitive and potentially misleading presentation. Production currently serves Cloud Run revision citybeat-web-00150-f2b.

## Scope

Use the existing protected newsroom endpoint to request up to five non-published drafts and verify queue records. If it creates none, inspect only sanitized results and logs, repair the ingestion failure within the newsroom flow, and retrigger. Replace every fixed article fallback URL with a reusable deterministic CityBeat editorial visual keyed by real article category, title, and slug across home, stories, topics, and saved pages. Run automated and visual verification, deploy, and confirm the live queue and article surfaces.

## Risks

The manual crawl invokes the configured Anthropic newsroom and may consume API tokens; it remains bounded to five attempts and leaves drafts pending review. Reprocessing or clearing processed-news records is prohibited. Visual fallback changes could reduce readability or affect image layout, so they must preserve card aspect ratios, responsive behavior, real-image attribution, and existing CityBeat design tokens.

## Verify Steps

Confirm the protected crawl returns a sanitized successful result and Firestore contains pending_review drafts. Run a focused regression check proving the fixed Picsum seed is absent from article surfaces and deterministic fallbacks vary by article. Run npm run test, npm run type-check, and npm run build. Inspect representative desktop and mobile renders. In production, confirm Cloud Run readiness, the queue contains drafts, public story surfaces no longer reference the recycled fallback, and real article images still render unchanged.

## Rollback Plan

Route Cloud Run traffic back to citybeat-web-00150-f2b if the visual release is unhealthy. The crawl creates review drafts only; editors can reject unwanted drafts through the normal queue. No processed-news records will be deleted and no published article will be unpublished.

## Notes

Implementation commit 19bf472 adds explicit written, editorial-reject, and retryable-error outcomes with bounded hourly retries, plus deterministic category-colored CityBeat editorial visuals wherever an article has no real image. Local verification passed: 50 tests, all four package type checks, and the production Next.js build. Cloud Run revision citybeat-web-00151-pzl is Ready with 100% traffic; health and EN/ES Stories return 200, and live visual inspection confirms distinct branded cards replace the recycled default photo. A protected scheduler run returned 200 and converted eight skipped items into retryable provider failures, but pending_review remains zero because a minimal Anthropic health request returned invalid_request_error: the account credit balance is too low. Resume by restoring Anthropic credits, waiting until the recorded hourly retry time (or explicitly rearming the retry records), and rerunning citybeat-auto-articles. Rollback remains citybeat-web-00150-f2b.

