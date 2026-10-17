---
id: "202610170108-5F5X71"
title: "Revamp CityBeat homepage and directory UI"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["frontend", "ui", "directory", "responsive"]
verify: ["npm test", "npm --prefix apps/web run type-check", "npm --prefix apps/web run build"]
commit: { hash: "f45096d029ea5efed2f985b173d5a0f4fa616c38", message: "🧪 5F5X71 make encrypted-token tamper test cross-platform" }
comments:
  - { author: "ORCHESTRATOR", body: "Start: implement the approved editorial CityBeat redesign, validate desktop and mobile behavior, preserve existing business logic, and deploy only within the approved one-time  Google Cloud cap." }
  - { author: "ORCHESTRATOR", body: "Verified: all 666 automated tests pass, TypeScript reports no errors, the Next.js production build succeeds, and desktop plus 390px mobile visual reviews confirm readable responsive homepage and directory layouts." }
  - { author: "ORCHESTRATOR", body: "CI follow-up: fixed a cross-platform GBP encryption test that altered only unused base64url padding bits on Linux; all 666 tests pass after the deterministic tamper change." }
  - { author: "ORCHESTRATOR", body: "verified: all 666 tests, TypeScript, production build, responsive desktop/mobile review, both GitHub workflows, candidate smoke tests, traffic promotion, rollback gate, and all four English/Spanish public routes passed." }
doc_version: 2
doc_updated_at: "2026-10-17T01:08:33+00:00"
doc_updated_by: "agentctl"
description: "Translate the approved editorial reference into CityBeat's production homepage, shared shell, and business directory while preserving bilingual content, SEO, listings, claims, advertising, analytics, accessibility, and responsive behavior; verify and deploy within the explicitly approved one-time Google Cloud charge cap of ."
---
## Summary

Revamp the public CityBeat experience around a sharper editorial homepage and a compact, mobile-first business directory inspired by the approved reference image.

## Context

The current site already supports bilingual content, live listings, claims, plans, advertising, analytics, and SEO. The redesign must improve visual hierarchy and discovery without changing those contracts.

## Scope

Refresh the shared public shell/header, homepage hero and editorial category presentation, and directory search/category navigation and cards. Use the selected CityBeat logo asset, retain English and Spanish copy, and preserve all existing actions and data flows.

## Risks

Primary risks are mobile overflow, reduced accessibility, weakened SEO content, regressions in directory filtering and claim flows, and accidental changes to revenue or analytics behavior. Changes will remain presentation-focused and use existing routes and data.

## Verify Steps

Run the web test suite, TypeScript typecheck, and production build. Inspect the English and Spanish homepage and directory at desktop and mobile viewports. Verify search, category filters, premium/basic distinctions, navigation, and public production responses after deployment.

## Rollback Plan

Revert the isolated redesign commit and redeploy the prior known-good Cloud Run revision if visual or functional regressions appear.

## Notes

User approved the plan and a one-time Google Cloud deployment charge capped at . No recurring service or paid asset is authorized.

