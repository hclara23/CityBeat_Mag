# CityBeat optimization review — 2026-10-22

Measured against production (`citybeat-web-00353-bil`) and the code at `d35e7c6`.
Every number below is something I observed, not an estimate, unless it says otherwise.

**What I could not measure, and why it matters:** there is no service-account
credential on this machine and ADC points at an unrelated project, so I could not
read Firestore directly — no revenue figures, no claim-conversion counts, no
Stripe data. The directory numbers come from the public API; the rest comes from
the code and from live HTTP. Anything marked *(unverified)* needs your eyes on a
dashboard before you act on it.

---

## The one number

**8,000 listings. In a 24-listing public sample, 21 were unclaimed and only 4 had
a photo.**

If that sample holds, roughly 7 in 8 listings have no owner and 5 in 6 have no
image. That single fact is simultaneously the software problem, the purpose
problem, and the revenue problem:

- As a **community resource**, a directory where most entries are an
  auto-imported name and phone number with no photo and no owner-maintained hours
  is thin. It is a phone book, not a resource.
- As **SEO**, 8,000 thin pages is the shape search engines discount. Volume
  without substance works against the domain rather than for it.
- As **revenue**, every dollar depends on unclaimed → claimed → paid. 8,000
  unclaimed listings is not inventory, it is 8,000 unfinished conversions.

Everything below is ordered by how much it moves that number or protects it.

---

## 1. Software performance

### 1.1 The most-visited pages opt out of caching — and they are the slowest

18 pages declare `export const dynamic = 'force-dynamic'`, against 8 using ISR.
The dynamic set includes the home page, `/stories`, `/directory`, `/events`,
`/jobs`, `/deals` and `/best` — the entire public surface.

Measured, live:

| Route | TTFB | HTML |
|---|---|---|
| `/en` (force-dynamic) | **1.104s** | 85 KB |
| `/en/stories` (force-dynamic) | 0.749s | **276 KB** |
| `/en/events` (force-dynamic) | 0.499s | 175 KB |
| `/en/directory` (force-dynamic) | 0.355s | 100 KB |
| `/en/premium` (cached) | **0.202s** | 57 KB |

The cached page is **5× faster to first byte** than the home page. That is the
whole argument. `force-dynamic` means every single visit re-renders on the server
and re-reads Firestore — and Firestore reads are this project's only variable
cost, so the slowest pages are also the ones metering a bill.

**What I would do:** replace `force-dynamic` with `revalidate = 60` on the public
content pages. A minute of staleness is invisible on a local news site, and it
collapses a thousand visits into one render. I did **not** do this unilaterally —
the home page's dynamic rendering was a deliberate past decision, and reversing a
deliberate decision without knowing why it was made is how you reintroduce the
bug it fixed. Tell me the reason and I will either work around it or implement
the change.

**Effort:** S per page. **Impact:** large and compounding, on both latency and cost.

### 1.2 `/stories` ships 276 KB of HTML

That is 3× the home page and ~5× `/premium`, for what is structurally a list of
links. It strongly suggests full article bodies are being serialized into the
list payload. On a phone on El Paso mobile data — which is most of this audience
— that is the difference between a page that feels instant and one that does not.
**Worth a look before anything else on this list, because it is probably a
one-line fix** (select fewer fields, or stop passing full content to the client
component).

### 1.3 The social cron runs 144 times a day

`citybeat-social` was changed in the console from `0 11 * * *` to `*/10 * * * *`.
That is deliberate — `queue=1` drains the image queue and steps aside during the
11:00 article slot — but the cost profile deserves a sanity check: each drain can
read up to ~850 documents in the worst case (a 400-doc `scheduled` query, a
400-doc `queued` query, 50 stale, plus control). Idle drains are cheap (a query
matching nothing bills one read), so **this is only expensive when the queue is
deep** *(unverified — I could not read the queue)*. If the queue is routinely
deep, drop the cadence to every 30 minutes; the image queue is not latency-critical.

### 1.4 Fixed this session

`citybeat-directory-ingest` had failed **every attempt for a week** and produced
zero new inventory. Worst case was 1,932 seconds of fetching inside a 300-second
request, and because the Firestore write ran only after *all* fetching, overruns
discarded every category that had succeeded. Now budgeted, rotating, and it
writes what it gets. Full details in `e589790`.

---

## 2. Purpose — resource directory and magazine

### 2.1 The directory's problem is depth, not breadth

8,000 listings is plenty. The gap is that most carry no photo, no owner, and no
owner-maintained detail. Three levers, in order of leverage:

1. **Photos on unclaimed listings.** 4 of 24 had an image. A listing with a photo
   converts better, ranks better, and is more useful to a resident — and the
   single biggest visible difference between Basic and Premium is the gallery, so
   a photo-less free listing is also the weakest possible upgrade pitch.
   *A category-level stock or streetview-free placeholder is not the answer* —
   it degrades trust. Owner-supplied photos are the point, which routes back to
   claims.
2. **The claim funnel is the product.** Five claim-growth tactics exist in code
   (ghost reports, event relay with first-lead-free, the live-stats claim banner,
   drip mirror arms, press pins). The one that directly tells an owner "here is
   what your free listing did" — `citybeat-ghost-reports` — runs **monthly**, and
   is capped at 25 per run. That is ≤300 touches a year against 7,000 unclaimed
   listings: a **23-year** cycle. That is the single most under-powered thing in
   the system relative to its importance.
3. **Consolidation.** Multi-location consolidation exists (`directory-consolidate`).
   Duplicate-looking inventory hurts both trust and SEO; worth confirming it has
   been run recently across the 8,000.

### 2.2 The magazine

The autonomous newsroom works (RSS → Claude → bilingual brief → review queue) and
runs 4×/day. The constraint is not production, it is that **every article waits
for a human** unless `newsroom_auto_publish` is on. See §4.

---

## 3. Profitability

### 3.1 The revenue model is sound; the funnel is the bottleneck

Pricing is coherent and the ladder is real: Basic free → Founding $9.99/mo or
$99/yr → Premium $19.99/mo or $199/yr → Featured $49/mo → Sponsored $99/mo, plus
one-time story/event/job products. Commission accrues, holds 7 days, pays on the
15th and the final calendar day, and claws back correctly on refund. That
machinery is in good shape and well tested.

The problem is upstream of it. With ~7,000 unclaimed listings and a claim-driver
reaching 300/year, revenue is gated by outreach volume, not by pricing or
product.

### 3.2 Cost structure

Variable costs, in rough order: **Firestore reads** (the only one that scales
with traffic — see §1.1), **Anthropic tokens** (newsroom 4×/day, account manager,
ScrapeFlow extraction, translation fallback), **Resend**, **Cloud Run**. Fixed
infrastructure is modest.

The highest-leverage cost action is §1.1, because it reduces the one cost that
grows with success.

### 3.3 A gap worth closing *(unverified)*

`/api/health/payments` confirms the platform can take money right now. What I
could not check is whether anyone is: no Stripe read access from here. **Before
optimizing anything else, look at actual MRR and claim-conversion rate** — if the
conversion rate from claimed → paid is healthy and the problem really is
outreach volume, then §2.1.2 is the only thing on this page that matters.

---

## 4. Autonomy — the switches already exist

This is the most actionable finding in the review, and it needs no code.

Two settings already exist in `/api/admin/platform-settings`:

- **`auto_approve_claims`** — the Stripe webhook approves a paid claim
  automatically when it is set, *and* ownership was verified, *and* the sale was
  not rep-sold (`webhook/route.ts:680`). Those guards are exactly right: a
  verified self-serve buyer is approved instantly; a rep-sold deal still gets a
  human.
- **`newsroom_auto_publish`** — publishes generated briefs straight to the site
  instead of the review queue.

**Why `auto_approve_claims` matters more than it looks:** today a business pays,
and then waits in `pending_approval` for a person. The card is already charged.
`citybeat-claims-aging` exists *specifically* to page someone when that wait
exceeds 48 hours — which tells you this has hurt before. Every hour in that queue
is a paying customer who has given you money and received nothing, which is the
highest-risk moment in the entire funnel for a refund or a chargeback.

**Recommendation:** turn `auto_approve_claims` on. The safety guards are already
in the code, it removes the one manual step that sits between payment and
delivery, and it is reversible with one toggle. *(I could not read whether it is
currently on — check `/admin/payouts`.)*

`newsroom_auto_publish` is a different call: it trades editorial control for
volume, and the review queue is the editor's actual job. I would leave that one
off and instead reduce review *friction*, not review itself.

### What genuinely still needs a human

| Step | Can it be automated? |
|---|---|
| Paid claim approval | **Yes, today** — `auto_approve_claims`, already guarded |
| Article review | Should stay human (it is the editorial product) |
| Sponsored story / custom quote fulfillment | No — it is bespoke deliverable work |
| Refund decisions | No, and should not be |
| Newsletter sponsor collisions | Guarded; pages ops to resolve |

---

## 5. Blocked on you

These are the things I could not do, in priority order:

1. **`RESEND_WEBHOOK_SECRET` is unset.** `/api/webhooks/resend` returns 503 for
   every bounce and spam complaint, so dead addresses are never suppressed and
   get mailed again. **This blocks increasing the ghost-reports cadence** (§2.1.2)
   — and that cadence increase is the highest-value growth action available. I
   have put an interlock in code so cold volume cannot scale while this is broken
   (`d35e7c6`); it lifts by itself once the secret is set. **Do this one first.**
2. **Decide the `citybeat-ghost-reports` cadence.** Its cron is `0 10 5 * *`
   (monthly, the 5th) — one transposition from `0 10 * * 5` (Fridays), which is
   what the report's own "this week" copy implies. Weekly takes the annual reach
   from ~300 to ~1,300 and changes nothing per recipient (still one per listing
   per quarter). Command, once the secret above is set:
   ```bash
   gcloud scheduler jobs update http citybeat-ghost-reports --location us-central1 --project kerstenblueprint --schedule "0 10 * * 5"
   ```
3. **Turn on `auto_approve_claims`** (§4), at `/admin/payouts`.
4. **Tell me why the home page is `force-dynamic`** so §1.1 can proceed safely.
5. **Check MRR and claim-conversion** (§3.3) — it determines whether §2 or §3 is
   the real priority.

---

## What I would do next, if you want one thing

Set `RESEND_WEBHOOK_SECRET`, then switch ghost-reports to weekly, then turn on
`auto_approve_claims`. That sequence costs nothing, needs no code, takes the
claim-outreach cycle from 23 years to about 5, and removes the human step between
a customer paying and getting what they paid for.

The software work in §1 is real and I would do it next — but it makes a
functioning business cheaper, and right now the funnel matters more than the
margin.
