# CityBeat Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Next.js App (Vercel)                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Pages: /home, /category/[slug], /article/[slug]          │ │
│  │  Admin: /admin/dashboard, /admin/articles                 │ │
│  │  Advertiser: /campaigns, /create-campaign                 │ │
│  │  Public: /ad-click (Edge Function redirect)               │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                           ↓ ↑
            Supabase Client (with RLS)
                           ↓ ↑
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase Backend                              │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │ PostgreSQL DB  │  │ Auth (JWT)    │  │ Storage (images)    │ │
│  │ (RLS enabled)  │  │ (Profiles)    │  │ (articles, creatives)││
│  └────────────────┘  └──────────────┘  └─────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Edge Functions (Deno):                                     │ │
│  │  • create-checkout-session → Stripe API                   │ │
│  │  • stripe-webhook → parse → activate campaign             │ │
│  │  • ad-click → log event → redirect                        │ │
│  │  • activate-campaigns (cron) → status transitions         │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                           ↓ ↑
                      Stripe API
```

## Data Flow

### Public Reader Flow
1. Browser requests `/article/[slug]`
2. Next.js calls `supabase.from('articles').select(...)` with RLS filter (published_at ≤ now)
3. Joins `article_translations`, `categories`, `sponsors`
4. Fetches active `ad_campaigns` for placement + date window
5. Renders article + ads (no personal data exposed)

### Admin/Editor Flow
1. Authenticated user logs in via Supabase Auth
2. Dashboard fetches user profile + role from `profiles` table
3. Editor creates article: `supabase.from('articles').insert({...})`
4. Inserts EN + ES rows in `article_translations`
5. Uploads cover image to `/storage/articles/{id}/cover.png`
6. Publishes by setting `published_at` and saving

### Advertiser Flow
1. Authenticated advertiser logs in
2. Views existing campaigns (filtered by `created_by`)
3. Creates campaign form:
   - Select placement, date window
   - Upload creative image → Storage
   - Enter destination URL
4. Clicks "Checkout with Stripe"
5. `create-checkout-session` Edge Function calls Stripe API, returns session URL
6. Redirects to Stripe Checkout
7. On success, Stripe sends webhook to `stripe-webhook` Edge Function
8. Function parses signature, finds campaign by `stripe_session_id`, sets `status='active'`
9. Campaign renders on next page load

### Ad Click Flow
1. Ad creative link: `href="/api/ad-click?campaign_id={id}&placement={key}"`
2. Route handler calls `ad-click` Edge Function
3. Function inserts row in `ad_events` (type='click')
4. Returns redirect to campaign's `destination_url`

## Near-Zero API Routes

- **Only** `/api/revalidate` exists (for ISR tag revalidation if using Next.js revalidateTag)
- **All CRUD** goes through Supabase client (Auth + RLS)
- **All external calls** (Stripe, webhooks) use Edge Functions (not Next API routes)
- **No backend session storage** needed (Supabase Auth handles JWT)

## Caching Strategy

| Page | Revalidation |
|------|--------------|
| `/home` | ISR: 3600s (articles list), revalidate on publish |
| `/category/[slug]` | ISR: 3600s, revalidate on publish in category |
| `/article/[slug]` | ISR: 86400s (1 day), revalidate on article edit |
| Admin pages | No cache (always fresh) |

- **Impressions**: do NOT cache ad slots (always fetch fresh to get active campaigns)
- Use `revalidatePath()` or `revalidateTag()` in publish/edit handlers

## Security & RLS

- All Supabase queries use authenticated client (Supabase RLS layer enforces permissions)
- Edge Functions use service role (bypass RLS) only for webhook and cron (verified via signature or scheduled token)
- Ad-click endpoint allows anonymous requests but ties clicks to campaign_id (safe; no personal data leaked)