# Customer action tracking audit — 2026-10-22

## Production evidence

Read-only audit at 12:53 UTC covered the two published, subscription-backed premium/featured listings and their September 23–October 22 UTC statistics. Subscription references alone do not prove payment settlement.

- Listing A: 12 views, zero recorded actions, no saved quote requests; phone and address present, website absent. Public HTML returned 200 with phone, quote and map controls.
- Listing B: 3 views, zero recorded actions, no saved quote requests; phone, address and website present. Public HTML returned 200 with those controls. The approved claimed listing lacks owner_id, which needs verified ownership data before repair and can affect lead delivery and owner-traffic exclusion.
- A bounded sample of the newest 1,000 tracking/quote POST logs in the last 30 days contained 471 tracking responses with status 200 and 529 with status 404. Bodies were unavailable, so these cannot be attributed to the paid listings. A separate quote-route request-log query returned no retained entries.

There is no evidence supporting a historical action backfill. Old tracking responses returned success even after persistence errors, so zero recorded clicks cannot establish that no clicks occurred. The missing website explains the absence of a website action on Listing A only. Low observed traffic and no saved quotes are consistent with no customer leads, but do not prove every historic request was captured.

## Repairs

- Tracking now awaits storage and returns 503 with a payload-free server log on failure; rate-limit drops return 429 rather than success.
- Genuine quote storage and its lead counter commit atomically and are awaited before responding. Spam and identified owner/manager/editor submissions do not increment customer leads.
- Phone text links use the same validated telephone URL as the main call button.
- Optional analytics errors cannot prevent first-party action tracking. Navigation requests use keepalive with no automatic retry, avoiding duplicated increments after ambiguous failures.
- Listing metadata refreshes and effect replays no longer duplicate the current listing view.
- Quote and click endpoints share the 120-character listing-ID validation limit, with no silent truncation. Client-submitted lead increments remain rejected.

Authenticated exclusions rely on the existing authentication helpers; those helpers can return no user during an authentication lookup failure. Missing ownership metadata also cannot be safely inferred from billing data.

## Verification and limits

All four workspace type checks and all 775 tests passed (730 web, 43 shared library, 2 scripts). Eighteen new isolated tests cover phone, website, Google/Apple/location directions, aggregate counters, missing listings, invalid inputs, storage errors, internal traffic, stable views and atomic leads. Actual quote-route code runs in an isolated harness with mocked authentication, storage, classification and notifications. No test sends production analytics, leads, email or paid AI requests.

Production inspection used database reads, logs and raw public HTML GETs only; no browser JavaScript or action links were executed. Thus these tests validate code and mocked persistence, not a real production write or telephone/directions application launch. No historical counters were changed. No purchases or billing settings changed. Fixes are local and require a subsequent release before production behavior changes.
