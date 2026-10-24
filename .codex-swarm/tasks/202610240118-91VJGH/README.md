---
id: "202610240118-91VJGH"
title: "Release verified directory search improvements"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: ["202610240056-BZVEW5"]
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "start: record approved directory release checks, no-traffic candidate, USD1 cap and unchanged listing data." }
  - { author: "ORCHESTRATOR", body: "start: exclude local review artifacts from cloud packaging and add reproducible loopback-only outage injection | details: verify final build, full suite, emulator and successful browser Retry recovery." }
  - { author: "ORCHESTRATOR", body: "start: record successful immutable directory deployment, candidate and public smoke checks, cost evidence and protected import scope | details: add reusable production directory smoke verification." }
doc_version: 2
doc_updated_at: "2026-10-24T01:29:37+00:00"
doc_updated_by: "agentctl"
description: "Finish outage recovery and final build checks; deploy no-traffic Cloud Run candidate and promote after verification. One-time Google Cloud cap USD1; no imports or subagents."
---
## Summary

Release directory improvements with verified recovery and candidate promotion under a USD1 one-time Google Cloud cap.

## Context

User approved deployment after remaining checks, up to USD1 one-time, no subagents.

## Scope

Local outage/retry verification and final tests/build; no-traffic candidate; production smoke and observation. No listing imports, billing changes or subagents.

## Risks

Metered build/runtime costs; stale search cache up to 15 minutes; 25k corpus ceiling. Preserve service settings and rollback revision citybeat-web-00370-quv. Exclude local review data from upload.

## Verify Steps

Full test suite, TypeScript, final build, local outage/retry UI, candidate and public directory API/UI smoke, revision and error checks.

## Rollback Plan

If candidate checks fail, do not promote. After promotion, restore traffic to citybeat-web-00370-quv if a verified release regression requires recovery; preserve original settings.

## Notes

Live revision citybeat-web-directory-f3d6972 at 100 percent traffic. Candidate and public directory suites plus 37 broader smoke checks passed. 8038 listings, 335 pages. Build c6d49a37 succeeded in 237.19 seconds, estimated compute USD0.06167. Initial ERROR query empty. Post-release observation started 2026-10-24 01:28:21 UTC; no imports or financial mutations. Receipt docs/audits/directory-release-2026-10-23.md.

