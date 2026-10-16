---
id: "202610162356-3PD2Z6"
title: "Integrate Google Business Profile and refresh CityBeat profile"
status: "TODO"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
doc_version: 2
doc_updated_at: "2026-10-16T23:56:40+00:00"
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

Approved plan: 1) audit existing auth/listing/analytics and verified brand data; 2) implement secure GBP connection and sync-preview foundation; 3) add GBP performance to Finance; 4) stage and, after action-time confirmation, publish the live CityBeat profile refresh; 5) test, deploy within the previously approved release cap only where applicable, and verify. No paid ads or new recurring purchase.

