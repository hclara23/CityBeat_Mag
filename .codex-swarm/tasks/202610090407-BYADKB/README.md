---
id: "202610090407-BYADKB"
title: "Fix main menu spacing and responsive collapse"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
commit: { hash: "555b19bb79aabacfabac2a2c77dbf7e75b218339", message: "🚧 BYADKB start: separate header logo navigation and controls | details: collapse menu before crowding; move Leaderboard and Submit to footer; preserve keyboard and resize behavior." }
comments:
  - { author: "ORCHESTRATOR", body: "start: separate header logo navigation and controls | details: collapse menu before crowding; move Leaderboard and Submit to footer; preserve keyboard and resize behavior." }
  - { author: "ORCHESTRATOR", body: "verified: deploy spaced responsive header | details: move Leaderboard and Submit to bilingual footer; test signed-in/out layouts, keyboard recovery, breakpoint resize and public content regression." }
doc_version: 2
doc_updated_at: "2026-10-09T04:25:50+00:00"
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

LIVE citybeat-web-header-555b19b at100%. Buildbcce923f-be48-4ebd-a4e4-14ad7fb725e6 SUCCESS digestsha256:ea587ce1ad491e6e27758680ba858f2398099bcf70319593bfa5a4d1107e0868. EN/ES footer links verified; header removes both links. Public signed-in desktop no group overlap/overflow and320px header content305px fits305px. Candidate Spanish signed-out desktop passes. Local menu Escape returns focus and resize clears scroll lock. Full tests/typecheck/lint pass; Machelle public regression passes. Within approved combined USD1 cap.

