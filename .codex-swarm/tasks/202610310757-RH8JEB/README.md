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
  - { author: "ORCHESTRATOR", body: "start: recognize postal commas without weakening the eleven-city boundary | details: verify Varsity promotion eligibility, add operational guidance and preserve conflicting owner address details for review. Local production build and 1,038 tests pass." }
doc_version: 2
doc_updated_at: "2026-10-31T09:02:32+00:00"
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

Release 807eef1 deployed successfully as citybeat-web-00465-rat through run 41186157345. All 37 broad public checks and targeted SEO/privacy/QR/auth checks pass. Authenticated live UI confirms support inbox, promotion workbench, Varsity website preview and advertiser report. No listing content was saved. Live verification exposed a legacy postal comma before ZIP excluding Varsity from promotion eligibility; a narrow parser patch and regression tests are being validated locally before follow-up deployment. Official Varsity website preview gives Suite 14 while the listing says Suite 19: retain current owner content pending verification. Postiz remains unconfigured; local drafts work. Chatwoot evaluated with explicit manual mailbox logging. Local Docling/HyperFrames stay excluded from deployment.

