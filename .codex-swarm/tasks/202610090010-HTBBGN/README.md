---
id: "202610090010-HTBBGN"
title: "HearthOS legal documents"
status: "TODO"
priority: "high"
owner: "CODER"
depends_on: []
tags: []
doc_version: 2
doc_updated_at: "2026-10-09T00:25:11+00:00"
doc_updated_by: "agentctl"
description: "Audit and update legal documents for the publicly reachable HearthOS application in C:\\dev\\Prime_Time_OS."
---
## Summary

Replaced TruccoPRO's placeholder policy and added bilingual cookie and terms pages.

## Scope

Covered student records, Firebase authentication and Firestore, attendance, communications, polls, minors, Google services, and accurately disclosed that live Stripe, Twilio, push, and AI features are not enabled.

## Risks

Education, minor-student, licensing, and record-retention requirements need qualified Texas counsel review before production reliance.

## Verify Steps

npm run lint; npm run build — passed with pre-existing lint warnings and 28 generated pages in C:\dev\Prime_Time_OS.

## Rollback Plan

Revert HearthOS/TruccoPRO commit 964adb8.

## Notes

External repository commit: 964adb8. Existing unrelated package-lock.json modification was preserved.

