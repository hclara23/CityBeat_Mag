# Customer experience remediation and release

Task: `202610190727-THW0F6`. Approved scope: all fifteen findings in the customer experience audit; one-time Google Cloud deployment spending up to $1, no new recurring services, no subagents.

## Implementation

Application source commit: `7cdfdab`; build-network correction: `fe1db3c`.

| Finding | Remediation |
| --- | --- |
| F01 Basic navigation | Every Basic card has a linked title and View Details action, independent of claim status. Claim remains secondary. |
| F02 Mobile results | Full pricing comparison and advertising removed from the space between search and results. Compact owner CTA, map and banner follow results. |
| F03 Login return | Shared safe internal-return normalizer removes duplicate locale prefixes and rejects external/ambiguous paths. Login and Google/MFA completion share this path. |
| F04 Event times | Venue timezone-aware formatting with zone label, defaulting to America/Denver; ingestion preserves supplied venue timezone. |
| F05 Free claim | Anonymous visitors see free/no-card ownership instructions, not paid summaries. Paid selection requires an explicit radio choice after sign-in; monthly default replaces annual default; supplied plan is retained through login. |
| F06 Basic reviews | One shared review/Q&A rendering used by Basic and Premium, with a real #reviews target. Imported rating counts labeled separately. |
| F07 Audience evidence | Removed unsupported 50,000+ claim in both languages; replaced with factual local/bilingual positioning. |
| F08 Phone metrics | Phone clicks included in dashboard totals, daily series and monthly reports; explicit phone metric and non-sales/non-completed-call explanation. |
| F09 Search | Category text matching, 24-result pagination, count/continuation disclosure, request cancellation, filter-page reset, corrected falsy-sponsored sorting. Bounded Firestore windows have continuation cursors rather than a terminal 8,000-record cutoff. |
| F10 Overflow | Newsletter input/container use minimum-width safeguards and a stacked form. |
| F11 Chat | Removed timer auto-open; renamed launcher Ask CityBeat. User-initiated keyboard/focus behavior retained. |
| F12 Footer | Directory and Events route directly to their pages; login label includes business owners. |
| F13 Copy/localization | Neutral factual fallback instead of restaurant/menu copy; private-use address glyphs removed; localized save/contact/closed labels and case-insensitive Spanish category labels. |
| F14 Pixel honesty | Owner installer and dashboard explicitly label all-source traffic and user-defined conversion events; they do not claim CityBeat attribution, revenue or completed sales. No new tracking identifiers or attribution engine added. |
| F15 Lead confirmation | Request-recorded wording, no response guarantee, direct-call guidance; quote record stores best-effort email provider outcome separately from successful lead capture. Provider acceptance is not inbox delivery. |

## Verification before deployment

- 679 automated tests passed: 659 web and 20 library tests. Six new customer-experience regression tests cover localized returns, hostile destinations, timezone rollover/DST, imported glyphs, phone totals/series/CSV, and UI source invariants.
- TypeScript and local production build passed; git diff whitespace check passed.
- Added read-only public candidate checks in `scripts/customer-experience-smoke.mjs` for pagination, name/category search, Basic/Premium review targets, contact links, free claim, audience copy and event timezone.
- Existing payment-readiness, private-route, malformed-checkout, unsigned-webhook and sitemap release gates remain applicable. No valid payment or lead is submitted by these gates.

## Release state

Live at https://citybeatmag.co on revision `citybeat-web-cx-fe1db3c`, confirmed at 100% traffic. Image digest: `sha256:f975d943874e6ee74b7214343a8086db296f034930571cede58bbb05931620f3`. Successful build: `e9c12a19-5f39-472d-9211-e7462295b755` in us-central1.

- Candidate and live public origin both passed the new customer-experience regression script and all 37 existing release checks. Stripe read-only readiness identified the exact new revision; anonymous private/cron access and malformed checkout/unsigned webhook were rejected.
- Live continuation beyond the first 8,000 records returned HTTP 200, 24 results and 35 matches in the next window; pagination does not silently stop at the old cap.
- Browser verified Basic search → profile → free claim → login/signup return context; Basic reviews/Q&A; Spanish Super H contact/save/category/closed labels; and absence of spontaneous chat opening.
- At 390px viewport, directory document width was 375px (no horizontal overflow); filtered Premium heading moved to approximately y=1473 instead of the prior y=5273. Search controls remain above results; pricing/banner content no longer intervenes.
- Desktop homepage at 1280px had document width 1265px (no overflow). One navigation exceeded the browser's 10-second wait, then completed successfully; subsequent DOM and console checks succeeded with no captured warnings/errors. No fast-load SLA is claimed.
- Hosting cache refreshed by cloning the existing version while preserving routing/files. Release `sites/kerstenblueprint/releases/1792396511417000`, version `b99d448b1056d0cb`, at 2026-10-19T07:55:11.417Z.
- Screenshot: [live directory](evidence/customer-experience-2026-10-19/live-directory.jpg). Temporary mobile viewport reset.
- Rollback remains `citybeat-web-audit-ef346a3`; preserve runtime credentials and financial configuration when rolling traffic back.

## Cost and scope safeguards

Cloud Build: `f42b8e6b-8423-414a-9825-e6f7828492ff`, E2_HIGHCPU_8. The CLI applied an 1,800-second timeout despite the YAML's 720-second value. At the [published $0.0156/minute build rate](https://cloud.google.com/build/pricing), the applied timeout bounds this attempt's build compute at $0.468 before free-tier treatment. Storage, network and test runtime are additional; track cumulative release cost against $1. No new scheduled job, paid API, subscription or recurring service configuration is introduced.

The first attempt was cancelled after page-data collection stalled. Comparison with the previous successful release identified the missing `--network cloudbuild` setting; the replacement used that network and an explicit CLI `--timeout=720s`. It completed successfully. Combined start-to-finish duration was about 755 seconds, or **$0.1963 estimated build compute**, before free-tier treatment. Storage, network and test runtime are additional; this is not a final invoice. No further builds were initiated.

Existing Firestore usage remains metered. Cached bounded search windows avoid unbounded memory and expose continuation, but they are not a full-text search index or a promise of constant-cost six-figure search. A dedicated indexing strategy remains a future scaling decision, not part of this release.

## Verification limits

Real customer account creation, ownership verification emails, successful payments, bank payouts and report delivery are not exercised. Authenticated changes are covered by source inspection and deterministic tests, not a claim of real customer end-to-end execution. Existing Cloudflare/GA reporting credential/access issues from the separate site audit are not repaired by this UI release. Pixel measurement is now described honestly; CityBeat-specific conversion attribution is not newly implemented.
