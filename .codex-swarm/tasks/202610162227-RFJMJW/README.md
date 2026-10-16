---
id: "202610162227-RFJMJW"
title: "Clarify Basic versus Premium directory plans"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["frontend", "directory", "conversion", "localization"]
verify: ["npm run type-check --workspace=@citybeat/web", "node --test --import tsx apps/web/src/lib/directory-entitlements.test.ts"]
commit: { hash: "c1a482231da4586f8cfe876d23aec51703e85812", message: "✨ 202610162227-RFJMJW clarify Basic and Premium directory value" }
comments:
  - { author: "ORCHESTRATOR", body: "Start: implement the approved customer-facing Basic versus Premium education plan across directory discovery, claiming, and owner management surfaces." }
  - { author: "ORCHESTRATOR", body: "verified: bilingual Basic and Premium education now appears in public browsing, claiming, and owner management | details: automated copy is aligned; type-check, production build, targeted tests, and responsive browser review passed." }
doc_version: 2
doc_updated_at: "2026-10-16T22:31:48+00:00"
doc_updated_by: "agentctl"
description: "Make the Basic and Premium listing differences unmistakable across public directory browsing, claim and upgrade flows, and owner dashboard using bilingual, entitlement-accurate copy and resilient responsive UI."
---
## Summary

Implemented a bilingual, entitlement-accurate Basic-versus-Premium comparison across the public directory, listing claim and upgrade flow, and owner dashboard. Aligned automated customer communications and sales guidance to the same distinction.

## Scope

Added a reusable responsive plan comparison component; labeled and explained Basic and Premium listing sections; clarified free claiming and Premium benefits; exposed the comparison in the dashboard; corrected Premium placement language in pricing, owner reports, sales follow-ups, staff guidance, and chat; added regression coverage preventing Premium from claiming Featured-only guaranteed placement.

## Risks

The local directory API had no accessible listing data in the preview environment, so the shared comparison component was visually verified on the public directory in English and Spanish and its claim-page integration was type-checked and production-built. Deployment remains a separate external action and requires specific cost approval if Cloud Build charges apply.

## Verify Steps

Passed npm run type-check --workspace=@citybeat/web; passed npm run build --workspace=@citybeat/web; passed 29 targeted pricing, billing, and entitlement tests; passed git diff --check. Browser review verified desktop and 390px mobile layouts, English and Spanish copy, accessible comparison structure, and no horizontal overflow.

## Rollback Plan

Revert the implementation commit to remove the shared comparison component and restore prior directory, claim, dashboard, pricing, report, sales, and chat copy.

## Notes

Premium is described as a richer card displayed before Basic listings, while guaranteed top-of-category placement remains explicitly reserved for Featured. No payment, subscription, deployment, production data, or external customer communication was triggered.

