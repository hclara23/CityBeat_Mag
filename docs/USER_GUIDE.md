# CityBeat User Guide — Every Role

A practical guide to [citybeatmag.co](https://citybeatmag.co) for each kind of user.
All pages exist in English (`/en/...`) and Spanish (`/es/...`); links below use `/en/`.

Roles are cumulative: Developer ⊃ Editor/Admin ⊃ (Writer, Sales) ⊃ Business Owner ⊃ Reader.
Roles are granted in **Developer Control → role management** (developers can grant any
role; editors can grant writer/sales/contributor but never admin/developer).

---

## 1. Reader / Visitor (no account needed)

What you can do:

- **Read stories** — [/en/stories](https://citybeatmag.co/en/stories), by topic at `/en/topics/{category}`. New briefs are auto-ingested 5×/day and published after editor review.
- **Ask CityBeat** — the chat bubble on any page. A bilingual concierge that answers "best tacos near me?", "¿quién repara aires acondicionados?", "what's happening this weekend?" with real local businesses, events, and deals. Recommendations link straight to the business page.
- **Browse the directory** — [/en/directory](https://citybeatmag.co/en/directory), business detail pages with photos, hours, reviews, and deals. "Best of" SEO guides at `/en/best`.
- **Events** — [/en/events](https://citybeatmag.co/en/events) (real Ticketmaster + community events, nightly refresh). Submit your own at `/en/events/submit` (goes to editor review).
- **Deals** — [/en/deals](https://citybeatmag.co/en/deals), coupons posted by paying businesses.
- **Jobs** — [/en/jobs](https://citybeatmag.co/en/jobs).
- **Request a quote** — every directory page has a contact form; your request goes to the business.
- **Newsletter** — subscribe on the homepage; weekly digest lands Fridays.

With a free account (`/en/signup` — email verification required): leave **reviews** (with photos), **bookmark** stories (`/en/account/saved`), and manage your profile at `/en/account` (2FA available under `/en/account/security`).

---

## 2. Business Owner (claim a listing → `advertiser`)

Your business is probably already listed — the directory is seeded automatically from public data.

**Claiming (free):**
1. Find your business at `/en/directory` → open it → **Claim**.
2. A 6-digit code is emailed to the business's on-record address (15-min expiry, 5 attempts). This proves you control the business — codes are never sent to addresses you type in.
3. Enter the code → your claim goes to admin review (usually same-day).

**Your dashboard — `/en/dashboard`:**
- **Customer leads** — people who asked to be contacted through your listing. Premium unlocks full contact details instantly; on the free tier you'll see leads exist but masked.
- **AI marketing assistant** (Premium+) — every week it drafts a deal, 3 social captions, and replies to your unanswered reviews. Nothing publishes until you click approve.
- **Boost your listings** — upgrade tiers; **My deals** — post/remove coupons (Premium+).

**Tiers** (per location for multi-location brands):
| Tier | Price | Gets you |
|---|---|---|
| Basic (free) | $0 | listed, reviews, masked leads |
| Premium | $19/mo (Founding-100 promo while it lasts; annual available) | instant full leads, photos, hours, social links, deals, AI assistant, priority placement, AI-concierge partner placement |
| Featured | $49/mo | all of Premium + top-of-category, homepage rotation, featured badge |

**Billing** — `/en/billing` (self-serve card updates via Stripe portal). Failed renewals email you a pay link automatically. **Monthly report** — an email on the 1st with your views, leads, and reviews.

---

## 3. Contributor

Submit story ideas/tips at [/en/contribute](https://citybeatmag.co/en/contribute) — they land with editors. No dashboard beyond that; prolific contributors get upgraded to Writer.

## 4. Writer / Creator (`writer`)

- **`/en/creator`** — your articles. **New** (`/creator/new`) and **edit** (`/creator/edit/{id}`) with the rich-text editor + image upload (8 MB, auto-optimized).
- You can only edit your own articles. Publishing goes through editor review at admin level.

## 5. Sales Rep (`sales`)

- **`/en/admin/sales/me`** — your pipeline: deals closed, commission earned/pending, leaderboard.
- **`/en/admin/sales/new`** — the field-sales wizard: enter a business + plan (or custom amount) → get a Stripe Checkout link/QR on the spot. The sale is attributed to you for commission; the listing is created and an admin attaches the owner after payment.
- **Commission** — paid automatically via Stripe transfer to your connected bank when the customer pays (one-time or residual per godmode setting). Set up your bank once via the payouts onboarding on your dashboard — it stays linked.
- **`/en/admin/leads`** — inbound quote requests and chat leads to follow up on.

## 6. Editor / Admin (`editor`)

Hub: **`/en/admin`**.

- **Claims queue** (`/admin/claims`) — approve/reject ownership claims. Each row shows a verification badge: **✓ Email verified** (proved control of the business inbox), **⚠ Not verified** (paid but never verified — the UI makes you confirm you checked another way; see [CLAIM_VERIFICATION.md](CLAIM_VERIFICATION.md)), or **Rep sale** (attach the real owner). Verified+paid claims auto-approve; everything else waits for you.
- **Content review** (`/admin/review/{id}`) — approve auto-ingested briefs; **articles** management from the admin hub (all articles, any author).
- **Events** (`/admin/events`) — approve/reject community submissions, feature paid events.
- **Directory** (`/admin/directory`) — edit listings, publish ingested candidates (`publish-all`), moderate **deals**.
- **Leads** (`/admin/leads`) — every captured lead across the site.

## 7. Developer / Godmode (`developer`)

Everything above, plus **`/en/developer`** (Developer Control) and:

- **Payouts** (`/admin/payouts`) — set commission percent + mode (one-time vs residual), issue one-off payouts. Destinations are always the payee's own connected bank.
- **Finance** (`/admin/finance`) — read-only revenue/payout overview.
- **Banners** (`/admin/banners`) — manage `ad_banners` (home, directory, sidebar, **newsletter sponsor slot**).
- **Sales agent** (`/admin/sales`) — monitor the automated outbound engine.
- **Platform settings** — `auto_approve_claims` toggle (currently ON — safe because auto-approval requires ownership verification).
- **Role management** — grant/revoke roles; non-developers can never touch developer accounts.

## 8. The Operator (you)

The machine runs itself; your job is ~15 minutes a week:

- **Monday ops digest** (email) — revenue, funnel, inventory, leads, failures. If something broke, you already got a **failure alert** email (deduped; details in `system_alerts`).
- **Approve** anything waiting: claims queue, brief reviews, event submissions.
- **Wednesday** — AI assistant drafts go to paying owners automatically; **Friday** — newsletter sends itself; **1st of month** — owner ROI reports send themselves.
- Full automation schedule: see the cron table in [CLAUDE.md](../CLAUDE.md). Scheduler control: `gcloud scheduler jobs list/run/pause --location us-central1`.
- Currently dormant (waiting on keys): AI features (`ANTHROPIC_API_KEY`), social auto-posting (Meta tokens).

---

*Reflects the app as of 2026-07-03 (commit `ac684be`). Companion docs: [SECURITY_AUDIT.md](SECURITY_AUDIT.md), [CLAIM_VERIFICATION.md](CLAIM_VERIFICATION.md).*
