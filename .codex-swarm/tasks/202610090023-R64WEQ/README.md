---
id: "202610090023-R64WEQ"
title: "Publish Premier Clinic premium directory listing"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "Start: Approved Premier listing preparation, duplicate checks, safe asset selection, and live verification without billing changes." }
doc_version: 2
doc_updated_at: "2026-10-09T00:33:45+00:00"
doc_updated_by: "agentctl"
description: "Verify existing listing, update three locations and hours, use provided Premier assets excluding Nayeli, set main domain and hosted-app action links, publish premium presentation without charges."
---
## Summary

Publish an attractive bilingual premium Premier Clinic listing, updating an existing record if present.

## Context

Existing live record premier-clinic is already premium and sponsored; preserve those settings and ownership/billing. Gallery empty and main domain points to hosted app. Live FAQ confirms East Ste 103, three locations and hours, and no Quest affiliation. Photo upload awaits explicit Google Cloud usage approval.

## Scope

Verify three clinic locations and schedules; select confirmed supplied photography excluding Nayeli; use premierclinic.us as website and supplied hosted app for action links; publish and check live directory. No subscription, paid service, Premier deployment, or billing changes.

## Risks

Public source address disagreement must be resolved or disclosed. Central is EPISD employee-only. Exclude uncertain staff imagery, unverifiable medical claims, and private records. Preserve existing ownership and billing.

## Verify Steps

Search published and unpublished listings; check image URLs and source provenance; verify premium tier, three locations, bilingual copy, hours and action links using public API and browser.

## Rollback Plan

Preserve existing document before mutation and restore only changed fields using a concurrency precondition; if new, unpublish the new listing rather than delete unrelated data.

## Notes

Prepared bilingual content manifest and guarded one-off refresh script. User specifically approved Google Cloud photo-hosting usage and requested optimized WebP. Five photos reduced from 568728 to 238184 bytes (58 percent); original files unchanged. Main website and four hosted action links return HTTP 200. Existing premium, sponsorship, ownership and billing fields preserved.

