---
id: "202610310408-N5MN6H"
title: "Clarify management-company bulk property promotion"
status: "DOING"
priority: "med"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "start: clarify bilingual management-company bulk pricing and regular price comparison | details: replace general Founders promotion wording with multi-property enrollment offer" }
doc_version: 2
doc_updated_at: "2026-10-31T04:09:03+00:00"
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

Copy-only change; no new billing thresholds or existing subscription changes. Publication requires separate deployment spending approval.

## Verify Steps

Passed npm run type-check --workspace @citybeat/web and git diff --check. Reviewed both localized prices and eligibility copy. No new tests needed for static text changes.

## Rollback Plan

Revert the two page changes through the standard deployment workflow.

## Notes

Ready for publication. No network deployment, outreach, or charges performed.

