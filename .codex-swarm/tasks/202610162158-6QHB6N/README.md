---
id: "202610162158-6QHB6N"
title: "Create Cardon Insurance portrait ad with QR"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["design", "advertising"]
comments:
  - { author: "ORCHESTRATOR", body: "Start: create a 1200 x 2850 portrait ad, preserve the horizontal version, generate a QR code for the official website, and verify the QR from the final artwork." }
doc_version: 2
doc_updated_at: "2026-10-16T22:00:57+00:00"
doc_updated_by: "agentctl"
description: "Create a separate 4 x 9.5 inch portrait Cardon Insurance print ad at 300 DPI, preserving verified business details and required coverage types, and add a tested QR code to the official website."
---
## Summary

Created a separate 4 x 9.5 inch portrait Cardon Insurance print ad with a scannable QR code to the official website.

## Context

The user approved adapting the previously completed horizontal ad into a narrow portrait format while preserving the horizontal file and adding a QR code for https://www.cardoninsuranceelpaso.com/.

## Scope

Deliver a 1200 x 2850 pixel, 300-DPI portrait PNG using the supplied logo, Auto/Home/Flood/Bonds labels, verified business details, and a high-error-correction QR code with a protected white quiet zone. Include a standalone QR asset for reuse.

## Risks

The supplied logo source is 258 x 80 pixels and was carefully upscaled and sharpened. The final ad is sRGB PNG rather than a printer-specific CMYK profile.

## Verify Steps

1. Confirm final dimensions are 1200 x 2850 pixels and density is 300 DPI. 2. Visually inspect logo, headline, four insurance types, phone, website, address, contrast, and safe margins. 3. Crop the QR region from the final composed ad and submit it to a QR decoder. 4. Confirm decoded data equals https://www.cardoninsuranceelpaso.com/ with no error.

## Rollback Plan

Remove the portrait PNG and standalone QR asset; the original horizontal ad remains unchanged and no production website or external account was modified.

## Notes

Built-in image generation produced the text-free portrait background with an ads-marketing prompt for an El Paso home, vehicle, flood-protection water, and contractor bonding cue with navy copy zones. Logo, typography, and QR were composited deterministically. QR error correction is level H with a four-module quiet zone. The finished-ad QR decoded exactly to https://www.cardoninsuranceelpaso.com/. Final SHA-256: 097D65612D7C1916E3596AAC254414914F73E299553629A01AF45442DE711C5C.

