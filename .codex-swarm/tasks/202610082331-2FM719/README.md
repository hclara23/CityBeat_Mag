---
id: "202610082331-2FM719"
title: "Launch reviewed image queue and automated sports section"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "Start: Build approved image review queue and authorized sports automation with a five-dollar monthly AI ceiling." }
doc_version: 2
doc_updated_at: "2026-10-08T23:43:43+00:00"
doc_updated_by: "agentctl"
description: "Build admin image queue with independent caption review, sports source controls and public page; test and deploy with explicit spending and source permission gates."
---
## Summary

Implement reviewed image posting queue and permission-gated sports aggregation for production.

## Scope

Admin image uploads, two independent vision passes, retry and duplicate protection, public sports page, licensed feed controls, tests and deployment preparation. Live paid usage requires explicit budget approval.

## Risks

AI hallucinations, image rights, feed licensing, duplicate public posts, external API costs and uncertain network outcomes. Fail closed and require review when uncertain.

## Verify Steps

Run npm test, web lint/type-check/build; verify admin authentication, review rejection, spending gate and production routes before enabling.

## Rollback Plan

Disable new automation flags; roll back Cloud Run revision while preserving existing Facebook credentials and queue records.

## Notes

Implemented image intake and stateless writer/reviewer pipeline, transactional monthly reservation and claims, conservative uncertain-publish handling, rights-gated sports intake and admin controls. OpenAI up to 5 USD/month and one-time Cloud Build up to 1 USD explicitly approved. No team feeds licensed; sports automation requires authorized source onboarding. Local build, lint and TypeScript passed; full test suite passed before final review. No production deployment yet.

