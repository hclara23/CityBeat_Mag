---
id: "202610310757-RH8JEB"
title: "Complete advertiser intake reporting support and social promotion tools"
status: "DOING"
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
doc_version: 2
doc_updated_at: "2026-10-31T08:47:50+00:00"
doc_updated_by: "agentctl"
description: "User approved plan and implementation of four remaining areas: local Docling/selective website extraction, truthful advertiser analytics including QR attribution, Chatwoot evaluation and accountable support workflow, Postiz scheduling integration and reusable HyperFrames template. Finish with full tests and a production release under the existing USD 1 one-time cap, no new monthly services and no subagents. Coordinate deployment task 202610310754-Y3EHBA."
---
## Summary

Complete four approved advertiser-value areas and ship a tested production release.

## Context

User authorized autonomous completion while away, including one further quality sweep. Existing USD 1 one-time deployment cap, no new monthly services, Docling local and no subagents remain binding.

## Scope

Owner-selected website extraction with review-only prefill; accurate listing/website/phone/QR reporting; evaluate Chatwoot and implement assigned/resolved customer follow-up in existing infrastructure; Postiz adapter/readiness and reusable locally rendered HyperFrames template. No customer campaign is sent as a test.

## Risks

External Postiz account/API and social channel credentials may not exist; do not fabricate a live integration or buy hosting. Chatwoot requires a persistent stack, so evaluate cost and use existing app capabilities where no-cost deployment is possible. Protect SSRF, private staff evidence, data access and paid entitlements.

## Verify Steps

Unit/security tests, full regression, TypeScript, isolated build, emulator integration, local desktop/mobile bilingual UI; candidate and live checks through deployment task 202610310754-Y3EHBA.

## Rollback Plan

Use the recorded previous Cloud Run revision. New optional integrations fail closed when unconfigured and add no scheduler. Existing customer billing and ownership stay unchanged.

## Notes

Implemented website prefill (5ed4bd2), truthful QR/reporting (042a17d), accountable support inbox (2e1142c), and local Postiz/HyperFrames tools (ee21ead). Final sweep repairs the existing Cloud Run internal-host QR redirect, adds same-origin guards and authorization/audit regression tests, prevents ambiguous branch import, improves accessible editor labels, and preserves failed deal removals. 1,037 tests pass; local production build passes; local emulator import checks pass; browser checks cover owner prefill selection/consent, support assignment/resolution/manual logging, non-publishing promotion drafts, English/Spanish mobile layouts, source-consistent traffic and capped-data table, directory filters/empty-state recovery. Both local video formats rendered and QR decoded. No production test customer writes, campaigns, or outbound mail. No Chatwoot/Postiz hosting configured; manual mailbox logging is explicit. Next: combined candidate deployment and live verification within existing $1 one-time cap.

