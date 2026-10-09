---
id: "202610090407-BYADKB"
title: "Fix main menu spacing and responsive collapse"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "start: separate header logo navigation and controls | details: collapse menu before crowding; move Leaderboard and Submit to footer; preserve keyboard and resize behavior." }
doc_version: 2
doc_updated_at: "2026-10-09T04:09:46+00:00"
doc_updated_by: "agentctl"
description: "Approved header fix: separate logo, navigation and actions; collapse before collisions; verify signed-in/out desktop tablet mobile; deploy within remaining combined USD1 build cap. Dependencies none."
---
## Summary

Fix header collisions; move Leaderboard and Submit to footer per user request.

## Scope

Separate nonshrinking logo/nav/action groups; wider header; compact menu below1536px; preserve EN/ES toggle and account controls; footer EN/ES links; resize clears open overlay.

## Risks

Verify both auth states and EN/ES including320px; menu focus and body scroll must recover across breakpoint. No auth or billing changes. Deploy within approved remaining USD1 combined cap.

## Verify Steps

Type-check/lint/tests; isolated browser24cases across EN/ES signed-in/out widths320,390,768,1280,1536,1920; menu open/Escape/resize; production screenshot and link checks.

## Rollback Plan

Restore traffic to citybeat-web-machelle-ba00b28 and revert scoped header/footer changes.

## Notes

Initial matrix caught signed-in320px overflow; reduced small-screen logo and menu padding. Corrected320px Spanish preview fits305px content width. Remaining combinations no overlap/overflow. Main menu now5links; Leaderboard and Submit in footer.

