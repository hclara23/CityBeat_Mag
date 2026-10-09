---
id: "202610090248-E0M9D9"
title: "Feature Premier print cover story on homepage"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
commit: { hash: "36205b0dcf084ff5aaadd94af5668db6acf511bc", message: "🚧 E0M9D9 start: add subtle desktop tilt to both article photos | details: preserve glare-only cover and static touch/reduced-motion behavior." }
comments:
  - { author: "ORCHESTRATOR", body: "start: feature Premier print cover and full source article | details: preserve archive context and current listing links" }
  - { author: "ORCHESTRATOR", body: "start: publish source-faithful Premier cover feature | details: retain uncropped cover and original PDF; add archive article with responsive layout and sitemap" }
  - { author: "ORCHESTRATOR", body: "start: add cover feature and article components | details: preserve full print transcription and asset tests" }
  - { author: "ORCHESTRATOR", body: "start: add optimized Premier photos and H. Caleb Lara byline | details: add tested social sharing and resilient copy-link feedback" }
  - { author: "ORCHESTRATOR", body: "start: match Premier pointer-following image glare | details: preserve clicks and full framing; respect touch and reduced-motion preferences" }
  - { author: "ORCHESTRATOR", body: "start: add subtle desktop tilt to both article photos | details: preserve glare-only cover and static touch/reduced-motion behavior." }
  - { author: "ORCHESTRATOR", body: "verified: published October-November cover feature, source-faithful article, H. | details: Caleb Lara byline, optimized photos, functional share links, and accessible glare/tilt.; Production smoke checks and local test suite pass." }
doc_version: 2
doc_updated_at: "2026-10-09T03:29:04+00:00"
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

LIVE: citybeat-web-cover-36205b0 receives 100% traffic. Build c1035d45-8131-4c12-a355-1a8a58205a49 SUCCESS; image digest sha256:d10e9c459d5f94a7bd2795e8e8a1cbff4d20ee2a1ba0eac3c6a9ff0e78110658. EN/ES public homepage and article smoke checks pass, original PDF SHA256 preserved, both WebP photos load. Browser verifies desktop images, both photo tilt flags, cover glare only, and mobile no overflow. Full tests, type-check and lint pass. Candidate regression confirms anonymous edit rejection, private-field stripping, three locations, sports/login health. Source commit 36205b0dcf08. Rollback revision citybeat-web-popup-58149df. Build remains within approved combined USD1 cap.

