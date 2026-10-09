---
id: "202610090010-KWNM65"
title: "CityBeat legal documents"
status: "DOING"
priority: "high"
owner: "CODER"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "Start: audit the live CityBeat legal disclosures against current data, AI, analytics, directory, contribution, and billing behavior; add any missing public notice and validate locally." }
doc_version: 2
doc_updated_at: "2026-10-09T00:20:02+00:00"
doc_updated_by: "agentctl"
description: "Audit and update legal documents for the publicly reachable CityBeat application in C:\\dev\\CityBeat_Mag."
---
## Summary

Reconciled CityBeat's public privacy and terms disclosures with the live application's data, AI, publishing, subscription, contribution, and referral behavior; added a bilingual Cookie Notice.

## Scope

Updated the English and Spanish privacy effective dates; added bilingual cookie disclosures for session, referral, analytics, and local storage; linked the notice from the footer and sitemap; expanded terms for user contributions, AI-assisted features, changes, and termination.

## Risks

Legal text reflects the inspected implementation but is not a substitute for review by qualified counsel. Future data processors, retention changes, or tracking changes require a matching policy update.

## Verify Steps

npm run type-check --workspace=@citybeat/web; npm test -- --runInBand; npm run build --workspace=@citybeat/web

## Rollback Plan

Revert the implementation commit to remove the Cookie Notice and restore the prior privacy dates, terms copy, footer links, and sitemap entries.

