-- Backstop audit fixes for directory reviews and Stripe refund matching.

-- Keep the newest review when historical duplicates exist, then enforce one
-- review per signed-in user per listing so review points and aggregates cannot
-- be inflated by repeat submissions.
delete from public.directory_reviews older
using public.directory_reviews newer
where older.user_id is not null
  and newer.user_id is not null
  and older.listing_id = newer.listing_id
  and older.user_id = newer.user_id
  and (
    older.created_at < newer.created_at
    or (older.created_at = newer.created_at and older.id < newer.id)
  );

create unique index if not exists idx_directory_reviews_listing_user_unique
  on public.directory_reviews(listing_id, user_id)
  where user_id is not null;

-- Store exact Stripe identifiers on ad purchases so refunds are matched to the
-- originating Stripe event instead of a non-unique amount.
alter table public.ad_purchases
  add column if not exists stripe_charge_id text,
  add column if not exists stripe_payment_intent_id text;

create unique index if not exists idx_ad_purchases_stripe_charge_id
  on public.ad_purchases(stripe_charge_id)
  where stripe_charge_id is not null;

create index if not exists idx_ad_purchases_stripe_payment_intent_id
  on public.ad_purchases(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;
