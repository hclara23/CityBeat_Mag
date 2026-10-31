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
doc_version: 2
doc_updated_at: "2026-10-31T08:03:30+00:00"
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

Intake: added authenticated owner/staff website preview with three-per-hour limit, HTTPS-only DNS-pinned public IPv4 fetching, same-site bounded redirects, byte/time limits, local-address filtering and explicit field selection. No AI service or new recurring service. Four extraction/security tests and TypeScript pass. Read-only real Varsity website extraction produced website/name/description/address; nothing saved to production. Continue QR reporting, support, social and combined release.

