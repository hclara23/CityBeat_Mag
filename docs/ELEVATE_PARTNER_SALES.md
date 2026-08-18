# Elevate partner sales

## Contract

Elevate El Paso representatives sell CityBeat products from Elevate's Sales
Desk. CityBeat remains the source of truth for the catalogue, prices, hosted
checkout, orders, directory records, and fulfillment. The integration is
server-to-server; representatives do not need a second CityBeat account.

`POST /api/sales/partner` accepts a timestamped HMAC-signed JSON request with
one of two actions:

- `products` returns the complete partner-safe projection of CityBeat's
  canonical Sales Desk catalogue.
- `checkout` validates the product and customer, writes CityBeat records, and
  returns either a hosted checkout or a free listing handoff.

Set `ELEVATE_PARTNER_SECRET` to the same high-entropy value stored by Elevate
as `CITYBEAT_PARTNER_SECRET`. The secret is server-only. Never give it a
`NEXT_PUBLIC_` prefix, include it in client JavaScript, or reuse a Stripe
webhook secret.

## Catalogue coverage

The response is projected from `apps/web/src/lib/sales-products.ts`, not a
second price table. It includes all 12 sellable products:

- Directory Basic Free
- Directory Founding Annual — $99/year
- Directory Founding Monthly — $9.99/month
- Directory Premium Annual — $199/year
- Directory Premium Monthly — $19.99/month
- Directory Featured — $49/month
- Newsletter Sponsorship — $50/month
- Sponsored Story — $30 once
- Category Banner — $25/month
- Featured Event — $25 once
- 30-Day Job Posting — $50 once
- Custom One-Time Quote — approved amount and written scope

Fixed catalogue products always use CityBeat's price and quantity one. Custom
One-Time Quote is the only product for which Elevate supplies an amount; it is
validated between $1 and $100,000 and requires a description.

## Security and ownership boundaries

Signed requests expire, signatures are compared safely, and rejection details
are logged without being returned to the caller. Partner sales cannot bypass
directory ownership verification, merge into an existing listing, or create a
CityBeat payout attribution. Elevate owns compensation for its representatives.

A directory sale requires a truthful category. Basic Free creates an
unverified listing and returns its handoff URL with `checkoutRequired: false`.
Paid products return CityBeat's Stripe Checkout URL with
`checkoutRequired: true`. The partner never receives or handles card data.

## Deployment and smoke test

1. Deploy this endpoint before enabling CityBeat inside Elevate.
2. Set `ELEVATE_PARTNER_SECRET` on the CityBeat production service.
3. Set the matching secret and `CITYBEAT_API_URL=https://citybeatmag.co` on
   Elevate.
4. Confirm a signed `products` call returns 12 records in canonical order.
5. Create a Basic Free test listing; confirm no Stripe session is created and
   the handoff URL opens the new CityBeat listing.
6. Create an approved low-cost paid test order; confirm hosted checkout, the
   order record, webhook completion, and fulfillment state.
7. Confirm directory checkout without a category is rejected.
8. Confirm altered fixed prices, verification bypass, and listing merge
   requests are rejected.

Rollback by disabling the CityBeat integration in Elevate or removing its
partner secret. CityBeat's first-party Sales Desk remains independent.
