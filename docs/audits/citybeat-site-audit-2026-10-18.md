# CityBeat Website Audit — 2026-10-18

## Scope

Read-only audit of the current Firebase/Cloud Run CityBeat application and public production site. Retired Sanity code and workflows are explicitly out of scope.

Reviewed representative English and Spanish public routes, the directory and Super H Automotive listing, SEO metadata, structured data, analytics wiring, security headers, public caching, API protections, dependency health, and the local test/build baseline.

## Executive summary

The public site is operational and the main customer journeys are healthy. All representative routes returned HTTP 200, the English and Spanish experiences render correctly, Super H's call action is live, directory listings ship server-rendered SEO metadata and structured data, the production build succeeds, TypeScript passes, and all 667 automated tests pass.

The most important remediation is dependency security: the current production dependency tree reports 76 advisories (3 critical, 27 high, 45 moderate, 1 low). The next priorities are correcting metadata gaps on the advertising and Premium pages, revisiting the site-wide private/no-store response policy for public content, and confirming the production analytics environment from an account with Cloud Run read access.

## Findings

### P0 — none observed

No evidence of an active outage, broken payment route, public privilege bypass, or data exposure was found in this audit.

### P1 — dependency security backlog

`npm audit --omit=dev` reports 76 production-tree advisories: 3 critical, 27 high, 45 moderate, and 1 low. Notable affected families include Solid/Novu, Tiptap, Sharp, Firebase/gRPC, Undici, and WebSocket dependencies. Many are transitive and some suggested fixes are major-version changes, so remediation should use a staged upgrade branch with the complete regression suite rather than an indiscriminate `npm audit fix --force`.

Recommended action:

1. Upgrade patch/minor-safe packages first, especially Novu, Tiptap, Sharp, Undici, `ws`, and `@fastify/busboy` dependency paths.
2. Re-run the audit and identify advisories that are reachable in production versus build/editor-only code.
3. Plan Firebase and other major upgrades separately where npm proposes a semver-major change.

### P1 — public pages are sent as private, non-cacheable responses

The live homepage responds with `Cache-Control: no-store, must-revalidate, no-cache, max-age=0, private`. This prevents browsers and edge caches from reusing public editorial pages and weakens the value of Cloudflare/CDN delivery. Listing pages already use 15-minute ISR in source, but the observed global response policy may negate useful downstream caching.

Recommended action: determine which middleware or hosting layer adds the global policy, then allow cacheable public pages while retaining `no-store` for authenticated, account, admin, checkout, and API responses. Verify with response headers on representative public and private routes.

### P1 — advertising landing page has generic SEO metadata

The live `/en/ads` page uses the homepage title and generic homepage description, and does not expose a canonical URL. This is a high-intent commercial page, so the current metadata makes it harder to rank and produces weak link previews.

Recommended action: add localized `generateMetadata` output for `/[locale]/ads`, including a specific title, description, canonical, English/Spanish alternates, and social-card metadata.

### P2 — Premium page has no canonical or language alternates

The Premium page has a useful dedicated title and description but lacks canonical and hreflang metadata.

Recommended action: replace the static metadata object with localized metadata containing self-canonical, `en`, `es`, and `x-default` alternates plus localized Open Graph fields.

### P2 — fallback listing description has incorrect English grammar

When no custom description is present, the listing template produces text such as “Super H Automotive is a auto repair in El Paso.” This appears in the live meta description.

Recommended action: use category-aware nouns (for example, “an auto repair shop”) or neutral copy such as “provides auto repair services in El Paso.”

### P2 — production analytics configuration cannot be fully verified locally

The application contains GA4, Cloudflare Web Analytics, PostHog, and first-party page-view wiring. The first-party endpoint excludes staff, supports an IP denylist, rate-limits unauthenticated writes, strips queries/fragments, and applies retention metadata. GA and first-party markers were present on representative live HTML. Cloudflare's marker was not consistently observable on every checked route.

The repository environment check could not read the Cloud Run service because the active gcloud account (`elevatelepaso@gmail.com`) lacks `run.services.get` on project `kerstenblueprint`. Therefore this audit cannot prove that every production token/property is configured correctly.

Recommended action: run `npm run env:check` from an authorized operator account, then compare live GA4 DebugView/Realtime, Cloudflare Web Analytics, and the first-party analytics dashboard during a controlled non-staff visit.

### P2 — CSP still allows unsafe script execution modes

Security headers are broadly strong: HSTS, nosniff, frame protections, a restrictive permissions policy, and a CSP are present. However, the CSP permits both `'unsafe-inline'` and `'unsafe-eval'` for scripts. This reduces protection against script injection.

Recommended action: first remove `'unsafe-eval'` if the production build does not require it; then evaluate nonce- or hash-based handling for Next.js inline scripts. Test Stripe, Firebase sign-in, Maps, Novu, analytics, and hydration before rollout.

### P3 — stale browser compatibility data

The production build reports that `caniuse-lite` is nine months old. This does not break the current build, but it can make browser targeting and CSS transformations stale.

Recommended action: refresh Browserslist data as part of routine dependency maintenance and validate the generated lockfile.

### P3 — sitemap generation is relatively heavy

The main sitemap was about 252 KB, contained 479 URL entries and 1,437 hreflang references, and took about 1.9 seconds on the sampled request. It is valid in scale and the directory has a separate paginated sitemap, but the main sitemap is dynamically generated and reads several Firestore collections.

Recommended action: monitor sitemap latency/error rate, keep the hourly cache warm, and consider precomputed sitemap records if latency or database reads grow with the planned directory expansion.

## Verified strengths

- Representative public routes returned HTTP 200 in both languages.
- `/es` renders Spanish copy and declares `html lang="es"`.
- The live directory has a single main landmark and H1, labeled search/category controls, and no rendered images missing `alt` attributes in the sampled view.
- Super H Automotive exposes both its phone number and a visible `CALL NOW` link using `tel:9152026730`.
- Directory detail pages generate server-side titles, descriptions, canonicals, hreflang alternates, Open Graph/Twitter cards, LocalBusiness-derived schema, breadcrumbs, first-party-only review schema, and visible answered-question FAQ schema.
- Invalid locales are rejected rather than creating indexable duplicate pages.
- Analytics ingestion is rate-limited and avoids counting authenticated staff.
- Stripe webhook code verifies the Stripe signature, and sampled public mutation endpoints use authentication and/or rate limiting.
- Security headers cover all routes; API responses receive `no-store` and `nosniff`.
- `robots.txt` blocks private/transactional areas and advertises both sitemap endpoints.
- Production build, TypeScript validation, and all automated tests pass.

## Validation record

- `npm test` — passed: 667 tests, 0 failures.
- `npm --prefix apps/web run type-check` — passed.
- `npm --prefix apps/web run build` — passed on Next.js 14.2.35.
- `npm audit --omit=dev --json` — completed with advisories: 3 critical, 27 high, 45 moderate, 1 low.
- `npm run env:check` — blocked by missing Cloud Run read permission for the active gcloud account; application failure was not indicated.
- Live browser checks — English homepage, Spanish homepage, directory, and Super H listing rendered without console errors.

## Recommended remediation order

1. Stage and verify production dependency upgrades.
2. Add localized canonical metadata to Ads and Premium.
3. Correct the default listing-description grammar.
4. Split public caching from authenticated/private response policies.
5. Verify all production analytics tokens and live event delivery with authorized Cloud Run access.
6. Harden CSP incrementally.
7. Refresh Browserslist data and monitor sitemap performance.

No production behavior was changed or deployed during this audit.
