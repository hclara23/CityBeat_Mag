---
id: "202607212201-F115P0"
title: "Deploy unified sales fulfillment"
status: "TODO"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: ["202607212040-ABDG38"]
tags: ["deployment", "cloud-run", "sales"]
comments:
  - { author: "ORCHESTRATOR", body: "Approved by the user: deploy the completed unified Sales Desk and post-payment fulfillment release to production and verify it end to end." }
doc_version: 2
doc_updated_at: "2026-07-21T22:02:02+00:00"
doc_updated_by: "agentctl"
description: "Deploy completed parent task 202607212040-ABDG38 from clean main to production Cloud Run service citybeat-web in kerstenblueprint/us-central1, verify revision readiness and critical public sales/fulfillment/guide routes, and record rollback evidence."
---
## Summary

Deploy the completed unified sales and post-payment fulfillment release to production Cloud Run.

## Context

Parent task ABDG38 is DONE on clean main at d0f9c91. Production is citybeat-web in kerstenblueprint/us-central1 behind citybeatmag.co; the repository-provided scripts/deploy-web.ps1 performs a source deployment while preserving runtime secrets.

## Scope

Capture the current production revision; deploy the repository source; confirm the new revision is Ready with production traffic; verify public health, Sales Desk authentication behavior, fulfillment access isolation, sales guide download, and unchanged Stripe webhook authentication; record exact revision and rollback target without exposing secrets.

## Risks

A failed image build or unhealthy revision could interrupt production. Incorrect environment handling could affect Stripe, Firebase, or email integrations. The deployment command preserves existing service configuration and verification avoids mutating payments or customer records.

## Verify Steps

Confirm Cloud Run revision readiness and traffic, GET /api/health=200, unauthenticated Sales Desk/API requests remain protected, a missing fulfillment token is rejected, the sales guide downloads as a valid PDF, and the production revision serves the release.

## Rollback Plan

Route Cloud Run traffic back to the previously captured Ready revision. The release adds Firestore documents and fields but performs no migration or destructive schema change during deployment.

## Notes

Deployment approved on 2026-07-21. Do not print or write Cloud Run secret values.

