# Directory release receipt

Tracking task: 202610240118-91VJGH. User authorized deployment after remaining checks, no subagents, one-time cap USD 1. Import candidates remain unpublished.

## Scope and local evidence

Application changes: unified corpus search, city/ZIP and category filters, stable pagination, mobile controls and recovery states from b80cb08. Packaging protection and local outage harness: f3d6972. No payment, payout, email or listing-content changes.

- Final `npm run build --workspace=apps/web`: passed including types/lint.
- `npm test`: all 111 test files passed.
- Emulator integration: 8,101 synthetic records; full-corpus search, page clamping, ZIP, private-field stripping and visibility checks passed.
- Production-build browser fault injection: one 503 displayed Retry; Retry restored 1–24 of 8,101 results. Harness binds loopback only and is not an application route.
- Upload audit: 1,112 files, 37,401,189 bytes; scratch, environment files and node_modules excluded. Added explicit .tmp exclusions to both ignore files to keep review data local.
- Prior local desktop and 390px English/Spanish checks are recorded in directory-expansion-local-2026-10-23.md.

## Build budget

Google Cloud Build e2-highcpu-8 published rate verified at https://cloud.google.com/build/pricing: USD 0.0156/minute. Explicit 720-second timeout bounds build compute to USD 0.1872 per active attempt. Ordinary storage, runtime and database usage remain metered; actual invoiced total is not immediately available.

Initial build 1a74c3ca-20ff-4dd4-a354-63a9b3233945 was cancelled while QUEUED with no startTime: the saved gcloud builds/timeout setting overrode YAML to 1,800 seconds. The same uploaded archive was resubmitted with explicit --timeout=720s as c6d49a37-2640-4751-9e7c-50f84356971e. No second archive upload or active duplicate build.

## Release state

Pre-release public health: healthy; app, Firestore and Stripe ok. Rollback revision: citybeat-web-00370-quv. Existing runtime environment, secrets, scaling and traffic tags are preserved.

Build c6d49a37 succeeded from 01:22:51.988Z to 01:26:49.177Z on 2026-10-24 (237.19 seconds; estimated build compute USD 0.06167). Image digest: sha256:2788ffe855169dc2c00c372a7389397cc059c36ccc47d41849a5f26865b8ae13.

Revision citybeat-web-directory-f3d6972 deployed with zero public traffic, then promoted to 100% at approximately 01:28 UTC after both candidate suites passed. Public health confirms that exact revision. No environment, secrets, minimum/maximum instance count or billing configuration was changed.

Candidate and public checks both passed: 8,038 published listings, 335 pages, disjoint first/second pages, correct last-page clamping, empty results, Super H plus ZIP search and private-field stripping. The broader 37-check smoke suite passed on both origins (English/Spanish directory and listing pages, login, premium pages, payment health, access control, sitemap, invalid payment/webhook rejection). No payment or payout was created.

Live 390px mobile interface verified in English and Spanish. Screenshot: `.tmp/directory-release-2026-10-23/live-mobile.png`. Initial revision ERROR log query returned no entries. Observation starts at 01:28:21 UTC and remains in progress until final checks.

## Known limits

Search has a 25,000-record safety ceiling and a process-local 15-minute cache. This is not a six-figure search design. Fresh hydration prevents cached unpublished/merged rows from being shown, while counts and matching can lag edits. No source review or import is approved automatically.
