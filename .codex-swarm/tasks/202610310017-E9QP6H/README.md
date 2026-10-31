---
id: "202610310017-E9QP6H"
title: "Build bilingual property management portfolio promotion and consolidated billing"
status: "DOING"
priority: "high"
owner: "CODER"
depends_on: ["202610310005-88YHV7"]
tags: []
comments:
  - { author: "CODER", body: "Start: research verified company apartment portfolios and implement bilingual corporate claims, bulk edits, staff assignments and consolidated recurring billing" }
  - { author: "CODER", body: "Verified: 123 targeted tests, production build, final type checking, focused lint, browser flows and live Stripe webhook event configuration passed. Repository-wide task lint reports only pre-existing records with missing commit metadata or unmet dependencies; no reported error names this task. No unrelated task records were modified." }
doc_version: 2
doc_updated_at: "2026-10-31T01:19:15+00:00"
doc_updated_by: "agentctl"
description: "Approved company directory and verified apartment portfolios for RPM, M7/Monterrey, Haggerty/Century 21 and other discoverable El Paso firms. Corporate bulk claims reviewed by staff; optional individual listing managers; bulk editing; one recurring Stripe card subscription at USD 9.99 per property per month locked while active. Research management relationships and never infer total inventory from vacancies. Prepare and test locally; no additional deployment expense approved for this new feature."
---
## Summary

Create bilingual management-company promotion, corporate portfolio ownership, bulk editing, per-listing staff assignment, and one recurring Stripe card bill at USD 9.99 per property/month locked while active.

## Context

The user approved the promotion, corporate portfolio, bulk editing, optional listing managers, and one recurring bill. RPM has ten properties, not eleven. Initial research curates apartment complexes and rental communities; the later clarification requires an immediate New property form supporting all rental types, including individual homes, duplexes, condos and commercial buildings. Company comparison precedes company profiles without implying unclaimed firms are subscribers. The prior deployment task 88YHV7 was completed before this feature.

## Scope

Build the bilingual residential and commercial management promotion funnel, public company profiles, reviewed corporate portfolio claims, bulk edits, optional listing managers, and consolidated recurring Stripe card billing at $9.99 per enrolled property/month locked while active. Ship New property now with apartment complex, rental community, single-family home, duplex, condo, townhome, commercial building, and other rental choices; verified corporate owners may submit these for review and paid enrollment, including additions to an active consolidated bill with an explicit proration quote. Curate existing apartment communities from primary company directories; do not bulk-import individual vacancy listings or invent Haggerty totals. Include honest company comparison, shareable promotion/company links, and English/Spanish flows. No outreach messages, live test charges, extra SMS, or new cloud deployment spend are authorized for this feature.

## Risks

Company-wide access requires staff authorization review; company email or payment alone cannot establish management rights. Existing owners/subscriptions must not be overwritten or double billed. Manager access cannot cross properties or control billing. Rental vacancy counts are not total portfolio size. New portfolio promo must not consume or bypass the separate Founders-100 offer. Webhooks must fail closed, be idempotent, handle cancellation/past due and never grant ownership through payment.

## Verify Steps

Passed: npm run type-check --workspace @citybeat/web. Passed: node --import tsx --test apps/web/src/lib/property-portfolio-flow.test.ts apps/web/src/lib/apartments.test.ts apps/web/src/lib/apartment-claim-flow.test.ts apps/web/src/lib/directory-entitlements.test.ts apps/web/src/lib/premier-promotion.test.ts apps/web/src/lib/stripe-invoice.test.ts apps/web/src/lib/checkout-recovery.test.ts apps/web/src/lib/billing-terms.test.ts apps/web/src/lib/founding-checkout.test.ts apps/web/src/lib/sales-checkout.test.ts (123 tests). After the final manager-seat and refund checks, the 35 corporate/entitlement tests passed again. Production Next build passed with isolated Firebase fixtures and private vendor keys blanked using the task preview-preload.cjs and CITYBEAT_PORTFOLIO_BUILD=1; the ZIP-filter hook warning was fixed and its ESLint check and final type check passed. Browser-tested English promotion to company navigation, commercial-property submission, two-listing bulk editing, manager assignment, Spanish controls and all eight property types; Spanish mobile width390 had no horizontal overflow. Saved promotion, company directory and Spanish mobile screenshots. Live Stripe read-only inspection confirmed the CityBeat webhook is enabled for checkout, invoice, subscription, pending-update-expiry, refund and dispute events. No live payments, SMS, company claims or deployment were performed. Before production use, approve deployment cost, publish the commit, and smoke-test both public locales and authenticated role boundaries without placing a live charge.

## Rollback Plan

Before release, revert the feature commit if needed. After release, return Cloud Run to the prior verified revision to stop new portfolio enrollment; retain corporate records and existing Stripe subscriptions. Once customers have paid, do not delete accounts or stop subscription reconciliation without a billing migration, because rollback must not leave customers paying for unavailable access. New portfolio billing has a dedicated promo identifier and dedicated customer per corporate account; legacy individual checkout and generic portal routes refuse corporate-managed listings. No deployment, push, paid API test, or outreach is included in the completed local implementation.

## Notes

Catalog: 97 published locations: RPM 10, M7 19 El Paso locations (the official locator also includes one Alamogordo location, excluded), Integrity 59 visible multifamily entries, Case 9 El Paso communities. Sources: https://rpmliving.com/find-a-community-post-search/ ; https://www.m7elp.com/search.html ; https://www.integrityamc.com/multi-family-communities ; https://www.caseusa.com/apartments/tx/el-paso/ . M7 combined locations retain the published Wedgewood/Eastridge and Monterrey East/Vista Sierra grouping. Integrity HTML comments were excluded; Ashton Parke address is corrected from https://www.ashtonparkeapts.com/ to 5815 Timberwolf Dr. Haggerty Company and Century 21 Haggerty relationship is supported by https://www.haggertyrentals.com/about-us and https://www.lascrucespropertyrentals.com/ and their shared century21haggerty AppFolio portal. No complete named apartment roster or total was verified; display awaiting confirmation, not a fabricated zero inventory. New firms can apply for reviewed company profiles. Public projections exclude owner, manager and billing identifiers. Local visual fixtures run via preview-server.ts and preview-preload.cjs in this task directory; no live charges, SMS, ownership changes or outreach were performed. Deployment and production smoke checks remain subject to a fresh cost approval; the previous release approval does not cover this feature.

