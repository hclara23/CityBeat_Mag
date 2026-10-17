---
id: "202610170155-KXPHD4"
title: "Add tracked Call Now action to directory listings"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["frontend", "directory", "analytics", "localization", "deployment"]
verify: ["npm test", "npm --prefix apps/web run type-check", "npm --prefix apps/web run build"]
comments:
  - { author: "ORCHESTRATOR", body: "Start: implement the approved bilingual Call Now action, track phone-click conversions, validate conditional rendering, and deploy within the authorized Google Cloud budget." }
doc_version: 2
doc_updated_at: "2026-10-17T01:55:20+00:00"
doc_updated_by: "agentctl"
description: "Increase qualified lead conversion by adding a prominent bilingual call action to public directory listing contact cards, reusing validated listing phone numbers and existing click analytics, with safe rendering for listings without phones."
---
## Summary

Add and release a prominent bilingual telephone conversion action on public business listing contact cards.

## Scope

Update the directory detail client to render Call Now or Llamar ahora only when a listing has a usable phone number; preserve the existing number link and map actions; record the call interaction with the established listing analytics endpoint; add focused automated coverage and deploy to production.

## Risks

Malformed phone values could produce unusable tel links, analytics must not block navigation, and the new control must remain readable on mobile and in both locales.

## Verify Steps

Run npm test, npm --prefix apps/web run type-check, and npm --prefix apps/web run build. Verify live English and Spanish listing pages show the call action only when a phone exists and that its destination is a tel URL.

## Rollback Plan

Revert the scoped component and test commit, redeploy the prior main revision, and confirm the original phone and map links remain operational.

## Notes

User approved implementation and Google Cloud deployment under the previously stated one-time  cap with no new recurring charge.

