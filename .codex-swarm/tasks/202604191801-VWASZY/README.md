---
id: "202604191801-VWASZY"
title: "Trace Graphify fetch bridge and audit app"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "Start: trace the Graphify fetch bridge, run lint typecheck build and targeted static review, then report concrete bugs with file references." }
doc_version: 2
doc_updated_at: "2026-04-19T18:08:53+00:00"
doc_updated_by: "agentctl"
description: "Trace the generated Graphify fetch bridge, then audit the CityBeat app for bugs, errors, broken routes, broken API flows, and failed checks without modifying unrelated user changes."
---
## Summary

Traced the Graphify fetch bridge and audited the app with type-check, lint, production build, graph traversal, route/link inspection, auth review, billing/ads flow review, and schema review. The trace showed fetch is mostly a generic inferred hub rather than a single true abstraction. Concrete findings were recorded for lint failure, protected-route auth, missing billing API, ads locale routes, checkout/success mismatch, SQL/schema drift, and stubbed features.

## Scope

Traced Graphify fetch paths, verified the noisy fetch hub against source, ran type-check/lint/build, inspected auth redirects, protected-route middleware, billing API calls, ads route links, checkout/success behavior, dashboard/billing/analytics stubs, Supabase schema drift, and SQL migration consistency.

## Risks

Static audit cannot prove live Supabase, Sanity, Stripe, or worker runtime behavior without configured production secrets and browser/API smoke tests. Graphify AST extraction creates false hubs for generic names like fetch, POST, and GET, so graph edges were verified against source before treating them as findings.

## Verify Steps

Ran npm run type-check, npm run lint, npm run build, Graphify query/path/explain commands against graphify-out/graph.json, and targeted source inspection with rg/Test-Path/Get-Content. Type-check and build passed. Lint failed before source linting because eslint.config.mjs imports eslint/config while the installed ESLint package is 8.57.1.

## Rollback Plan

This audit changed only task tracking artifacts. Revert the audit task commit if the task record should be removed; no app runtime files need rollback.

