---
id: "202610082331-2FM719"
title: "Launch reviewed image queue and automated sports section"
status: "TODO"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
doc_version: 2
doc_updated_at: "2026-10-08T23:32:00+00:00"
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

