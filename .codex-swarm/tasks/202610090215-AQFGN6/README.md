---
id: "202610090215-AQFGN6"
title: "Make Premier promotion a compact dashboard overlay"
status: "DOING"
priority: "med"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "start: implement approved compact dashboard overlay" }
  - { author: "ORCHESTRATOR", body: "start: compact dashboard promotion overlay | details: lighten backdrop and add accessible close button; verify dismissal retains countdown" }
doc_version: 2
doc_updated_at: "2026-10-09T02:16:55+00:00"
doc_updated_by: "agentctl"
description: "Approved correction: compact translucent modal over existing dashboard; retain dismissal and countdown; verify and commit. No new paid deployment authorized."
---
## Summary

Compact translucent Premier promotion overlay over the existing dashboard.

## Scope

Presentation only: reduce modal width and spacing, lighten backdrop, add accessible close button; preserve pricing, claim, checkout and countdown.

## Risks

Small screens must remain scrollable; close controls must not trigger payment.

## Verify Steps

Run web typecheck and lint; inspect rendered popup and dismissal in local browser.

## Rollback Plan

Revert task-scoped component change; no data or payment migrations.

## Notes

Implemented compact 384px modal with 25-percent backdrop, translucent card, accessible close button and viewport scroll bounds. Local browser confirms popup overlays content and closing it preserves countdown. Typecheck, lint and diff check pass. Preview uses simulated account, not real dashboard data. Deployment pending cost approval.

