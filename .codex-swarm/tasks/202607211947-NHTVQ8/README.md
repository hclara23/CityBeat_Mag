---
id: "202607211947-NHTVQ8"
title: "Deploy directory referral rewards"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: ["202607211917-Q5D837"]
tags: ["deployment", "cloud-run", "scheduler"]
comments:
  - { author: "ORCHESTRATOR", body: "Start: deploy the committed referral rewards release, configure the protected daily scheduler, verify the live revision, and record the production result." }
doc_version: 2
doc_updated_at: "2026-07-21T19:48:09+00:00"
doc_updated_by: "agentctl"
description: "Deploy implementation commit 81a3084 to the production citybeat-web Cloud Run service, configure the daily citybeat-referrals Cloud Scheduler job with the existing protected cron secret, verify live health and unauthorized-route behavior, and record the production revision and scheduler state."
---
## Summary

Deploy the completed directory referral rewards release to the production Cloud Run service and activate its daily qualification scheduler.

## Context

Implementation task 202607211917-Q5D837 is DONE at commit 81a3084 with closure commit 18b1269. Production runs on Cloud Run service citybeat-web in project kerstenblueprint, region us-central1; scheduled jobs run in us-central1 with the protected CRON_SECRET bearer header.

## Scope

Confirm a clean main branch; deploy the repository source to citybeat-web; create or update citybeat-referrals as a daily 00:30 America/Chihuahua HTTP GET job for https://citybeatmag.co/api/cron/referrals; verify Cloud Run readiness, public health, referral endpoint authorization, scheduler state, and a safe dry-run; record the deployed revision and results.

## Risks

A failed source deployment could leave production on the prior revision. An incorrect scheduler header could prevent automatic qualification or expose the endpoint. Secret values must never be printed. Scheduler creation occurs only after the new Cloud Run revision is healthy.

## Verify Steps

Confirm the Cloud Run service reports Ready=True and routes 100% traffic to the new revision. Confirm /api/health returns HTTP 200 and an unauthenticated /api/cron/referrals request returns HTTP 401. Confirm citybeat-referrals is ENABLED with schedule 30 0 * * * and run its authenticated dry-run successfully.

## Rollback Plan

Route Cloud Run traffic back to the prior ready revision and pause citybeat-referrals. The referral schema is additive and the dry-run does not mutate rewards.

## Notes

Never emit the CRON_SECRET or scheduler Authorization header in command output or task artifacts.

