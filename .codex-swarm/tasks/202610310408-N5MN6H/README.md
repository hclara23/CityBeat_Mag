---
id: "202610310408-N5MN6H"
title: "Clarify management-company bulk property promotion"
status: "DONE"
priority: "med"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
commit: { hash: "5e70639a168e3c1332481e490391d550ef37ee1f", message: "🚧 N5MN6H start: clarify bilingual management-company bulk pricing and regular price comparison | details: replace general Founders promotion wording with multi-property enrollment offer" }
comments:
  - { author: "ORCHESTRATOR", body: "start: clarify bilingual management-company bulk pricing and regular price comparison | details: replace general Founders promotion wording with multi-property enrollment offer" }
  - { author: "ORCHESTRATOR", body: "verified: published bilingual management-company bulk promotion | details: all twelve live pages show regular and promotional prices with multi-property explanation; CI and health checks passed" }
doc_version: 2
doc_updated_at: "2026-10-31T04:21:00+00:00"
doc_updated_by: "agentctl"
description: "Show regular 19.99 and promotional 9.99 prices and explain management-company multi-property eligibility in English and Spanish without a general Founders offer."
---
## Summary

Clarify the management-company multi-property offer in both languages.

## Context

The user is narrowing the general Founders promotion and wants this offer explained as a bulk property-management discount.

## Scope

Promotion landing page metadata and price panel; every company portfolio header, including RPM and M7. Preserve existing subscription billing and active rate-lock terms.

## Risks

Copy-only change. Existing billing behavior and subscriptions preserved. Approved deployment completed.

## Verify Steps

Local type check and diff check passed. Deployment CI audit, tests, candidate smoke and live verification passed. All twelve public English/Spanish promotion and five-company pages return the localized bulk-offer label, regular 19.99 and promotional 9.99 prices, and multi-property enrollment explanation; former Founders label absent. Site health and payment health both HTTP200.

## Rollback Plan

Revert the two page changes through the standard deployment workflow.

## Notes

User approved up to 1 USD for this deployment. Published commit 5e70639 via successful GitHub run 41167405957. Cloud Build e862a674-bcae-49e8-84db-bf488b656655 succeeded; revision citybeat-web-00461-bav serves 100 percent of traffic. No outreach or live charges. Actual cloud billing not yet finalized.

