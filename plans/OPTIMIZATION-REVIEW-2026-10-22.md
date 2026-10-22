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

### 1.1 CORRECTED — this section was wrong

**What I originally wrote here was a measurement error, and the recommendation
that followed from it would have done nothing.** Leaving the original in place
would be worse than deleting it, so here is what is actually true.

**The home page is not slow.** I measured 1.104s TTFB and compared it to
`/premium` at 0.202s, concluding that caching would give a 5x speedup. But
`minScale = 0` on the Cloud Run service, so the first request after an idle
period pays container startup. Four consecutive warm requests to `/en`:

```
0.328s   0.230s   0.237s   0.431s
```

The home page renders in roughly a quarter of a second. I compared a cold start
against a warm hit and called the difference a caching problem.

**And the pages cannot be cached anyway.** `apps/web/src/app/[locale]/layout.tsx`
reads a per-request CSP nonce — `(await headers()).get('x-nonce')`, minted fresh
per request by `middleware.ts`. In Next 14 a dynamic API in a layout renders the
entire route tree dynamically, so `export const revalidate = 60` on any child
page is inert. Middleware also sets `Cache-Control: private, no-store` on every
HTML response (verified live), so nothing caches at Fastly either. Adding
`revalidate` to 18 pages would have changed nothing measurable, and the
"fix" that makes it take effect — removing the nonce read — would serve one
visitor's single-use nonce to another. Under `strict-dynamic` that means **no
script executes at all**: the page paints and never hydrates, taking the cart,
the header's auth state, and the client-side analytics with it.

Both the layout and `lib/articles.ts` already document this. The layout says
*"Nonce-bearing HTML must be rendered per request... Public database reads use
explicit unstable_cache independently of this HTML."* That is exactly the right
architecture, and it is already implemented: articles are cached per process on a
3-minute TTL with the read-cost arithmetic written out beside it, the SEO
category combinations sit behind `unstable_cache` at 1 hour, and the sitemaps at
1 hour. The data layer is cached. The HTML is deliberately not.

**So the real finding is the opposite of what I wrote:** the rendering and
caching architecture is in good shape and was reasoned about carefully by whoever
built it.

**And the cold-start fix is not worth buying either — second amendment.** I
first wrote that cold starts were "the one genuine latency issue" and pointed at
`--min-instances=1`. Then I measured how often the service is actually cold.

Cloud Monitoring, `run.googleapis.com/container/instance_count`, last 7 days
(194 hourly samples):

| state | mean | max | hours at zero |
|---|---|---|---|
| active | 1.059 | 4.00 | **4 of 194** |
| idle | 0.649 | 2.22 | 28 of 194 |

**An active instance is already running in 190 of 194 hours — 97.9%.** The 22
cron jobs plus real traffic keep it warm nearly continuously. The only gap is the
quiet overnight window, which is precisely when I happened to take the 1.104s
reading.

Cost, for completeness, at 1 vCPU / 2 GiB and the idle rate, after the monthly
free tier (240,000 vCPU-s, 450,000 GiB-s):

```
vCPU   2,628,000 s/mo → 2,388,000 billable → $5.97
memory 5,256,000 s/mo → 4,806,000 billable → $12.02
                                    ceiling  $17.98 / month
```

`--min-instances=1` only bills during hours the service would otherwise sit at
zero, so at a 2.1% duty cycle the marginal cost is roughly **$0.37/month**. That
sounds like an easy yes until you see what it buys: it removes a ~0.9s delay for
the handful of visitors who arrive during ~2% of hours, overnight. It is cheap
because it is very nearly redundant.

So: **do not do this.** Not on cost grounds — on the grounds that it fixes
almost nothing. If you ever want it anyway, it is one reversible flag and the
true figure appears on the next bill.

Two caveats, since this is money. Published sources disagree on how idle
minimum-instance time is billed (one gives the $0.0000025 per vCPU-s and per
GiB-s rate used above, another says the default mode bills memory only), and
Google's own pricing page appeared to be well over a year stale when checked. The
ceiling above is the conservative reading.

### 1.2 `/stories` ships 276 KB — but not for the reason I assumed

I guessed full article bodies were being serialized into the list. Measured: no
long prose runs in the HTML, no `content_es`, and 61 distinct story links at
~4.5 KB each. Half the weight (140 KB) is Next's RSC flight payload, which is the
framework duplicating card data for hydration.

So it is not over-fetching — it is **61 cards on one page**, from an explicit
`limit: 60`. Cutting it to 20 with a "load more" would take the page from 276 KB
to roughly 90 KB on a market that is mostly on mobile data. That is a product
decision about how much of the archive belongs on first paint, not a bug, so I
have not changed it.

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
with traffic, though the data layer is already cached — see §1.1), **Anthropic tokens** (newsroom 4×/day, account manager,
ScrapeFlow extraction, translation fallback), **Resend**, **Cloud Run**. Fixed
infrastructure is modest.

There is no large caching win left to take — §1.1 explains why, and the data
layer is already cached with documented TTLs. The Firestore bill is therefore
close to what this traffic actually requires. If it needs to come down further,
the lever is the 144x/day social drain (§1.3) and the article list TTL, not page
caching.

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
4. **Check MRR and claim-conversion** (§3.3) — it determines whether §2 or §3 is
   the real priority. This is now the only engineering-adjacent question left on
   the list, and it is a question for your dashboards rather than the code.

~~Tell me why the home page is force-dynamic~~ — answered: the per-request CSP
nonce, documented in the layout itself. Nothing to change.

~~Decide whether to pay for `--min-instances=1`~~ — answered by measurement: an
instance is already warm 97.9% of hours, so it would cost about $0.37/month and
buy almost nothing. Don't. See §1.1.

---

## What I would do next, if you want one thing

Set `RESEND_WEBHOOK_SECRET`, then switch ghost-reports to weekly, then turn on
`auto_approve_claims`. That sequence costs nothing, needs no code, takes the
claim-outreach cycle from 23 years to about 5, and removes the human step between
a customer paying and getting what they paid for.

I originally closed this by saying the software work in §1 was real and worth
doing next. Measured properly, that was wrong twice over. The rendering
architecture is already sound and the data layer is already cached, so the
headline finding was a cold start I mistook for a caching problem — and when I
then recommended buying away the cold start, the instance metrics showed the
service is already warm 97.9% of the time, so that would have bought almost
nothing either.

Which makes the conclusion simpler, not weaker: **there is no meaningful software
performance work outstanding, and nothing worth spending on to get more.** Both
of this section's recommendations were retracted after measurement, which is the
right outcome — the alternative was a week of work and a monthly bill for no
change a reader would notice.

The constraint on this business is the funnel: 8,000 listings, ~7 in 8
unclaimed, and the tactic that addresses it running on a 23-year cycle. Not the
margin, and not the code.
