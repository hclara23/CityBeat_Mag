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
doc_version: 2
doc_updated_at: "2026-10-09T02:15:45+00:00"
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

User approved correction. Local implementation only until deployment spending is approved.

