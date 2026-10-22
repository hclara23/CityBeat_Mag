---
id: "202610162218-BYCTXK"
title: "Document free claimed versus Premium listing perks"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["directory", "product"]
commit: { hash: "01d0b512c0a15b08d38eb49d085ec169896cb3bf", message: "📋 202610162218-BYCTXK document verified free and Premium listing benefits" }
comments:
  - { author: "ORCHESTRATOR", body: "Start: inspect current listing entitlements and distinguish enforced free-claim benefits from paid Premium benefits and marketing-only language." }
  - { author: "ORCHESTRATOR", body: "verified: current server entitlements, owner controls, lead delivery, analytics shaping, directory presentation, pricing, and SEO output were compared and caveats were documented." }
doc_version: 2
doc_updated_at: "2026-10-16T22:19:49+00:00"
doc_updated_by: "agentctl"
description: "Audit the current CityBeat directory entitlement, pricing, editing, analytics, lead, placement, and SEO code and provide an accurate side-by-side customer comparison."
---
## Summary

Audited the currently enforced CityBeat directory behavior and documented the customer-facing differences between an approved claimed Basic listing and an active Premium listing.

## Scope

Compared server-side entitlements, owner editing controls, lead delivery and masking, analytics response shaping, directory presentation, pricing, and listing SEO/schema behavior. No product code or production data was changed.

## Risks

Marketing copy is broader than the current implementation in a few places. Premium does not include Featured-only guaranteed priority placement, category benchmarking, or multi-location tools. AI assistance is registered as an entitlement but has no current product surface. The per-listing leads module is marked coming soon, although the main dashboard lead inbox and Premium lead email delivery are live. Video is server-supported but has no owner-facing editor in the current CMS.

## Verify Steps

Reviewed apps/web/src/lib/directory-entitlements.ts, apps/web/src/lib/pricing.ts, the owner CMS, lead capture/inbox routes and component, directory ordering/card presentation, analytics API, and server-rendered listing metadata/structured data.

## Rollback Plan

Documentation-only analysis; no application rollback is required.

## Notes

Customer-facing answer should distinguish shared SEO foundations from Premium content enrichment and should not claim guaranteed search rankings. An approved claim is required before owner access; successful payment is required before Premium entitlements activate.

