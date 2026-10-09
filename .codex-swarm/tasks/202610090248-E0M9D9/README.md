---
id: "202610090248-E0M9D9"
title: "Feature Premier print cover story on homepage"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "start: feature Premier print cover and full source article | details: preserve archive context and current listing links" }
  - { author: "ORCHESTRATOR", body: "start: publish source-faithful Premier cover feature | details: retain uncropped cover and original PDF; add archive article with responsive layout and sitemap" }
  - { author: "ORCHESTRATOR", body: "start: add cover feature and article components | details: preserve full print transcription and asset tests" }
  - { author: "ORCHESTRATOR", body: "start: add optimized Premier photos and H. Caleb Lara byline | details: add tested social sharing and resilient copy-link feedback" }
  - { author: "ORCHESTRATOR", body: "start: match Premier pointer-following image glare | details: preserve clicks and full framing; respect touch and reduced-motion preferences" }
  - { author: "ORCHESTRATOR", body: "start: add subtle desktop tilt to both article photos | details: preserve glare-only cover and static touch/reduced-motion behavior." }
doc_version: 2
doc_updated_at: "2026-10-09T03:14:56+00:00"
doc_updated_by: "agentctl"
description: "Approved: extract supplied Premier PDF; feature approved October-November cover and full article on homepage; verify desktop and mobile. Preserve archive context; no unapproved paid deployment."
---
## Summary

Feature Premier Clinic October-November cover story on the homepage with complete readable print article.

## Scope

Homepage cover feature and article route with archival label, original PDF, existing optimized cover and source-faithful text. Retain existing news below it.

## Risks

Printed staff and service information may be historical; preserve original article with prominent archive note and link to current listing. No invented issue year.

## Verify Steps

Compare text with rendered PDF; run typecheck/lint/tests; inspect desktop and mobile feature and article.

## Rollback Plan

Revert scoped feature and article files; no business listing data changes.

## Notes

Added subtle pointer-driven tilt to both top team and bottom community article photos, with stable outer hit bounds and reset on pointer leave/cancel. Cover remains glare-only. Touch and reduced-motion users receive static photos. Earlier full suite: 590 tests pass; verifying final change before committed-source production build within existing USD1 cap.

