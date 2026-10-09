---
id: "202610090215-AQFGN6"
title: "Make Premier promotion a compact dashboard overlay"
status: "DONE"
priority: "med"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
commit: { hash: "58149df2a6ea8c5d7197d255918abdf9e411d16f", message: "🚧 AQFGN6 start: compact dashboard promotion overlay | details: lighten backdrop and add accessible close button; verify dismissal retains countdown" }
comments:
  - { author: "ORCHESTRATOR", body: "start: implement approved compact dashboard overlay" }
  - { author: "ORCHESTRATOR", body: "start: compact dashboard promotion overlay | details: lighten backdrop and add accessible close button; verify dismissal retains countdown" }
  - { author: "ORCHESTRATOR", body: "verified: compact translucent popup deployed at100 percent traffic | details: candidate and public smoke tests passed; countdown and offer unchanged" }
doc_version: 2
doc_updated_at: "2026-10-09T02:35:47+00:00"
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

Deployed source58149df via successful Cloud Build c6e28a7e-8f56-4c16-8e0f-45210f7999b2. Revision citybeat-web-popup-58149df serves100 percent. Candidate and public domain smoke checks passed, including sign-in, EN/ES listing, cover, sports, anonymous edit rejection and private-field stripping. Local browser verified compact popup and dismissal. No customer login, checkout or email sent. Approximate combined builder cost USD0.14 remains below approved USD1 cap.

