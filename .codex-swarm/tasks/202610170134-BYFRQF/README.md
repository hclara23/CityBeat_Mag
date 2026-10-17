---
id: "202610170134-BYFRQF"
title: "Update Varsity Roofing listing media"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["directory", "media", "production"]
verify: ["npm test"]
comments:
  - { author: "ORCHESTRATOR", body: "Start: verify Varsity Roofing identity, source official brand media, update only listing media, and confirm the public listing renders correctly." }
  - { author: "ORCHESTRATOR", body: "Verified: official website identity matched by name, phone, and website; 666 tests pass, production build succeeds, and serial TypeScript validation reports no errors." }
  - { author: "ORCHESTRATOR", body: "Prepared an audited one-off publication script; dry-run confirmed the official cover, logo, and five gallery assets are reachable images before any database mutation." }
doc_version: 2
doc_updated_at: "2026-10-17T01:34:19+00:00"
doc_updated_by: "agentctl"
description: "Use official imagery and branding from varsityroofing.com to refresh the matching CityBeat business listing logo, cover image, and gallery after identity verification, while preserving existing business details."
---
## Summary

Refresh the production Varsity Roofing directory listing with official brand imagery sourced from the business website.

## Context

The user approved using images and the logo published on varsityroofing.com for the CityBeat listing.

## Scope

Verify the matching business record, select and retrieve official logo and representative roofing images, upload them through the supported listing media workflow, set an appropriate cover, and verify the public listing without changing unrelated business information.

## Risks

Potential risks are mismatching the business record, selecting decorative or low-resolution assets, duplicate gallery items, or overwriting unrelated listing fields. Mitigate by matching contact details and limiting writes to media fields.

## Verify Steps

Confirm website and listing identity; verify each selected source image is official and usable; confirm logo, cover, and gallery render on the public English and Spanish listing pages.

## Rollback Plan

Restore the previous cover/logo/gallery references or remove only the newly uploaded assets if verification fails.

## Notes

No paid service or application deployment is expected.

