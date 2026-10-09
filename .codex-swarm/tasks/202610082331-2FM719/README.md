---
id: "202610082331-2FM719"
title: "Launch reviewed image queue and automated sports section"
status: "BLOCKED"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "Start: Build approved image review queue and authorized sports automation with a five-dollar monthly AI ceiling." }
  - { author: "ORCHESTRATOR", body: "Blocked: Queue and sports intake deployed and verified in production. Fully automatic current sports coverage still needs an authorized source with documented commercial reuse rights; awaiting user source choice. No unlicensed feeds enabled." }
doc_version: 2
doc_updated_at: "2026-10-09T00:06:14+00:00"
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

PASSED: npm test (564 tests), npm run lint --workspace @citybeat/web, npm run type-check --workspace @citybeat/web, local production build. Cloud Node22 build be1d8c04-a395-48bd-b19f-da734dbed2bb SUCCESS. Production revision citybeat-web-00275-7t8 serves 100 percent traffic. Public /en/sports and /es/sports return200. Unauthenticated social queue admin, sports admin and sports ingestion return401. Signed-in browser queue shows Active and 0.00 of5.00 reserved; sports admin loads with no sources. OpenAI read-only model lookup accepted; no paid inference or fake public test posts. Real uploaded image end-to-end publication remains unverified until an authorized image is submitted.

## Rollback Plan

Disable new automation flags; roll back Cloud Run revision while preserving existing Facebook credentials and queue records.

## Notes

Implemented and deployed commits493fe02,50bfbe6,8776d70. Two independent stateless vision passes, bounded retries, monthly500-cent reservation ledger, deterministic image dedupe, uncertain-publish stop, upload recovery. Sports public/admin pages and source-scoped automated push intake are live. Source permission and expiry gate publication. No third-party sports source has verified commercial reuse rights; no source is connected or content manufactured. OpenAI5USD/month and Cloud Build1USD one-time approvals recorded. Existing FB Page112338362142224 and scheduler preserved. Build used E2_MEDIUM with1200-second timeout; two superseded builds cancelled. Rollback revision citybeat-web-00274-wvk. Remaining blocker: user must identify authorized source or approve separate licensing/permission workflow.

