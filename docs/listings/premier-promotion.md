# Premier Clinic promotion

Approved: 30 exact days of complimentary Premium from one-time activation. The
Founders subscription is $9.99 USD/month **total for all three locations**, not
the generic per-location price. No automatic enrollment or charge.

The private dashboard invitation requires the verified recipient email on the
listing. Accepting the invitation is explicit, independent of subscribing, and
cannot replace another owner. Closing the popup leaves a persistent live
countdown banner. Basic editing and historical print recognition survive expiry.

Checkout charges $9.99 immediately upon customer confirmation, then monthly until
canceled. It returns to the dashboard. Only server-confirmed payment/subscription
state removes the reminder; a return URL alone never grants Premium. Sessions are
idempotent and end by the offer deadline. New sessions cannot be opened during the
final 30 minutes, because Stripe requires at least 30 minutes of checkout lifetime.

The existing comp-expiry scheduler persists the downgrade; public serializers
and entitlement checks enforce it at read time. Existing paid plans are protected.
The targeted approved offer is separate from generic Founders campaign availability.

Run `npx tsx scripts/activate-premier-promotion.ts` for a no-write summary; add
`--activate` only after production deployment. The script uses a short-lived OAuth
credential in an environment variable, an update-time precondition, an immutable
audit record, and refuses repeat activation or existing ownership/subscriptions.
It never sends mail or assigns ownership. Preserve the audit for rollback.

## Draft invitation — NOT SENT; requires message approval

Subject: Dr. Mendoza, your Premier Clinic Premium listing is ready

Hi Dr. Mendoza,

Premier Clinic has 30 complimentary days of Premium on CityBeat, including all
three locations and recognition of your October–November cover feature. Sign in
with your invited Google account at https://citybeatmag.co/en/dashboard to accept
the invitation and manage your listing. Your dashboard shows the exact end date
and time remaining.

To keep Premium, choose the Founders offer for $9.99/month total for all three
locations. If you subscribe, the first $9.99 payment is due at checkout and the
subscription renews monthly until canceled from Billing. Otherwise your listing
automatically becomes Basic at the end of the free period. You keep control of
the Basic listing and your historical cover badge. No automatic charge is made.

CityBeat Magazine

No invitation/reminder emails are enabled for this promotion until the user
approves the message. The dashboard popup/banner do not require email delivery.
