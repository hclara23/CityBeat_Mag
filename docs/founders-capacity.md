# Founders first 100

The monthly Founders plan is $9.99 versus regular Premium at $19.99/month.
The annual Founders alternative stays $99/year. An active Founders rate does not
automatically increase to the regular price. Generic multi-location quantities
still apply; Premier's explicitly approved bundle is $9.99 total for 3 locations.

Every new Founders checkout uses `createFoundingCheckout`: public claims, sales
desk, partner sales, emailed Founders offers, and Premier's private invitation.
The cart rejects directory products. A single Firestore transaction document
`founding_capacity/launch100` serializes reservations and counts distinct listing
IDs, never locations. Paid places are permanent, including canceled subscriptions;
this is the first 100 businesses, not 100 concurrent active subscriptions.

Before the first reservation, existing Founders Stripe history is scanned and
paid listings/orders are reconciled. Already-issued legacy links count, too.
Unknown legacy open links are conservatively held for staff reconciliation and
are never invalidated automatically. A history larger than 5,000 checkouts fails
closed and requires staff reconciliation. No historic price/subscription changes.

New reservations save exact parameters and an idempotency key before Stripe is
called. Retries reuse them. Known abandoned checkouts are released lazily on the
next checkout attempt, only after Stripe confirms expiry without payment.
Unknown provider outcomes remain reserved for retry or staff reconciliation:
elapsed time alone is not proof that no payment happened. Do not manually remove
a place without checking all associated Stripe checkout/subscription state.

The first-100 count check provides an early user message; the transaction is the
actual admission gate. Once 100 places are paid/reserved, another business cannot
create a Founders checkout. Regular Premium remains a separate plan, never an
automatic substitution or automatic extra charge.

Verification: pure cap/cutoff/reconciliation tests and cross-route source review.
No real customer account, Checkout session, subscription, charge or payment was
created for testing. Live customer completion remains an end-to-end check.
