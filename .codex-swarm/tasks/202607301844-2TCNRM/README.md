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
  - { author: "ORCHESTRATOR", body: "Start: Anthropic funds were restored by the user; verify provider access, rerun the protected newsroom scheduler, confirm pending-review drafts, and close the task if production is healthy." }
  - { author: "ORCHESTRATOR", body: "blocked: Anthropic funds are present, but the account's specified API usage limit is reached until 2026-08-01 00:00 UTC | details: raise the API limit or wait for reset before the scheduler can create drafts." }
doc_version: 2
doc_updated_at: "2026-07-30T19:50:27+00:00"
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

Implementation commit 19bf472 and Cloud Run revision citybeat-web-00151-pzl repaired retry semantics and replaced recycled article imagery; later revision citybeat-web-00152-9lb retains those changes. Local and production verification previously passed, and 16 article candidates remain safely retryable. On 2026-07-30, after the user added Anthropic funds, a minimal production-credential health request still returned HTTP 400 invalid_request_error: the account has reached its specified API usage limits and will regain access on 2026-08-01 at 00:00 UTC. The full scheduler was intentionally not rerun while provider health was failing so additional candidates would not consume retry attempts. Resume by raising the Anthropic API usage limit or waiting until the stated reset time, then rerun citybeat-auto-articles and verify pending_review is greater than zero. Rollback remains citybeat-web-00151-pzl for the newsroom implementation and citybeat-web-00152-9lb is the current production revision.

