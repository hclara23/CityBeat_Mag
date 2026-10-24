# Directory expansion: local implementation verification

Task: 202610240056-BZVEW5. Local phase only; no deployment or listing publication.

## Implemented

- One search corpus across published, non-merged listings, replacing user-facing inventory windows. Stable 24-result pagination, global premium ordering, accent-insensitive text and Spanish category matching.
- City/ZIP and canonical category filters, URL-persisted filters, retry/empty states, compact mobile header and accessible controls. Sponsored records outside the three-card spotlight remain in the results.
- Read-only provenance manifest and a 100-record Texas Comptroller outlet preview. No taxpayer identifiers or private taxpayer contact fields are requested. No listing correction, deletion, relabeling or owner-content update is automatic.

## Preview evidence

Observed 2026-10-24 01:00 UTC. Existing records: 9,790. Source update: 2026-10-17. Preview uses ten alphabetically ordered outlets from each of ten El Paso ZIPs; this is not a representative coverage estimate.

| Disposition | Count |
| --- | ---: |
| New-listing review | 91 |
| Possible existing match | 7 |
| Rejected address | 1 |
| Duplicate within preview | 1 |
| Approved to publish | 0 |

Provenance manifest flags 3,812 Google-source records and 3,857 missing-source records; 14 flagged listings are protected by ownership/claim/tier/billing signals. All actions require review; no automatic patches are included.

Local artifacts (intentionally not committed): `.tmp/directory-review-2026-10-23/import-preview.json`, `provenance-review.json`, and `summary.json`. Review operating status, business/public-address suitability, municipality boundaries and duplicate candidates before any import. An outlet permit alone does not establish an operating storefront.

## Verification

- `npm test`: all tests passed, 111 test files across three workspaces.
- `npx tsc --noEmit` in apps/web: passed after final UI corrections.
- `npm run build --workspace=apps/web`: passed; Firestore pointed at an unused loopback emulator address during build, not production. Final changes after build were limited to the zero-result range display and local verification script; final TypeScript and test suite checks passed.
- Six new search tests: 8,101-record complete traversal, ranking, aliases, branch ZIP/city filtering, visibility, cache single-flight/expiry, partial-failure handling, capacity guard and cursor validation.
- Four preview/provenance tests: duplicate matching, branches/suites, invalid location/mailbox rejection, protected records and no automatic mutation.
- `scripts/verify-directory-emulator.mjs`: passed against demo-citybeat-qa on loopback Firestore. Seeds 8,101 synthetic records and verifies actual API full-corpus search, 338-page pagination, last-page clamping, ZIP filtering, private-field stripping and fresh visibility recheck after unpublishing a fixture.
- Browser checked English desktop search, matching result, URL persistence, location-filter empty state and clear-filter recovery against local emulator fixtures. At 390px, verified compact controls and cards, category selector interaction, and Spanish search returning `1–1 de 1 resultados`. No checkout, email or production mutation was performed. Screenshots are saved beside the local review artifacts as `local-directory-proof.png` and `local-directory-mobile.png`.
- `git diff --check`: passed.

## Remaining release gates and limitations

- API-outage retry UI has not been interactively fault-injected; cache failure/recovery is unit-tested. Mobile verification used a 390px browser viewport, not a physical phone.
- Index ceiling is 25,000 published source documents; exceeding it returns a visible 503 rather than silently omitting results. A larger-scale indexed search design and cost review are required before six-figure inventory growth.
- Cache is process-local with 15-minute TTL. Matching/counts may lag edits; hydrated records enforce current visibility. Multiple instances/cold starts can each read the corpus. Existing Firestore reads/rate-limit writes remain metered: no new paid search subscription does not mean zero operating cost.
- No deployment, publishing, paid service or production write is authorized by this report. Production smoke testing is deferred until a separately approved release.

## Rollback

Revert this task's search/UI commits through the normal guarded workflow. Review manifests are local only and require no production rollback. Stop the owned local server and emulator after testing; fixture data is disposable and was never exported to production.
