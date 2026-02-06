# CityBeat Initialization (citybeatmag.co)

## Scope
Bilingual local magazine (EN/ES) covering El Paso County + Horizon + Socorro + Clint + Las Cruces.
No comments at launch.
Monetization: self-serve Newsletter Sponsor, Sponsored Post, Category Banner.
Automation: 5 brief drops/day (editor-gated).

## Stack
- Frontend: Next.js
- CMS: Sanity Studio (Free includes 20 seats) https://www.sanity.io/pricing
- Edge + Automation: Cloudflare Pages + Workers (Paid min $5/mo) https://developers.cloudflare.com/workers/platform/pricing/
- DB: Supabase Postgres https://supabase.com/pricing
- Payments: Stripe Checkout https://stripe.com/pricing
- Email: Resend https://resend.com/pricing
- Translation: DeepL API https://www.deepl.com/en/pro-api

## Repo layout (suggested)
/
  apps/
    web/                 # Next.js public site
    ads/                 # Advertiser portal (Next.js)
  packages/
    ui/                  # shared components (shadcn/tailwind)
    lib/                 # shared utils (geo, i18n, tracking)
  services/
    worker/              # Cloudflare Worker (cron, webhooks, ad events)
  sanity/                # Sanity studio + schemas
  infra/
    sql/                 # Supabase migrations
    config/              # sources.json, ad_slot_defs.json

## Environment variables
### Web (public)
NEXT_PUBLIC_SITE_URL=https://citybeatmag.co

### Ads portal
NEXT_PUBLIC_ADS_URL=https://ads.citybeatmag.co
STRIPE_PUBLISHABLE_KEY=

### Worker (server-side)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SANITY_PROJECT_ID=
SANITY_DATASET=
SANITY_WRITE_TOKEN=
DEEPL_API_KEY=
RESEND_API_KEY=

## Automation schedule (America/Chihuahua)
07:00, 10:00, 13:00, 16:00, 19:00

## Initial launch checklist
1) Cloudflare: move DNS (full setup), enable SSL
2) Deploy Sanity Studio to studio.citybeatmag.co
3) Deploy web to citybeatmag.co
4) Deploy ads portal to ads.citybeatmag.co
5) Configure Stripe products + webhook to Worker
6) Configure sources.json for brief ingestion
7) Test: create brief -> translation -> Sanity draft -> editor publish
