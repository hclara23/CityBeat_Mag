---
id: "202610090023-R64WEQ"
title: "Publish Premier Clinic premium directory listing"
status: "TODO"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
doc_version: 2
doc_updated_at: "2026-10-09T00:27:33+00:00"
doc_updated_by: "agentctl"
description: "Verify existing listing, update three locations and hours, use provided Premier assets excluding Nayeli, set main domain and hosted-app action links, publish premium presentation without charges."
---
## Summary

Publish an attractive bilingual premium Premier Clinic listing, updating an existing record if present.

## Scope

Verify three clinic locations and schedules; select confirmed supplied photography excluding Nayeli; use premierclinic.us as website and supplied hosted app for action links; publish and check live directory. No subscription, paid service, Premier deployment, or billing changes.

## Risks

Public source address disagreement must be resolved or disclosed. Central is EPISD employee-only. Exclude uncertain staff imagery, unverifiable medical claims, and private records. Preserve existing ownership and billing.

## Verify Steps

Search published and unpublished listings; check image URLs and source provenance; verify premium tier, three locations, bilingual copy, hours and action links using public API and browser.

## Rollback Plan

Preserve existing document before mutation and restore only changed fields using a concurrency precondition; if new, unpublish the new listing rather than delete unrelated data.

