---
id: "202610162356-3PD2Z6"
title: "Integrate Google Business Profile and refresh CityBeat profile"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "Start: audit existing authentication, directory owner controls, analytics providers, and verified CityBeat brand details before implementing secure GBP connection and synchronization." }
  - { author: "ORCHESTRATOR", body: "Release update: Google Business Profile phone change from (915) 500-9640 to (915) 336-7080 was submitted and is pending Google's review. Commit 0095cc0 deployed successfully in GitHub Actions run 38985047974; candidate smoke tests, production promotion, and live verification passed. OAuth credentials/API approval, Cloudflare reporting credential, website/social/description/logo profile edits remain open." }
  - { author: "ORCHESTRATOR", body: "Google profile update: public Search/Maps profile now shows phone (915) 336-7080, website https://citybeatmag.co/, Facebook CityBEATMagazine, and Instagram citybeat_mag. Updated bilingual/local-publication description and SMS number +1 915-336-7080 are submitted and pending Google review. Google Services editor currently stalls on a blank provider iframe; no duplicate submission made. Exact replacement logo asset and Google/Cloudflare API credentials remain outstanding." }
doc_version: 2
doc_updated_at: "2026-10-17T00:00:01+00:00"
doc_updated_by: "agentctl"
description: "Add a secure Google Business Profile connection and performance integration for directory owners, surface connected GBP analytics in Finance, provide controlled profile synchronization to reduce duplicate data entry, and refresh the managed CityBeat Magazine Google Business Profile with verified brand details. No paid advertising or recurring service purchase is authorized."
---
## Summary

Implement a secure Google Business Profile integration for CityBeat directory owners, expose connected GBP performance in Finance & Analytics, and prepare a verified refresh of the managed CityBeat Magazine Google profile.

## Context

The legacy CityBeat Magazine Google Business Profile is accessible through the Morningstar ELP Google account. CityBeat already has first-party, Google Analytics, and Cloudflare analytics work in progress. GBP API access requires Google project approval and OAuth authorization by each profile owner.

## Scope

Add OAuth connection/status flows, owner-controlled listing import and synchronization previews, connected GBP performance metrics in the Finance dashboard, secure token handling and revocation, provider setup documentation, tests, deployment configuration, and a verified update of the CityBeat Magazine public profile. Writes to directory or Google data require explicit owner action and conflict review. Excludes paid Google Ads and unauthorized bulk scraping.

## Risks

Google must approve the Cloud project for GBP API access; OAuth credentials and refresh tokens are sensitive; public profile edits are externally visible; profile and directory data can conflict; Google API quotas and field availability may limit synchronization. Use least privilege, encrypted secrets, explicit previews, audit records, and reversible/disconnect paths.

## Verify Steps

Run targeted unit tests for OAuth state, mapping, sync previews, permissions, and analytics normalization; run TypeScript checks and the production build; verify signed-in owner/admin/developer routes; validate no secrets are committed; test candidate deployment before traffic promotion; verify public GBP changes after explicit action-time confirmation.

## Rollback Plan

Disable GBP feature flags and OAuth routes, revoke the OAuth client/token, restore prior Cloud Run revision, and revert public profile fields in Google Business Profile using the recorded before-state. Imported directory changes retain audit records and can be restored from their pre-sync snapshots.

## Notes

Implemented owner-authorized GBP OAuth, encrypted refresh-token storage, signed short-lived state, listing access checks, discover/select/preview/apply/disconnect flows, audit snapshots, and Google Search/Maps performance metrics in Finance. Verified current public profile before-state: City Beat Magazine; Publisher; website applepolishing.media; phone (915) 500-9640; service area El Paso; 4.8 stars from 4 reviews; Google reports 194 search-result views last month. Public search identifies likely social profiles Facebook /CityBEATMagazine and Instagram /citybeat_mag, but these and the apparent Instagram booking phone (915) 261-1098 must not be treated as operator-confirmed replacement data. Google API approval/OAuth credentials and exact new phone/logo remain required before activation/public profile edits.

