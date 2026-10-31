---
id: "202610310757-RH8JEB"
title: "Complete advertiser intake reporting support and social promotion tools"
status: "BLOCKED"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: ["202610310728-08DNQA"]
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "Start: implement the four approved production-value improvements sequentially with local validation, no subagents and no new recurring service." }
  - { author: "ORCHESTRATOR", body: "start: add reviewed website prefill with DNS-pinned fetching, bounded local business extraction, owner field selection and security tests" }
  - { author: "ORCHESTRATOR", body: "start: separate website and phone clicks from QR campaign visits, preserve short-link attribution and add reporting regression tests" }
  - { author: "ORCHESTRATOR", body: "start: add accountable support assignment, conflict-safe resolution and manual reply logging | details: document Chatwoot cost and integration boundaries" }
  - { author: "ORCHESTRATOR", body: "start: add reviewed local promotion drafts and Postiz scheduling adapter with duplicate prevention | details: render and validate reusable local HyperFrames templates" }
  - { author: "ORCHESTRATOR", body: "start: harden advertiser tools for release | details: restore public QR redirects behind Cloud Run, enforce origin and MFA guards, preserve support audit concurrency, prevent ambiguous branch imports, improve editor labels and error recovery, and gate candidate deployment with regression checks. Local production build and 1,037 tests pass; mobile English/Spanish browser flows verified." }
  - { author: "ORCHESTRATOR", body: "start: recognize postal commas without weakening the eleven-city boundary | details: verify Varsity promotion eligibility, add operational guidance and preserve conflicting owner address details for review. Local production build and 1,038 tests pass." }
  - { author: "ORCHESTRATOR", body: "blocked: all implemented app tools are deployed and verified | details: live Postiz scheduling still needs an authorized existing account and channel, or confirmation to keep local drafts only. No paid hosting or public test campaign was created. Two genuine customer promotion drafts are ready for review." }
doc_version: 2
doc_updated_at: "2026-10-31T09:15:26+00:00"
doc_updated_by: "agentctl"
description: "User approved plan and implementation of four remaining areas: local Docling/selective website extraction, truthful advertiser analytics including QR attribution, Chatwoot evaluation and accountable support workflow, Postiz scheduling integration and reusable HyperFrames template. Finish with full tests and a production release under the existing USD 1 one-time cap, no new monthly services and no subagents. Coordinate deployment task 202610310754-Y3EHBA."
---
## Summary

Deployed reviewed website prefill, truthful advertiser/QR reporting, accountable customer follow-up, and a production local-draft workbench with tested Postiz adapter. Local Docling and portrait/landscape HyperFrames pilots pass. Live Postiz scheduling remains blocked on an authorized existing account/channel or user acceptance of drafts-only scope.

## Context

User authorized autonomous completion while away, including one further quality sweep. Existing USD 1 one-time deployment cap, no new monthly services, Docling local and no subagents remain binding.

## Scope

Owner-selected website extraction with review-only prefill; accurate listing/website/phone/QR reporting; evaluate Chatwoot and implement assigned/resolved customer follow-up in existing infrastructure; Postiz adapter/readiness and reusable locally rendered HyperFrames template. No customer campaign is sent as a test.

## Risks

External Postiz account/API and social channel credentials may not exist; do not fabricate a live integration or buy hosting. Chatwoot requires a persistent stack, so evaluate cost and use existing app capabilities where no-cost deployment is possible. Protect SSRF, private staff evidence, data access and paid entitlements.

## Verify Steps

Unit/security tests, full regression, TypeScript, isolated build, emulator integration, local desktop/mobile bilingual UI; candidate and live checks through deployment task 202610310754-Y3EHBA.

## Rollback Plan

Return traffic to citybeat-web-00465-rat for the final postal-format patch, or the original citybeat-web-00463-sup for the combined release. Do not delete reviewable promotion drafts or change billing. Unconfigured Postiz stays disabled; no scheduler or external publishing was added.

## Notes

Final source ef8c6be deployed through successful run 41187047530 as citybeat-web-00467-zuj at 100% traffic. 1,038 local tests and production build pass; 37 broad live checks plus targeted privacy, bilingual SEO, QR and mutation guards pass. Authenticated live checks verify support inbox, Varsity website extraction without changing owner content, separate advertiser counters, GA4/Cloudflare source selection and capped-data disclosure. Varsity is eligible after postal punctuation fix. Genuine reviewable Varsity and Super H promotion drafts were saved and survived reload; nothing published. Docling/HyperFrames remain local; both 12-second video formats rendered and QR decoded. Chatwoot evaluated; mailbox replies require explicit manual logging. No Postiz credentials/channel configured; async question pending. Owner confirmation remains appropriate for Varsity website Suite 14 versus listing Suite 19. Operating guide: docs/ADVERTISER-TOOLS-OPERATIONS.md. No new recurring service or subagent. Two successful Cloud Builds total 10.787 minutes, estimated compute USD 0.0647 at USD 0.006/min using raw UTC timestamps; excludes CI/storage and final invoice.

