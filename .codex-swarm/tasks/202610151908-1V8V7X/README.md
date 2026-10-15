---
id: "202610151908-1V8V7X"
title: "Implement Premium SEO and pass-through traffic improvements"
status: "DONE"
priority: "high"
owner: "CODER"
depends_on: ["202610151908-65QK5Z"]
tags: ["seo", "directory", "analytics", "frontend", "backend"]
verify: ["npm --prefix apps/web run type-check", "npm test"]
commit: { hash: "c32f1f0d6cfc002bccee821e5897b80494c965b7", message: "✨ 1V8V7X add measurable Premium referrals and structured SEO" }
comments:
  - { author: "CODER", body: "Start: implementing approved Premium SEO, referral attribution, conversion tracking, and structured-data hardening." }
  - { author: "CODER", body: "verified: Premium SEO and pass-through implementation passed web type-check plus the full 606 web and 20 shared-library tests, with focused attribution, analytics, metadata, address, hours, and schema coverage." }
doc_version: 2
doc_updated_at: "2026-10-15T19:20:23+00:00"
doc_updated_by: "agentctl"
description: "Implement the approved findings from the Premium SEO audit so Premium listings receive valid crawl/indexing, metadata, structured-data, internal-linking, social-preview, and measurable outbound referral benefits while preserving Basic behavior and privacy. Include focused automated coverage."
---
## Summary

Implemented privacy-safe CityBeat referral attribution, complete Premium outbound conversion coverage, granular owner analytics fields/CSV columns, and stronger bilingual listing metadata and LocalBusiness structured data.

## Scope

Added a URL attribution helper that preserves destination query strings and fragments; retained do-follow Premium website links while removing noreferrer from measured external exits; made phone, social, Google/Apple/location directions, booking/order/quote, and post CTA interactions distinct allow-listed events while preserving legacy aggregate counters; exposed granular totals and CSV fields; added x-default hreflang, localized Spanish category metadata, explicit noindex for unavailable listings, parsed postal addresses, normalized opening hours, and supported category-specific schema types.

## Risks

External destinations may override or strip UTM parameters, and search engines do not guarantee rankings or rich results. Existing aggregate direction/action counters remain backward-compatible; bounded detail fields add no visitor identity. Invalid or non-HTTP destination values are left unchanged by the attribution helper and remain subject to existing content sanitization.

## Verify Steps

Passed npm --prefix apps/web run type-check. Passed npm test: 606 web tests and 20 shared-library tests. Passed 12 focused listing analytics, outbound attribution, and structured-data tests. The task's declared script name 'typecheck' is not present (the repository script is 'type-check'), so agentctl verify recorded that configuration mismatch; equivalent intended checks passed directly.

## Rollback Plan

Revert the implementation commit to restore prior outbound rel attributes, event taxonomy, metadata, and schema behavior. Existing legacy aggregate counters remain readable either way; newly added Firestore counter fields are additive and safe to leave in historical documents.

