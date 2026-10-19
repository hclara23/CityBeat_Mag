# CityBeat customer experience and value audit

Date: October 19, 2026. Task: `202610190711-B76N4T`. Public site: https://citybeatmag.co. Release under review: `ef346a3` / `citybeat-web-audit-ef346a3`.

## Executive assessment

CityBeat has a substantial feature foundation and an identifiable visual brand. The immediate problem is not a shortage of premium features: it is that discovery, claiming, reviews and reporting do not consistently deliver the promise made by the sales pages. Prioritize these gaps before scaling paid acquisition or the directory to hundreds of thousands of records.

The following ratings are qualitative auditor judgments, not customer research, measured conversion rates or formal compliance scores.

| Area | Assessment | Main reason |
| --- | --- | --- |
| Visual UI | Promising, needs refinement | Recognizable dark/cyan identity; desktop overflow and intrusive chat |
| Shopper UX | Needs material improvement | Basic cards do not open details; mobile results buried below sales content |
| Owner conversion | At risk | Free claim journey introduces paid annual terms before sign-in |
| Feature coherence | Mixed | Useful owner tools, but Basic review promises conflict with public rendering |
| Functional reliability | Specific high-priority defects | Localized login return and event timezone errors |
| Perceived customer value | Potentially strong, insufficiently demonstrated | Phone actions omitted from headline totals; audience claim lacks evidence |

## Method and limits

- Live public desktop and 390 x 844 mobile browser inspection, screenshots viewed during the audit, DOM measurements, public API diagnostics, and source tracing. Temporary viewport overrides were reset.
- Sampled home, directory search, Basic and Premium detail, English/Spanish Super H, claim, login/signup handoff, Founders, Premium, advertising, product/cart, contact and event detail journeys.
- A temporary newsletter product was added to the audit browser cart, empty-email validation tested, then the item removed and the empty cart verified. No checkout session or purchase was completed.
- No accounts created, real leads submitted, emails sent, customer listings changed, payouts initiated, application code changed or deployments run.
- Authenticated owner editing, OAuth completion, payment settlement, commission disbursement and real email delivery were not end-to-end tested. Source presence is not proof of live operation.
- Previous release checks (673 tests, build/type checks, HTTP smoke and CSP checks) are historical evidence, not new runs in this audit. Their success did not cover the issues below.
- Existing graph index was used only for orientation; it was insufficiently current for these UI flows. Findings were verified against actual source and/or the live site.
- No full screen-reader, keyboard-only, assistive technology, performance benchmark or formal WCAG conformance audit was performed. Accessibility concerns below are bounded observations.

## Prioritized findings

P1 = fix before expanding acquisition; P2 = next usability/value iteration. No confirmed P0 outage or security finding was established by this audit.

### F01 — P1: Basic directory cards do not lead shoppers to the business

**Evidence:** On `/en/directory`, search `787 Coffee`. Its Basic card has a plain heading and a `Claim Free / See Premium` link to `/en/directory/0cbe8a5c-3294-479c-8f2c-cf5fb098642f/claim`, but no detail, phone or website action. Its useful public detail page exists. Source also shows claimed Basic cards lose even the claim action.

**Source:** `apps/web/src/app/[locale]/directory/DirectoryPageClient.tsx`, Basic `basicListings.map` branch around lines 519–600.

**Impact:** Shoppers encounter an owner sales funnel instead of business information. Free owners cannot readily see the directory's discovery value.

**Recommendation / acceptance:** Every published card must have a linked title and View Business action, regardless of ownership or tier. Keep Claim secondary. Test claimed/unclaimed Basic and Premium cards with mouse and keyboard.

### F02 — P1: Mobile results are separated from search by excessive sales content

**Evidence:** At 390px width, measured directory heading positions were approximately: search 656px, comparison 1,394px, sponsored listings 3,488px, featured Premium 5,273px, Basic listings 8,224px. Category/city links appeared around 48,452px after the long result list. A filtered Super H search still retained the large plan comparison and unrelated advertising between search and results.

**Impact:** A search can appear to have done nothing; visitors must scroll several screens to see its result. Owner upselling competes with the shopper's task.

**Recommendation / acceptance:** Put results immediately after search/filter controls; move the full comparison to the owner/pricing journey. Use a compact claim CTA. At 390px, an exact-name result should be reachable immediately below the search controls without passing a pricing table.

### F03 — P1: Review and Q&A sign-in returns can generate invalid doubled locale paths

**Evidence:** Live review sign-in links contain `redirectTo=/es/directory/TJmwyo55waiFiGYp2fmu` (and the English equivalent). Login's `destFor` accepts that path, then `router.replace` prefixes another locale. Constructed `/es/es/directory/...` and `/en/en/directory/...` routes returned 404.

**Source:** `DirectoryDetailClient.tsx` around lines 1416 and 1513; `app/[locale]/login/page.tsx` around lines 69 and 109.

**Confidence:** Live link + source-traced post-auth failure + HTTP confirmation; actual customer sign-in was not performed. The separately tested claim flow uses an unlocalized destination and preserves context correctly.

**Recommendation / acceptance:** Centralize safe localized return-path normalization. Test localized/unlocalized destinations for email login, signup and OAuth in both languages; land back on the original listing exactly once.

### F04 — P1: Event times can be displayed in UTC rather than El Paso time

**Evidence:** `/en/events/tm-vvG1YZ_1752rGP` displayed Yandel as Monday, October 19 at 2:00 AM. Its structured start time is `2026-10-19T02:00:00.000Z`, which is Sunday, October 18 at 8:00 PM in `America/Denver`. The linked ticket URL also identifies October 18. The calendar list showed the same UTC-style time.

**Source:** `app/[locale]/events/page.tsx` formatting around line 34 and `events/[id]/page.tsx` around line 60 omit an explicit venue timezone. Stored ISO timestamps alone are not the problem.

**Impact:** Wrong attendance dates/times undermine the publication's reliability.

**Recommendation / acceptance:** Render in the venue's IANA timezone, label it, and test date rollover and daylight saving boundaries. Keep structured data and visible local time consistent representations of the same instant.

### F05 — P1: The free claim journey presents paid annual renewal terms too early

**Evidence:** The Basic 787 Coffee claim page starts as a free claim but presents Founding Annual `$99/yr` and automatic-renewal terms before the Sign In Required action. Source defaults `selectedPlan` to `founding_annual` and renders pricing before authentication gating. The Founders landing emphasizes monthly pricing, adding a billing-period surprise.

**Source:** `app/[locale]/directory/[id]/claim/page.tsx`, default around line 279 and pricing/terms around lines 600–618.

**Impact:** Owners can reasonably infer that claiming their free listing requires payment.

**Recommendation / acceptance:** Separate Claim Free and Upgrade intent. Show free verification steps and sign-in first; require an explicit paid-plan choice before showing checkout renewal terms. Preserve any deliberately selected monthly/annual plan through the journey.

### F06 — P1: Basic review features are promised but their public destination is missing

**Evidence:** The public comparison offers Basic review replies and a review QR. The sampled Basic detail shows a rating and count but no native review/write-review/Q&A section. Source puts these sections inside the Premium/Featured layout, leaving a Basic review QR's `#reviews` destination absent.

**Source:** `DirectoryPlanComparison.tsx`; `DirectoryDetailClient.tsx` tier layout around line 1026 and review section around line 1416. The quote form is also inside the paid layout; do not describe it as a publicly available Basic lead form.

**Impact:** A claimed owner may receive tools whose customer-facing destination does not exist. Displayed aggregate ratings are not clearly distinguished from native CityBeat reviews.

**Recommendation / acceptance:** Align the entitlement matrix, public rendering and owner tools. Prefer a useful public review experience for all published businesses; attribute imported ratings separately. Test Basic QR destinations and a complete review/reply flow with authorized test accounts.

### F07 — P1: A fixed audience claim is not substantiated on the sales page

**Evidence:** `/en/ads` states `50,000+ monthly bilingual readers`. `app/[locale]/ads/page.tsx` contains this as fixed copy (around lines 39 and 54). No period, methodology, channel definition or supporting source is shown.

**Important:** This audit does not prove the number false. It establishes that the customer-facing claim is unsubstantiated by the page and available evidence.

**Recommendation / acceptance:** Attach a dated, supportable media-kit metric defining print versus digital readership and deduplication, or remove the quantitative claim until verified. Do not substitute raw requests or bot traffic for readers.

### F08 — P1: Phone-click value is missing from headline action totals

**Evidence:** `api/track/listing/route.ts` records `click_phone` independently and does not fold it into `click_action`. The owner analytics Clicks/customer-action calculation and monthly owner report total add website, directions, actions and leads, but omit phone clicks. CSV support for phone clicks exists elsewhere.

**Source:** `app/[locale]/dashboard/listings/[listingId]/CmsModules.tsx` analytics calculation around line 635; `api/cron/owner-reports/route.ts` around lines 171–177; `lib/listing-analytics.ts`; `api/track/listing/route.ts` aggregate map and counter write.

**Confidence:** Source verified; an authenticated report was not generated in this audit.

**Recommendation / acceptance:** Surface Phone Clicks explicitly and include them once in customer-action totals and reports. Label them clicks, not completed calls or customers. Test an event fixture across dashboard, CSV and email calculations.

### F09 — P2: Search promises category matching, but text search excludes category and hides truncation

**Evidence:** The search UI promises category search; the API's query predicate checks name, description and address only. Public `query=auto repair` returned 14 results without Super H, although its category communicates auto repair. The unfiltered API returned 200 records with `truncated:true`; the UI does not disclose truncation or provide result pagination.

**Source:** `api/directory/route.ts` lines 157–179; `DirectoryPageClient.tsx` response handling. Search corpus also has an 8,000-record backstop, unsuitable as an undisclosed full-search strategy for a future six-figure directory.

**Recommendation / acceptance:** Search normalized categories as well as descriptive fields, add pagination and honest result counts, and test records beyond current caps. Do not scale imports before confirming discoverability across the full corpus. Category-filter ordering needs separate investigation; it is not asserted here as a confirmed defect.

### F10 — P2: Desktop newsletter form creates horizontal overflow

**Evidence:** On the homepage, a 1,280px viewport produced document width 1,310px; the JOIN button extended to roughly 1,310px. The narrow grid newsletter form uses a two-column layout at the viewport breakpoint. The 390px mobile check did not reproduce overflow.

**Source:** `components/NewsletterForm.tsx`, layout around line 49.

**Recommendation / acceptance:** Use `minmax(0,1fr)`, appropriate `min-width:0`, or stack according to container space. Verify 320, 390, 768, 1024 and 1280px plus zoom; no horizontal document scroll from the form.

### F11 — P2: Chat opens and moves focus without user intent

**Evidence:** The desktop chat appeared over content automatically. `ChatWidget.tsx` sets open after 3.5 seconds and focuses its input. Launcher copy `Advertise?` and accessible name `Open CityBeat chat` describe different intents.

**Recommendation / acceptance:** Make opening user-initiated; use a nonblocking teaser if needed. Do not steal focus. Give the launcher a consistent label and verify close, keyboard focus return and mobile overlap.

### F12 — P2: Footer Directory leads to a sales section instead of directory search

**Evidence:** Footer Directory points to `/en#directory`, whose homepage section is Local Commerce advertising products, not the business search page. The footer's `Writers & Editors` account label also does not help a business owner identify their login.

**Source:** `components/citybeat/SiteFooter.tsx` around line 32; homepage section around line 213.

**Recommendation / acceptance:** Link Directory directly to the localized directory route. Expose a clearly named Business Owner Login/Manage Listing path. Test footer destinations in both languages.

### F13 — P2: Generic copy and imported formatting weaken business credibility

**Evidence:** Super H's fallback card copy mentions a menu and a generic local-favorite story. Basic addresses show a stray private-use map glyph (sample: 787 Coffee). Spanish Super H retains English `Save for Later`, `Contact Details`, `Closed` and an English category within Spanish fallback prose.

**Source:** `DirectoryPageClient.tsx` fallback around line 495; `DirectoryDetailClient.tsx` fallback and labels.

**Recommendation / acceptance:** Prefer neutral category-appropriate factual descriptions, sanitize import artifacts, and localize complete journeys rather than only headings. Review automotive, restaurant and professional-service examples in both languages.

### F14 — P2: The external pixel measures traffic but does not establish CityBeat attribution

**Evidence:** `app/pixel.js/route.ts` sends listing ID, key and event for external page views. `api/track/pixel/route.ts` validates origin/domain and aggregates external views/conversions, but does not establish a CityBeat referral or attributable revenue. Owner installation, domain configuration and last-signal tools exist in source.

**Impact:** Pixel collection must not be presented as proof that CityBeat generated every visit, conversion or dollar.

**Recommendation / acceptance:** Separate all-site pixel activity from CityBeat-attributed activity. Use clearly defined referral/UTM attribution with a privacy-reviewed implementation; label manually emitted conversion events precisely. Do not promise a Facebook-equivalent attribution platform. Installation and real-site events remain untested here.

### F15 — P2: Lead confirmation promises a business response that the system cannot guarantee

**Evidence:** `QuoteForm.tsx` says `The business will get back to you.` The quote route tolerates notification email failures and can still return success. This is not proof of a current delivery outage; it is a copy/observability mismatch.

**Recommendation / acceptance:** Say the request was recorded, explain that a reply is not guaranteed, and provide Call Now as an alternative. Separate saved, notification-sent and delivery-failed states operationally. Test these outcomes with a non-production fixture, not a real customer lead.

## Features and value: what is genuinely promising

| Capability | Evidence level | Value and qualification |
| --- | --- | --- |
| Premium contact panel / Call Now / maps / hours | Live public | Strong high-intent utility; mobile contact appears before long descriptive content |
| Explicit free versus paid comparison and recurring pricing | Live public | Helpful transparency; relocate the comparison out of shopper results and free-claim onboarding |
| Founders name search and claim/login/signup continuity | Live public to authentication boundary | Good starting flow; separate paid selection from free ownership verification |
| Services, products, offers, posts, special hours, action links | Owner source inspected | Useful differentiation; authenticated save/publish not verified |
| QR/social assets, profile completeness and lead pipeline | Owner source inspected | Practical tools without needing a new product category; value depends on valid public destinations |
| Monthly reports and analytics CSV | Source inspected | Strong retention mechanism after metric consistency and delivery checks |
| Google Business connection | Source inspected only | Reviewed import workflow exists; not proof of automatic bidirectional sync or successful live OAuth |
| Pixel setup and last-signal feedback | Source inspected only | Useful installation visibility, not proof of acquisition attribution |

Additional positives: mobile menu and name search worked; premium pricing includes no-guaranteed-ranking/customer language; empty quote/contact requirements and checkout email validation behaved as expected in sampled checks; the audit cart was cleared. A verified-owner signal is conditioned on approval in source rather than simply payment.

## Customer value perception

For a shopper, value is speed and confidence: find the business, know whether it is relevant/open, then call or navigate. Current card routing and result placement obstruct that value.

For a free owner, value is control and trust: claim without a payment surprise, correct facts, and see a useful public profile. A credible free experience is the demonstration of the paid service, not merely an upsell surface.

For a Premium owner, $19.99/month is easier to justify with attributable customer actions and a polished, maintained profile than with a long feature list. Report phone clicks, website clicks, directions and recorded leads separately. Never equate actions with unique people, completed calls, sales or guaranteed ROI.

For advertisers, dated audience evidence, clear placement examples and a predictable purchase/support path matter more than an unsupported large reach number. The sample dashboard's illustrative status should be highly visible, not dependent on tiny muted text.

Recommended positioning: a managed local presence with useful discovery, direct customer actions and transparent performance reporting. Avoid promising guaranteed rankings, automatic Google synchronization, or attributable revenue until those outcomes are proven.

## Remediation sequence and acceptance gates

1. **Restore core journeys:** F01, F03, F04, F05, F06. Test both tiers/languages, date rollover, free claim and review return paths.
2. **Make discovery fast:** F02, F09, F12. Put results next to search, support the complete corpus and correct navigation.
3. **Make the paid value defensible:** F07, F08, F14, F15. Reconcile metric fixtures across surfaces, substantiate reach, distinguish attribution and delivery states.
4. **Polish presentation:** F10, F11, F13. Responsive/zoom checks, nonintrusive chat, category-aware copy and complete localization.
5. **Authorized end-to-end verification before release:** test account claim/edit/publish, review/reply, sandbox checkout and entitlement update, owner report generation, and configured Google connection. Do not charge a real customer or send a real report just to exercise these flows.

This is a prioritized remediation recommendation, not authorization to implement, deploy or incur costs. Many fixes reuse existing code and services; no promise of zero incremental hosting usage is made.

## Outstanding operational verification

The preceding site re-audit recorded missing Cloudflare reporting credentials and denied Google Analytics reporting access, plus development-only dependency advisories. This audit did not reconfigure or newly authenticate those services. Refer to `docs/audits/citybeat-site-reaudit-2026-10-19.md`; do not mark provider reporting healthy merely because tracking code is present. Stripe balances, payment links, bank destinations and commission schedules were outside this read-only customer-experience audit.

Accessibility follow-up should use [WCAG 2.2](https://www.w3.org/TR/WCAG22/) for reflow, focus behavior, target size and contrast. Small/muted text is a review concern here, not a measured contrast failure. A proper follow-up needs keyboard and assistive-technology testing plus actual color/size measurements.
