---
id: "202607211947-NHTVQ8"
title: "Deploy directory referral rewards"
status: "DONE"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: ["202607211917-Q5D837"]
tags: ["deployment", "cloud-run", "scheduler"]
commit: { hash: "6aceaf768a85906d286a9f11f064be0a70efd82e", message: "🚀 NHTVQ8 deploy referral rewards and activate production scheduler" }
comments:
  - { author: "ORCHESTRATOR", body: "Start: deploy the committed referral rewards release, configure the protected daily scheduler, verify the live revision, and record the production result." }
  - { author: "ORCHESTRATOR", body: "verified: production revision citybeat-web-00147-2sv is Ready with 100% traffic | details: health returns 200, unauthenticated referral cron returns 401, authenticated dry-run and scheduler-triggered execution succeeded, and citybeat-referrals is ENABLED." }
doc_version: 2
doc_updated_at: "2026-07-21T19:58:59+00:00"
doc_updated_by: "agentctl"
description: "Deploy implementation commit 81a3084 to the production citybeat-web Cloud Run service, configure the daily citybeat-referrals Cloud Scheduler job with the existing protected cron secret, verify live health and unauthorized-route behavior, and record the production revision and scheduler state."
---
## Summary

Deployed the completed directory referral rewards release to production Cloud Run revision citybeat-web-00147-2sv with 100% traffic and activated the protected daily referral qualification scheduler.

## Context

Implementation task 202607211917-Q5D837 is DONE at commit 81a3084 with closure commit 18b1269. Production runs on Cloud Run service citybeat-web in project kerstenblueprint, region us-central1; scheduled jobs run in us-central1 with the protected CRON_SECRET bearer header.

## Scope

Confirm a clean main branch; deploy the repository source to citybeat-web; create or update citybeat-referrals as a daily 00:30 America/Chihuahua HTTP GET job for https://citybeatmag.co/api/cron/referrals; verify Cloud Run readiness, public health, referral endpoint authorization, scheduler state, and a safe dry-run; record the deployed revision and results.

## Risks

A failed source deployment could leave production on the prior revision. An incorrect scheduler header could prevent automatic qualification or expose the endpoint. Secret values must never be printed. Scheduler creation occurs only after the new Cloud Run revision is healthy.

## Verify Steps

Verified citybeat-web-00147-2sv is the latest Ready revision and receives 100% of traffic. Verified https://citybeatmag.co/api/health returns HTTP 200 and unauthenticated https://citybeatmag.co/api/cron/referrals returns HTTP 401. Verified an authenticated dry-run returned dry_run=true, pending=0, and due=0. Verified citybeat-referrals is ENABLED in us-central1 with schedule 30 0 * * *, timezone America/Chihuahua, GET method, 600-second deadline, and a successful scheduler-triggered attempt at 2026-07-21T19:58:24Z.

## Rollback Plan

Route Cloud Run traffic back to the prior ready revision and pause citybeat-referrals. The referral schema is additive and the dry-run does not mutate rewards.

## Notes

Previous production revision: citybeat-web-00146-t6w. Deployed production revision: citybeat-web-00147-2sv. The scheduler's next recorded execution is 2026-07-22T06:30:02Z (00:30 America/Chihuahua). CRON_SECRET remained confined to process memory and was not printed or written to repository artifacts.

