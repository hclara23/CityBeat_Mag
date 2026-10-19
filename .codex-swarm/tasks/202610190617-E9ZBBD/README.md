---
id: "202610190617-E9ZBBD"
title: "Fix website audit findings and re-audit"
status: "BLOCKED"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "Start: implement the requested audit remediation directly, validate evidence and dependencies, then re-audit source and runtime behavior." }
  - { author: "ORCHESTRATOR", body: "Blocked: source remediation and re-audit pass build, TypeScript, 673 tests and zero production advisories. Full closure needs Cloudflare reporting credentials, authorized GA verification and release approval; development-toolchain advisories remain documented." }
  - { author: "ORCHESTRATOR", body: "Remediation deployed under release task 202610190638-MWWF8E. All public release gates pass; retain BLOCKED for Cloudflare missing reporting token, GA reporting access and ten dev-only advisories." }
doc_version: 2
doc_updated_at: "2026-10-19T06:36:11+00:00"
doc_updated_by: "agentctl"
description: "Remediate the October 18 audit findings, verify dependencies, SEO, caching, analytics and CSP, then publish a corrected evidence-backed re-audit."
---
# CityBeat remediation and re-audit — 2026-10-19

## Summary

Implemented the source-code remediation for the October 18 audit and re-audited the upgraded local production build. **Not deployed. Not an all-clear for production analytics.** The live service remains `citybeat-web-00336-yen`.

- Production dependency audit: **0 known advisories**, down from 76.
- Automated regression suite: **673 passed, 0 failed** across 101 files.
- Next.js 15.5.28 production build and TypeScript validation passed.
- English/Spanish Ads and Premium responses passed HTTP, canonical, hreflang, nonce, and cache-policy assertions.
- Mobile Premium navigation and English-to-Spanish client navigation worked; the sampled 390px viewport had no horizontal overflow. Console inspection returned no errors/warnings in the sampled interaction.
- Live Cloudflare reporting token is **empty**. Google service-account impersonation for read-only reporting is **denied** to the available operator account. Actual provider event reception is not verified.

## Context

This supersedes overbroad conclusions in the October 18 audit. Representative HTTP success and code inspection do not establish that every customer/payment journey works. No real payment, payout, email, claim, or account change was performed in this re-audit. Retired Sanity remains out of scope. No subagents were used.

The earlier CDN finding also assumed more than the evidence supported: the deployment uses Cloudflare DNS/Web Analytics, not a verified proxied Cloudflare HTML cache. Private/no-store HTML is intentional with fresh CSP nonces. Public data caching and sitemap caching are separate from HTML caching.

## Scope

| Previous finding | Remediation / verified status |
| --- | --- |
| Production dependency backlog | Updated Next/React, React Leaflet, Sentry, Nodemailer, Sharp and transitive packages; removed unused next-intl; production npm audit now zero. Build-only Tailwind packages are classified as development dependencies. Added blocking production audit gate to deployment CI. |
| Public HTML caching | Retained no-store for nonce-bearing HTML; explicitly cache listing data for 15 minutes without caching database errors as missing listings. No CDN hit-rate claim is made. |
| Ads SEO | Localized title/description, canonical, en/es/x-default alternates and social metadata; runtime verified in both languages. |
| Premium SEO | Localized metadata and alternates; runtime verified. Removed redundant nested main landmark. |
| Listing description grammar | Replaced indefinite-article template with neutral category/location copy. |
| Analytics uncertainty | Fixed first-page GA event queue before script loading; added regression tests. Health diagnostics distinguish configuration from operation, expose missing Cloudflare reporting credentials, and show failed first-party queries as unavailable rather than zero. Live provider verification remains blocked. |
| Unsafe script CSP | Fresh cryptographic nonce per HTML response, strict-dynamic, no script unsafe-inline or production unsafe-eval; overwrite caller-supplied nonce; forbid inline handlers. Verified hydration markup and mobile/client navigation. Inline styles remain supported. |
| Stale Browserslist data | Refreshed caniuse-lite to 1.0.30001816; stale-data build warning is gone. |
| Heavy sitemap | Dedicated XML route with explicit public cache headers backed by hourly data cache; serializer deduplicates URLs, escapes XML and does not invent lastmod. Tests cover serializer behavior. Production cold/warm timing still requires candidate verification with database access. |

The Next 15 migration uses asynchronous request APIs. Server params/searchParams and client param reads were migrated with the official codemod; React 19 type incompatibilities were corrected. Locale HTML is explicitly dynamic: a first runtime test caught DYNAMIC_SERVER_USAGE from the old static-param setup, which was fixed before the final runtime pass.

Deployment CI now preserves existing runtime secrets when a repository secret is empty, instead of overwriting production with an empty string. Root dependency manifests trigger CI; CI Node version matches the Docker Node 22 major.

## Risks

1. **Analytics configuration remains open.** Cloud Run read access succeeded with an existing alternate account. `CLOUDFLARE_ANALYTICS_API_TOKEN` is an empty literal value, not a secret reference. A valid read-only Analytics token must be configured securely. Do not paste credentials into chat. The GA property is configured, but an attempted read-only service-account token request was denied; this is not proof the production service itself lacks GA access. Verify from an authorized GA session or the authenticated application dashboard.
2. **10 development-tree advisories remain** (7 high, 3 moderate; 0 critical). These affect Tailwind 3/globbing/ESLint-related tools and Turbo. The full tree is not vulnerability-free. npm proposes major toolchain changes, including Tailwind 4, and even a Next ESLint downgrade; those were not forced into this release. Build only trusted repository input. These remain recorded follow-up findings, not dismissed as harmless.
3. **Major framework upgrade needs candidate testing.** Stripe checkout UI, Google/Firebase sign-in, Maps, Novu, authenticated analytics, and real production data pages have not all been exercised under the new CSP. The existing automated suite passes, but it is not a substitute for those browser checks. Deploy a no-traffic candidate before promotion.
4. **No guaranteed cost or performance improvement.** Caching is per application instance/storage behavior; autoscaling cold instances may rebuild data. Listing updates can take up to the existing 15-minute public-data TTL to appear server-side. Live sitemap latency is not yet measured for this release.

## Verify Steps

Completed:

1. `npm audit --omit=dev --audit-level=low` — zero advisories.
2. `npm test` — 653 web + 20 library tests passed (673 total).
3. `npm run type-check --workspace=apps/web` — passed.
4. `npm --prefix apps/web run build` — passed; final build used the public ARG values declared by Dockerfile, including the production public origin.
5. `node scripts/audit-response-security.mjs` against the final local production server — four localized routes returned 200, correct production-origin canonical/hreflang, fresh response nonces, nonced executable SSR scripts, and no-store. Spoofed caller nonce was replaced.
6. Browser: Premium at mobile width, open/close navigation, one main landmark, no horizontal overflow; switch to Spanish, localized title/lang/menu; GA and Cloudflare loader elements present. This verifies loading markup/interaction, **not** receipt by the reporting services.
7. `npm run env:check` under the authorized operator account — required deployment environment present, with optional/fallback configuration warnings recorded by the checker.
8. `node scripts/audit-analytics-readonly.mjs <authorized-google-account>` — live revision read; confirmed reporting blockers. No tokens printed or persisted.
9. `git diff --check` — passed.

Still required before calling the full audit closed:

- Securely configure Cloudflare read-only reporting credentials and verify a real report.
- Verify GA reporting/Realtime with an authorized account and one controlled visit.
- Resolve or explicitly accept the remaining development-toolchain advisories.
- With specific deployment cost approval, build a no-traffic candidate, verify real-data pages/sitemap and third-party integrations, then promote only if checks pass.

## Rollback Plan

No live rollback is currently needed; production was not changed. Before deployment, the remediation is isolated in the task commit and can be reverted as a unit. For a future candidate deployment, retain the current live revision and leave traffic unchanged on failed checks. If a promoted candidate regresses, route traffic back to the recorded previous revision. Do not revert runtime secrets or payment configuration as part of a code rollback.

## Notes

Tracking task: `202610190617-E9ZBBD`. Source implementation is saved; full closure remains blocked on external analytics configuration/access and release verification. No new paid resources, IAM grants, credentials, subscriptions, or deployments were created.

