---
id: "202610162154-CT0T2Y"
title: "Create Cardon Insurance half-page ad"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["design", "advertising"]
comments:
  - { author: "ORCHESTRATOR", body: "Start: verify Cardon Insurance public details, create a 7.75 x 4.75 inch horizontal ad at 300 DPI, and visually validate the final deliverable." }
doc_version: 2
doc_updated_at: "2026-10-16T21:55:54+00:00"
doc_updated_by: "agentctl"
description: "Research verified public business details and create a high-resolution horizontal half-page print advertisement for Cardon Insurance featuring Auto, Home, Flood, and Bonds, using the supplied logo."
---
## Summary

Created a high-resolution horizontal half-page advertisement for Cardon Insurance Agency featuring Auto, Home, Flood, and Bonds.

## Context

The user supplied the Cardon Insurance logo and requested a horizontal half-page ad. Public business details were verified against cardoninsuranceelpaso.com before composition.

## Scope

Deliver one 7.75 x 4.75 inch, 300-DPI PNG using the supplied logo, the four requested insurance types, verified phone, website, address, and since-1964 positioning.

## Risks

The supplied logo source is 258 x 80 pixels, so it was carefully upscaled and sharpened; the final placed size was visually checked at full resolution. The ad is sRGB PNG rather than a printer-specific CMYK profile.

## Verify Steps

1. Confirm output dimensions are 2325 x 1425 pixels. 2. Confirm embedded density is 300 DPI. 3. Visually inspect logo, headline, Auto/Home/Flood/Bonds labels, phone, website, address, safe margins, contrast, and spelling. 4. Confirm verified business facts against the public website.

## Rollback Plan

Remove output/ads/cardon-insurance-half-page-2026.png if the creative is rejected; no production website or external account was modified.

## Notes

Built-in image generation produced the text-free commercial background using an ads-marketing prompt for an El Paso home, vehicle, subtle flood-protection water, and contractor bonding cue with navy negative space. The supplied logo and all copy were composited deterministically. Final: 2325 x 1425 pixels, 300 DPI, sRGB PNG, 3,890,741 bytes, SHA-256 09E3FF868147C4836FC4FEFB3B23B5CB722C25EAE54D1A25DA062B21275DD433.

