# CityBeat MVP – Definition of Done & Scope

## DoD Checklist (14 items)

### Public Features
- [ ] **Home page** displays latest 6–10 published articles with title, excerpt, cover image, author, category
- [ ] **Home page** includes one hardcoded or API-driven ad slot (hero banner, leaderboard, or half-page)
- [ ] **Category page** shows published articles filtered by category + one category-specific banner ad slot
- [ ] **Article page** renders full article content in EN or ES, with bilingual toggle
- [ ] **Article page** displays inline ad slot (e.g., mid-article or sidebar) when active campaigns exist
- [ ] **Article page** shows sponsor disclosure if `is_sponsored=true`
- [ ] **Bilingual content**: each article has EN + ES versions; UI toggle switches locale without page reload

### Admin Portal
- [ ] **Supabase Auth login** required; UI redirects unauthenticated users
- [ ] **Admin/Editor dashboard** allows create/edit article with:
  - EN + ES title, excerpt, content fields
  - Category picker
  - Cover image upload to Supabase Storage
  - Publish toggle (sets `published_at`)
- [ ] **Role system** enforces: `admin` (full write), `editor` (articles only), `advertiser` (portal only)

### Monetization
- [ ] **Advertiser portal** (authenticated): create banner campaign with:
  - Placement picker (home hero, category banner, article sidebar)
  - Date window (start_at, end_at)
  - Creative upload (image to Supabase Storage)
  - Destination URL
  - Stripe Checkout button
- [ ] **Stripe webhook** endpoint (`stripe-webhook` Edge Function) processes `payment_intent.succeeded`, activates campaign
- [ ] **Ad rendering** on public pages picks active creative based on placement, date window, and status
- [ ] **Ad click tracking** via Edge Function redirect (e.g., `/api/ad-click?campaign_id=X`) logs event, redirects to destination
- [ ] **Cron job** (`activate-campaigns`) runs daily, auto-transitions campaigns from `pending` to `active` on start_at

### Deployment
- [ ] **Vercel deploy** succeeds; `pnpm build` passes with zero errors
- [ ] **Supabase migrations** applied; RLS enabled on all tables
- [ ] **Edge Functions** deployed (4 functions, all passing tests)
- [ ] **README** lists all required env vars and exact deploy commands

---

## Explicitly NOT in MVP

- Comments or discussion features
- Automated news ingestion / RSS feeds
- Newsletter system or email campaigns
- Advanced analytics dashboards
- Multi-user advertiser teams or seat management
- Paid membership tiers or paywall
- Complex animation framework (CSS keyframes only; no gsap or complex libraries)
- SEO plugins or sitemap generation
- Search feature
- Social sharing widgets
- Mobile-specific app (responsive web only)

---

## Scope Boundaries

1. **Single backend**: Supabase only (no external CMS, no separate admin server)
2. **One locale toggle**: EN/ES simple binary choice in UI
3. **Four placements**: 1 home hero, 1 category banner, 1 article sidebar (inline), 1 article bottom (optional; if only 3, remove one)
4. **One payment flow**: Stripe Checkout (no subscriptions, no invoice system at MVP)
5. **Minimal frontend**: Next.js App Router, no complex state machine beyond React Context if needed

---

## Stop Rules for Codex

1. **Do NOT add features** beyond the 14 DoD items.
2. **Do NOT introduce API routes** except `/api/revalidate` for ISR tag revalidation.
3. **Do NOT use external authentication** (Auth0, Clerk, etc.); Supabase Auth only.
4. **Do NOT implement search, comments, or membership** until Phase 2.
5. **Do NOT commit to animations** beyond CSS Tailwind utilities and simple scroll effects (no React Spring, Framer Motion, or GSAP at MVP).
6. **Do NOT create separate admin database** or mirror schema; use RLS on single schema.
7. **Do NOT skip RLS**: all policies must be enforced at DB layer, not just app logic.