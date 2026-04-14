---
id: "202604142058-FZ6Z5D"
title: "Integrate CityBeat UI under main domain"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
commit: { hash: "a7310aee14ed8d0fecb79170f66d96d7230beacc", message: "✨ 202604142058-FZ6Z5D integrate CityBeat UI on main domain: replace homepage theme; add /ads and /studio routes; update domain links and build fixes" }
comments:
  - { author: "CODER", body: "Start: port the citybeat reference UI into the main Next app, integrate ads and studio routes under the primary domain, update domain links, and verify builds locally." }
  - { author: "ORCHESTRATOR", body: "verified: web build and type-check passed | details: ads build and type-check passed; ui type-check passed; root build passed; browser checked /en, /en/ads, /en/ads/newsletter, and /studio on http://localhost:3002 with no current console errors." }
doc_version: 2
doc_updated_at: "2026-04-14T22:43:19+00:00"
doc_updated_by: "agentctl"
description: "Replace the current public UI with the citybeat reference theme, move ads and studio entry points under citybeatmag.co paths, update links/configuration away from ads/studio subdomains, and verify local builds."
---
## Summary

Integrated the CityBeat reference look into the main web app and moved ads and Studio entry points onto main-domain routes.

## Context

The user requested a single current-domain experience instead of ads and studio subdomains, with public pages using the UI from the local citybeat reference folder.

## Scope

Updated the web app theme, homepage, integrated ads pages, Studio route, shared UI components, domain environment templates, worker email links, and legacy ads build fixes needed for the existing package to compile.

## Risks

Studio shows a branded setup state until real Sanity environment values are provided. Ads checkout still depends on configured Stripe and Supabase credentials for live purchase flows.

## Verify Steps

Passed npm run build --workspace=@citybeat/web, npm run type-check --workspace=@citybeat/web, npm run build --workspace=@citybeat/ads, npm run type-check --workspace=@citybeat/ads, npm run type-check --workspace=@citybeat/ui, and npm run build. Browser-verified http://localhost:3002/en, /en/ads, /en/ads/newsletter, and /studio with no current console errors.

## Rollback Plan

Revert this task commit to restore the previous UI, subdomain references, and ads app behavior. Remove the new integrated web ads and Studio routes if rolling back manually.

## Notes

Local dev server is running on http://localhost:3002 for review. Existing untracked reference and runtime temp folders were left untouched.

