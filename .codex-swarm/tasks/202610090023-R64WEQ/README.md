---
id: "202610090023-R64WEQ"
title: "Publish Premier Clinic premium directory listing"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
commit: { hash: "ca06122cacb5933c04c7609c66e5ce7936fa6ae6", message: "✅ R64WEQ verify live Premier photos bilingual details and rollback snapshot" }
comments:
  - { author: "ORCHESTRATOR", body: "Start: Approved Premier listing preparation, duplicate checks, safe asset selection, and live verification without billing changes." }
  - { author: "ORCHESTRATOR", body: "verified: existing premium Premier listing updated live with five optimized WebP photos, three locations, bilingual content, six services and valid links | details: public API and browser checks passed." }
doc_version: 2
doc_updated_at: "2026-10-09T00:37:22+00:00"
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

PASS: node --check scripts/premier-listing-refresh.mjs; optimization verified five WebP images, 568728 to 238184 bytes (58 percent smaller). Public API deep-equality check matches every manifest field, preserves existing premium/claim/owner/sponsorship. Five image optimizer endpoints and five website/action links HTTP 200. Browser confirms all five images loaded, three locations, booking link, English and Spanish content. Screenshot .tmp/premier-listing/live-gallery.jpg.

## Rollback Plan

Pre-publication document retained at .tmp/premier-listing/before-publication.json and changed prior fields atomically recorded in directory_audit_log/premier-refresh-20261009-R64WEQ. Restore changed fields with a current update-time precondition, removing previously absent fields listed in audit. Old hero.png remains untouched; new images are versioned under 2026-10/.

## Notes

Published successfully 2026-10-09T00:34:22.138500Z to existing premier-clinic. Live URL https://citybeatmag.co/en/directory/premier-clinic. User approved Google Cloud photo usage. No AI generation, deployment, subscription or Stripe change. Five optimized photos include one cover and four gallery images; Nayeli and ambiguous group photos excluded by source labels. Six bilingual services and three linked updates added. Main domain corrected; outdated Quest affiliation removed. Central phone follows live booking and FAQ. Implementation commit a1531ef.

