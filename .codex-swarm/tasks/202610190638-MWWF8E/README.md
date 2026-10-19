---
id: "202610190638-MWWF8E"
title: "Deploy audit remediation candidate and verify release"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "Start: user approved one-dollar one-time deployment; build no-traffic candidate, run release checks and promote exact revision only if gates pass." }
doc_version: 2
doc_updated_at: "2026-10-19T06:40:10+00:00"
doc_updated_by: "agentctl"
description: "Deploy commit 457e84b with no traffic under the approved one-dollar one-time cap, test candidate, promote only on passing release checks, and verify public production with rollback available."
---
## Summary

Deploy committed audit remediation as a no-traffic candidate under the user-approved one-dollar one-time cap, verify, then promote only after passing release gates.

## Scope

Immutable source 457e84b; existing Cloud Run service and runtime secrets preserved. Add non-charging release smoke test and record candidate, traffic, cost estimate and rollback evidence.

## Risks

Next/React major migration and nonce CSP require candidate checks. Existing Cloudflare missing reporting token, GA operator access and dev-only advisories remain separate open findings. Do not claim provider analytics verified.

## Verify Steps

Run localized response security assertions, public and private route smoke checks, payment authentication probe, malformed checkout/webhook rejection, sitemap cold/warm checks and browser navigation. Repeat on public origin after exact-revision promotion.

## Rollback Plan

Keep citybeat-web-00336-yen serving while candidate is tested. On failed candidate gate do not promote. On post-promotion failure route 100 percent back to that exact revision, preserving runtime credentials.

