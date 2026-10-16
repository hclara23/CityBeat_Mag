---
id: "202610162138-MW634J"
title: "Set Super H Automotive cover image"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["directory", "production"]
commit: { hash: "397e0dca8ab134a19c956148d37c97a5266ffc49", message: "✅ MW634J record verified Super H cover image update" }
comments:
  - { author: "ORCHESTRATOR", body: "Start: upload the approved storefront image as Super H Automotive's cover and verify the public listing." }
  - { author: "ORCHESTRATOR", body: "verified: the public Super H Automotive listing now uses the approved storefront photograph as its cover | details: the media object returns HTTP 200 and the live page renders the image. No other listing fields were changed." }
doc_version: 2
doc_updated_at: "2026-10-16T21:42:52+00:00"
doc_updated_by: "agentctl"
description: "Inspect and upload the user-approved storefront photo as the Super H Automotive listing cover, then verify the live public listing without altering ownership, subscription, or payment data."
---
## Summary

Set the approved Super H Automotive storefront photograph as the live CityBeat directory cover image.

## Context

The listing had no primary image. The user supplied Screenshot 2026-10-16 153457.png and approved publishing it as the cover.

## Scope

Upload the supplied image to the existing CityBeat media bucket, update only image_url and updated_at on directory listing TJmwyo55waiFiGYp2fmu, and verify the public page. Ownership, claim status, subscription, tier, payment, contact, hours, and gallery data remain unchanged.

## Risks

A wide cover crop may hide edge details on smaller screens. The source file is retained locally and the prior image_url was empty, so rollback is straightforward.

## Verify Steps

1. Confirm the public object URL returns HTTP 200 with image/png. 2. Reload https://citybeatmag.co/en/directory/TJmwyo55waiFiGYp2fmu. 3. Visually confirm the storefront photograph renders as the hero cover above Super H Automotive.

## Rollback Plan

Set directory_listings/TJmwyo55waiFiGYp2fmu image_url back to an empty string and optionally remove directory/TJmwyo55waiFiGYp2fmu/cover-20261016.png from the media bucket.

## Notes

Verified live on 2026-10-16: the public image returned HTTP 200 and the CityBeat listing displayed the Super H storefront as the cover. Edge file upload was unavailable because the ChatGPT extension lacked file-URL permission, so the approved image was uploaded through the authorized Google Cloud account and the listing field was updated directly.

