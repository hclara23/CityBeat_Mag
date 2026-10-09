---
id: "202610090543-9RXVMW"
title: "Build Founders business signup funnel"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "start: build bilingual Founders search and claim or create funnel | details: preserve free Basic and ownership review; bill Founders once per business and standard plans per location; validate payment and duplicate safety with tests." }
doc_version: 2
doc_updated_at: "2026-10-09T05:58:28+00:00"
doc_updated_by: "agentctl"
description: "Approved dedicated Founders page: search or create business, verified ownership, Google sign-in, existing checkout and hard 100-business limit, Basic fallback. Build and test locally; no unapproved deployment spending."
---
## Summary

Built bilingual Founders funnel with search, Google sign-in handoff, verified claim, guided moderated Basic creation and optional checkout. User clarified Founders is one flat business fee including all locations; later standard signups remain per-location.

## Scope

Founders page/API, duplicate and ownership guards, checkout return paths/payment validation, new listing approval publishing, shared Founders quantity correction, tests and footer discovery. No production writes or subscriptions modified.

## Risks

Not deployed. Staff must verify ownership and content; missing on-file email uses support. New listings use optional public photo URL, with uploads available in owner CMS after approval. Old open checkouts with different terms require staff reconciliation, never silently reused. Duplicate legacy corpus capped at 10000 and cached for five minutes.

## Verify Steps

TypeScript passes. Full test suite passes: 601 web plus 20 shared tests. Isolated browser fixture confirms search, three-step creation, pending-review gate, three locations at 9.99 total, Spanish copy and no 390px overflow. No real checkout or production writes used.

## Rollback Plan

Revert this task commit before deployment. After release return traffic to prior revision; preserve any submitted listings for staff review. Never automatically alter existing subscriptions.

## Notes

Deployment requires separate build cost approval. Graphify checkout graph was outdated and only referenced legacy ads app; current source inspected directly. UI proof .tmp/founders-preview.png uses isolated fixture with no external requests.

