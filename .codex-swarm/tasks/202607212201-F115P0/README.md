---
id: "202607212201-F115P0"
title: "Deploy unified sales fulfillment"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: ["202607212040-ABDG38"]
tags: ["deployment", "cloud-run", "sales"]
commit: { hash: "646fb7c4c67b03804fa6cc33b411e960a3605409", message: "🚀 F115P0 deploy unified sales fulfillment to Cloud Run" }
comments:
  - { author: "ORCHESTRATOR", body: "Approved by the user: deploy the completed unified Sales Desk and post-payment fulfillment release to production and verify it end to end." }
  - { author: "ORCHESTRATOR", body: "Start: capture the current production revision, deploy clean main with the repository Cloud Run script, verify traffic and protected sales routes, and retain an exact rollback target." }
  - { author: "ORCHESTRATOR", body: "verified: production revision citybeat-web-00148-cjs is Ready with 100% traffic | details: health returned 200, protected sales and fulfillment APIs returned 401 without credentials, both wizard routes behaved correctly, and the public sales guide PDF matched the release artifact exactly." }
doc_version: 2
doc_updated_at: "2026-07-21T22:12:06+00:00"
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

Deployment approved and completed on 2026-07-21. Cloud Run created Ready revision citybeat-web-00148-cjs at 2026-07-21T22:10:44Z and routed 100% of production traffic to it. Rollback target is previously Ready revision citybeat-web-00147-2sv. Production verification: GET /api/health returned 200; unauthenticated GET /api/sales/me, POST /api/sales/checkout, POST /api/sales/send-link, and GET /api/sales/orders/not-a-real-order/intake returned 401; /en/admin/sales/me redirected to login with 307; /en/fulfill/not-a-real-order loaded with 200; /downloads/citybeat-sales-guide.pdf returned 200 application/pdf, began with %PDF, and matched the local release artifact SHA-256 780929838060c2ad44c950adf6708400a13d60597f60ff28ebcf39153f09159e. No secret values were printed or written.

