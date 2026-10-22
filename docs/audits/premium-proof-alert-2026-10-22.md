# Premium proof alert investigation

Observed October 22, 2026. Read-only production audit; no listing, analytics,
payment, or billing records were changed.

## Evidence

The alert was emitted after successful reads when no sampled listing had six
recorded customer actions. The reader queried the first 12 documents with a
Premium or Featured tier, incorrectly describing all of them as paid listings.

The bounded audit found 14 matching tier records: ten complimentary grants,
two with recorded Stripe subscription references, and two with neither a comp
grant nor a subscription reference. All were published and unmerged. The
original first-12 sample contained nine complimentary grants, two subscription
records, and one unverified grant.

For September 23 through October 22 UTC, the original sample had 32 recorded
views and zero recorded website, direction, phone, action, or lead counters.
Nine sampled listings had daily stat documents; three had none. The two
subscription-backed listings had 15 views and zero recorded actions between
them. Views deliberately do not count toward the six-action publishing floor.
Both subscription-backed listings were already included in the original sample.
Thus eligibility errors made the alert misleading, but did not hide a qualifying
paid listing in this observed cohort.

These are current daily counters read after the alert, not a point-in-time
historical snapshot. Subscription references plus activated tier are stored
entitlement evidence; no new Stripe subscription-status audit was performed.
No business names, customer identifiers, or subscription identifiers are saved
in this report.

## Causes and correction

1. Tier was mistaken for payment. The reader now checks publication, merged
   status, and a nonempty subscription reference before sampling up to 12
   listings from a bounded scan of 100 tier records.
2. Successful but insufficient evidence called `reportFailure`, producing a
   misleading automation-failure email. It now emits anonymous structured
   diagnostics including scanned/eligible/sample counts, stats coverage, views,
   and actions. Database exceptions still call `reportFailure`.
3. The selection function removed low performers before calculating the median,
   biasing future proof upward. It now calculates the lower median across the
   entire eligible sample and only then applies the unchanged six-action floor.
4. The cache key changes to v2 so a future release does not reuse old cohort data.

The honest present outcome remains no public proof panel. The fix does not
manufacture actions, lower the floor, or convert page views into customer actions.

## Limits and validation

Tracking writes and proof reads share UTC date keys and aggregate event names.
Owner, manager, and editor activity is intentionally excluded. The tracking
endpoint currently swallows write exceptions, so zero recorded actions does not
prove that no unrecorded customer action occurred. No synthetic production events
were generated to test this, because that would contaminate the marketing data.

The bounded cohort is not a complete census once the scan limit is reached;
diagnostics explicitly report that condition. It is not selected by performance.

Regression tests cover paid eligibility, eligibility before sampling, the 12-by-30
stats-read bound, UTC dates, unbiased medians, missing evidence, malformed counters,
and propagation of database failures for alerting. Root type checks and the full
test suite pass. This task prepares a local fix; deployment is not performed.
