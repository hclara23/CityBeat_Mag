---
id: "202610151908-65QK5Z"
title: "Audit Premium directory SEO and referral measurement"
status: "DONE"
priority: "high"
owner: "REVIEWER"
depends_on: []
tags: ["seo", "directory", "analytics"]
commit: { hash: "c8739fa2cc32c2a20fa0bfb494845fe0a16de208", message: "🔎 65QK5Z document Premium SEO and referral audit findings" }
comments:
  - { author: "REVIEWER", body: "Start: audit Premium directory SEO and pass-through measurement using source inspection and the live Super H listing as evidence." }
  - { author: "REVIEWER", body: "verified: source and live production evidence confirms real Premium ranking, content, and backlink benefits, while identifying incomplete referral provenance and conversion coverage with explicit implementation criteria." }
doc_version: 2
doc_updated_at: "2026-10-15T19:12:48+00:00"
doc_updated_by: "agentctl"
description: "Inspect Premium and Basic directory rendering, metadata, canonicals, robots/indexing, structured data, sitemap inclusion, internal linking, social previews, and outbound phone/website/directions/social/booking click attribution. Document verified gaps and acceptance criteria using Super H Automotive as the production reference; do not change code or production data."
---
## Summary

Audit completed against source and live production. Premium listings receive real discoverability advantages (directory and /best rank ahead of Basic, richer owner-managed content, and a do-follow outbound website link), while all published listings receive baseline technical SEO. Pass-through measurement is incomplete and referral provenance is actively suppressed by noreferrer. Super H is still Basic until payment and currently lacks the content/website assets needed to realize most Premium benefits.

Priority findings:
1. P0 — outbound referral provenance is suppressed: Premium website, social, maps, booking/action, and post links use rel="noopener noreferrer". noreferrer removes the Referer header, so destination analytics cannot identify CityBeat traffic; no UTM parameters are appended.
2. P0 — incomplete conversion coverage: phone is plain text; social, multi-location directions, and post CTA clicks are not tracked. Booking/order/quote share one click_action bucket, so the owner cannot tell which action converted.
3. P1 — purchase alone does not guarantee SEO enrichment. Super H production data is tier=basic (correct while checkout is unpaid) and has blank website, English/Spanish descriptions, cover image, gallery, social links, action links, services, and posts. If payment activates Premium without completing onboarding, its only immediate gains are priority ordering and the Premium layout; the do-follow link and enriched schema/content remain absent.
4. P1 — Premium differentiation is real but not fully articulated: search and /best rank sponsored, Featured, Premium, then Basic, and Premium website backlinks are do-follow while Basic links are nofollow+ugc. All tiers otherwise receive the same index/follow, canonical/hreflang, sitemap, OG/Twitter, LocalBusiness, and breadcrumb baseline.
5. P1 — structured LocalBusiness output needs hardening: streetAddress contains the full formatted address while postalCode is absent; openingHours carries human strings such as "Mo 9:00 AM - 6:00 PM" instead of a normalized schema time shape; the generic LocalBusiness type is used for every category. These may reduce rich-result confidence even though markup is present.
6. P2 — directory detail hreflang omits x-default, unlike /best pages. Spanish Super H title remains partly English ("Auto Repair in El Paso") because category labels are not localized in metadata. A transient Firestore read failure returns only a not-found title rather than explicit noindex, and ISR could cache a thin shell.

## Context

Production evidence on 2026-10-15:
- Super H EN and ES pages return HTTP 200 with index,follow; locale-specific canonical; en/es hreflang; OG/Twitter metadata; SSR content; LocalBusiness and BreadcrumbList JSON-LD.
- sitemap.xml contains TJmwyo55waiFiGYp2fmu and robots.txt allows public directory pages.
- Super H appears on /en/best/auto-repair/el-paso at position 161 while it is Basic; the ranking function will move an activated Premium listing ahead of Basic listings.
- The public API reports Super H tier=basic, claim_status=approved, is_published=true, with blank website/description/image/gallery/social/actions/services/posts. This is a pre-payment baseline, not a fulfillment failure.
- A representative Premium page renders its business website link without nofollow; a representative Basic page renders rel="noopener noreferrer nofollow ugc".
- Source evidence: metadata/schema at page.tsx:120-289; Premium website tracking at DirectoryDetailClient.tsx:1520-1534; Basic nofollow at 1607-1624; social links at 1066-1089; plain-text phones at 1510-1514 and 1598-1602; generic action tracking at 1095/1630; untracked post CTA at ListingContentSections.tsx:149-153; paid ordering at local-seo.ts:84-104 and api/directory/route.ts:20-27.

## Scope

Read-only inspection covered:
- apps/web/src/app/[locale]/directory/[id]/page.tsx metadata, canonical/hreflang, robots, Open Graph/Twitter, LocalBusiness/review/FAQ/breadcrumb JSON-LD, and server rendering.
- apps/web/src/app/sitemap.ts and apps/web/src/app/robots.ts.
- apps/web/src/app/api/directory/route.ts, apps/web/src/lib/local-seo.ts, and apps/web/src/app/[locale]/best/[category]/[city]/page.tsx for discovery and paid-tier ordering.
- DirectoryDetailClient.tsx and ListingContentSections.tsx for website, phone, maps, social, booking/action, multi-location, and post CTA exits.
- listing-analytics.ts, /api/track/listing, and /api/directory/[id]/analytics for collection and owner reporting.
- Live EN/ES Super H pages, sitemap.xml, robots.txt, /best/auto-repair/el-paso, and representative Premium and Basic listings. No code or production data was changed.

## Risks

- Search engines do not guarantee ranking or rich results; acceptance must verify technical eligibility and measurable referral behavior, not promise placement.
- Removing noreferrer exposes the CityBeat origin as the referrer. Prefer explicit, privacy-safe UTM tagging so attribution survives browser/referrer-policy differences without adding visitor identity.
- Adding event dimensions must keep bounded cardinality and preserve the existing privacy model (no IP, user ID, or user agent stored).
- Premium priority is commercially meaningful but Sponsored and Featured must remain clearly labeled; do not imply organic editorial endorsement.
- Super H cannot demonstrate post-payment Premium activation until Stripe payment occurs; no charge should be initiated as part of verification.

## Verify Steps

Implementation acceptance criteria:
1. Every external conversion path is clickable and measured: phone, website, Google/Apple directions including each location, each social network, each booking/order/quote/menu action, and each post CTA.
2. Analytics preserves channel/action detail (not only click_action) in bounded daily counters and exposes 30-day totals plus Premium series/export without leaking visitor identity.
3. Premium outbound URLs preserve existing query/hash and add stable attribution (utm_source=citybeatmag.co, utm_medium=referral, listing/action campaign values), or use an equivalent audited redirect. Destination requests must not suppress referral provenance accidentally.
4. Automated tests cover URL augmentation, event allow-listing, channel aggregation/export, self-traffic exclusion, Basic-versus-Premium link rel behavior, and each rendered CTA handler.
5. A paid Premium fixture ranks ahead of Basic in directory search and /best category/city pages; sponsored/Featured labels remain explicit.
6. Directory detail metadata includes canonical plus en/es/x-default; Spanish metadata uses localized category wording; absent/unavailable listings are explicit noindex and are not cached as indexable thin pages.
7. LocalBusiness schema parses the formatted address into streetAddress/addressLocality/addressRegion/postalCode/addressCountry, normalizes opening hours to machine-readable intervals, and uses a supported category subtype where mapped. Structured data tests must parse emitted JSON-LD.
8. Premium activation surfaces an onboarding checklist and does not claim the full SEO/referral benefit until website, bilingual description, image, and primary CTA are populated.
9. Production verification checks Super H only after a real payment activates it: tier Premium, top-of-Basic ranking, enriched SSR metadata/schema after onboarding, sitemap presence, clickable phone/website/directions/actions, and owner-visible counters. Do not initiate the payment during testing.
10. Regression checks retain HTTP 200, index/follow, canonical/hreflang, OG/Twitter, LocalBusiness/Breadcrumb JSON-LD, sitemap inclusion, and Basic nofollow+ugc behavior.

## Rollback Plan

Audit-only task: no runtime behavior or production data changed. Revert only this task documentation commit if the conclusions must be withdrawn. Implementation should be delivered in downstream task 202610151908-1V8V7X with its own rollback plan.

## Notes

Recommended implementation order: (1) attribution-safe outbound URL helper and complete CTA event taxonomy; (2) owner analytics API/UI/CSV dimensions; (3) schema/address/hours and hreflang/noindex hardening; (4) Premium onboarding readiness gate/checklist; (5) production validation after payment and owner content completion. The current code already provides a sound SEO baseline and genuine paid ordering; this work should strengthen measurement rather than replace the existing architecture.

