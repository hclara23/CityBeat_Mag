# Status Update (Slice 3)

## Completed
- [x] Ads storage bucket documented (`ads`)
- [x] Edge Functions created: create-checkout-session, stripe-webhook, ad-click, activate-campaigns
- [x] Advertiser portal routes implemented
- [x] AdSlot server component renders active campaigns + click tracking
- [x] Stripe test mode checkout flow wired via Edge Function
- [x] README updated for Stripe + functions setup
- [x] pnpm build passes locally

## Commands Run
- `pnpm add framer-motion`
- `pnpm build`

## Supabase Assumptions
- Storage buckets: `articles` and `ads` (public)
- `ad_placements` includes `article_inline`
- Advertiser role assigned in `profiles`

## Notes
- Root `/` redirects to `/en`
- Legacy `/article/[slug]` redirects to `/en/article/[slug]`
- Next.js middleware deprecation warning still present
