---
id: "202608172158-GCM94E"
title: "Recover and route public article submissions"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: ["backend", "notifications"]
verify: ["npx tsx --test apps/web/src/lib/public-submissions.test.ts apps/web/src/lib/notify-prefs.test.ts", "npm run type-check --workspace=apps/web", "npm run build --workspace=apps/web"]
doc_version: 2
doc_updated_at: "2026-08-17T22:08:16+00:00"
doc_updated_by: "agentctl"
description: "Preserve the existing public submission, make public contributions appear idempotently in the Developer and Editor review queue, retain uploaded images, notify eligible staff without leaking contributor PII, add regression coverage, and deploy the verified fix."
---
## Summary

Preserve every public article submission as a private source record, create an idempotent review copy, and notify all editorial staff through the CityBeat inbox and email channel.

## Context

The public contribution endpoint stored records in the Firestore submissions collection with status pending, while Developer and Editor queues read only the articles collection with status pending_review. No bridge or staff notification existed, and uploaded image bytes were discarded.

## Scope

Save the source record before downstream work; validate and persist optional images; promote with deterministic article ids; recover legacy pending submissions newest-first on authenticated queue reads; join contributor contact details only inside authenticated admin APIs; synchronize review outcomes back to the source record; add deduplicated staff notifications and inbox polling; show editors when a legacy image could not be recovered.

## Risks

The existing legacy upload may retain only its filename because the former endpoint discarded the file bytes. Recovery never deletes or overwrites the original submission. Review-copy retries do not overwrite editorial edits, and contributor email/source IP remain outside publishable article documents.

## Verify Steps

Run npx tsx --test apps/web/src/lib/public-submissions.test.ts apps/web/src/lib/notify-prefs.test.ts; npm test; npm run type-check --workspace=apps/web; npm run build --workspace=apps/web; and git diff --check. After deployment, load /en/admin. The newest pending legacy submission must appear in Review Queue and each Developer/Editor must receive one deduplicated inbox item.

## Rollback Plan

Revert the task commit and redeploy. Original submissions documents remain intact; recovery only adds deterministic articles/submission-<id> review copies and merge-only status/link metadata, so any review copy can be removed independently if required.

## Notes

Production Firestore could not be inspected directly with the current local Google credential (PERMISSION_DENIED). Recovery therefore runs under the deployed CityBeat service identity during the first authenticated queue read. Unrelated payout, partner-sales, and package.json workspace changes were preserved and excluded from this task.

