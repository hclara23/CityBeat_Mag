# Claude Implementation Handoff: Directory Owner Platform

Last updated: July 30, 2026  
Repository: `C:\dev\CityBeat_Mag`  
Base branch at handoff: `main`  
Starting commit: `240fa6a3e359fc414e31928e9adc9cb1b2a1b3e4`

## Purpose

This document is the self-contained implementation brief for the next coding
agent. It consolidates the six requested implementations and the product,
security, privacy, analytics, newsletter, and developer-console recommendations
that were agreed during planning.

Read `AGENTS.md` and run the required superpowers bootstrap before changing the
repository. Follow the repository's `agentctl` task and commit workflow.

## Current production baseline

The following work is already complete and must not be rebuilt:

- The unified Sales Desk supports the CityBeat product catalog, recurring
  Stripe checkout, payment links, QR codes, email/text sharing, and post-payment
  fulfillment.
- A salesperson can create a previously unlisted directory business and enter a
  new category.
- Directory listing prices can be selected as:
  - Basic: free
  - Founders: $9.99/month
  - Premium: $19.99/month
- A free listing produces only the listing/claim handoff link and QR code.
- A paid listing produces both the payment handoff and the listing/claim
  handoff.
- The listing URL can be opened, copied, emailed, texted, or scanned.
- Paid directory entitlements are not activated until Stripe confirms payment.
- The latest completed directory-sales task was
  `202607302047-TTQHCD`.
- Production revision `citybeat-web-00156-dkf` was deployed with 100% traffic.
- At that release, 53 tests, lint, type checking, build, and production smoke
  checks passed.

None of the six implementation packages below has been implemented as part of
this handoff task.

## Non-negotiable product requirements

1. A salesperson creating a new business may bypass the normal business
   verification only when physically present at the business or when the
   salesperson personally knows the business owner.
2. The bypass must be explicit, off by default, restricted to authorized sales
   staff, and fully auditable.
3. Every claimed business receives an owner CMS.
4. Free owners must see paid features, but paid controls must be visibly locked,
   gray, and non-interactive. They must include a concise upgrade explanation.
5. The business-owner experience should reach feature parity with the useful
   business-management capabilities of Google Business Profile and then exceed
   them through CityBeat-specific promotion, bilingual, SEO, lead, and
   automation features.
6. Owners need listing analytics, activity alerts, and monthly performance
   reports.
7. The promotional newsletter choice must be visible and preselected for
   US-targeted acquisition flows, while allowing the customer to uncheck it
   before submission.
8. Promotional newsletter consent must be separate from transactional order,
   claim, security, review, lead, and business-performance communications.
9. Newsletter subscribers, directory customers, registered users, and other
   customer types must be visible and downloadable only from the developer
   dashboard.
10. Developer-only access must be enforced by the server. Hiding UI controls is
    not sufficient.

## Recommended implementation defaults

Use these defaults unless the owner explicitly changes them:

- Basic/free owners can maintain accurate core business information.
- Founders and Premium share the same functional entitlement set. Founders is a
  promotional price, not an intentionally weakened product.
- Featured includes every Premium capability plus placement, benchmarking, and
  priority benefits.
- Immediate alerts are used for reviews, comments, and leads. Passive activity
  such as page views and clicks is summarized rather than producing notification
  spam.
- Email activity notifications and monthly business reports default on and can
  be disabled in owner preferences.
- SMS is always an affirmative opt-in.
- Promotional newsletter preference is stored separately from all service
  communications.
- A salesperson's verification bypass never bypasses Stripe payment.
- Existing newsletter opt-outs are permanent suppression records unless the
  customer deliberately resubscribes.
- Postcard verification remains a tracked manual fallback until an actual postal
  provider is integrated. Do not claim that a postcard was sent when it was not.

---

## Implementation package 1: Sales verification bypass and customer handoff

### Goal

Let an authorized salesperson establish that a newly created listing is a
legitimate business when the salesperson is physically there or personally
knows the owner, without weakening the normal public claim process.

### Sales Desk behavior

Add an option to the new-directory-listing step:

> Bypass business verification

The option must:

- Be available only to authenticated sales/developer roles.
- Apply only while creating a new listing through the Sales Desk.
- Default to off for every sale.
- Require one of:
  - `in_person_at_business`
  - `personally_knows_owner`
- Require an attestation checkbox confirming that the salesperson is authorized
  to use the bypass.
- Require the customer's exact email address.
- Optionally capture a short internal note.

### Audit record

Store immutable audit data, preferably in a dedicated
`directory_verification_audits` collection:

```text
listing_id
salesperson_id
salesperson_email
verification_path: salesperson_attestation
attestation_method
attestation_note
customer_email_normalized
created_at
request_ip_hash
user_agent_summary
```

Do not expose internal notes, IP information, or salesperson identifiers on the
public listing.

### Customer acceptance flow

The bypass should remove the second business-verification challenge, not account
ownership authentication:

1. Customer opens the listing/claim link.
2. Customer signs in or creates an account using the exact email recorded by the
   salesperson.
3. Customer reviews the listing and accepts ownership.
4. Basic/free becomes active after acceptance.
5. A paid plan remains pending until Stripe payment succeeds.

The claim link must be signed, expire, and be single-purpose. Do not place raw
verification secrets in analytics or exports.

### Standard verification path

When bypass is not selected:

- Continue using the existing email-code verification.
- Preserve the manual/admin postcard fallback status.
- Make the UI honest that automated postcard delivery is not currently
  available.

### Salesperson guidance popup

After listing creation, show concise next-step instructions based on the result:

- Free + bypass: customer signs in, accepts ownership, and completes profile.
- Free + standard verification: customer opens the listing link and completes
  email verification.
- Paid + bypass: customer pays, signs in with the recorded email, and completes
  the listing.
- Paid + standard verification: customer pays, then verifies and completes the
  listing.

The popup should include copy, email, text, open, and QR actions for the
appropriate links. Never show a payment link or payment QR for a free listing.

### Acceptance tests

- Public users cannot set or forge the bypass.
- An unauthorized role receives `403`.
- Bypass defaults off.
- Audit fields identify the responsible salesperson and method.
- The wrong customer email cannot accept the bypassed claim.
- Free acceptance never creates a Stripe checkout.
- Paid acceptance does not activate paid entitlements before Stripe success.
- Reusing or tampering with a claim token fails.

---

## Implementation package 2: Owner CMS and centralized plan entitlements

### Goal

Give every claimant a focused business-listing CMS while making upgrades easy to
understand. The server and interface must use the same entitlement rules.

### Recommended route

Create:

```text
/{locale}/dashboard/listings/{listingId}
```

Keep public inline editing only as a shortcut into the CMS. The dedicated CMS is
the source of truth for business management.

### CMS navigation

- Overview
- Business Profile
- Media
- Hours
- Services
- Products or Menu
- Posts, Offers, and Events
- Reviews
- Leads and Messages
- Analytics
- Team and Access
- Settings

### Editing experience

- Use the established CityBeat dark editorial design tokens.
- Provide autosaved drafts and clear `Saved`, `Saving`, and `Needs attention`
  states.
- Show profile-completion and local-SEO scores.
- Provide a live public-listing preview.
- Show moderation/approval status where a change requires review.
- Keep frequently used fields shallow and grouped.
- Do not use a maze of nested dialogs.

### Central entitlement registry

Create one typed entitlement module used by:

- CMS rendering
- API authorization
- analytics/report access
- lead visibility
- export permissions
- upgrade messages

Never depend on disabled UI alone. Every protected write and read must check the
entitlement on the server.

Suggested conceptual interface:

```ts
type DirectoryPlan = 'basic' | 'founders' | 'premium' | 'featured'

type DirectoryEntitlements = {
  coreProfile: boolean
  enhancedDescription: boolean
  mediaLimit: number
  video: boolean
  socialLinks: boolean
  servicesAndProducts: boolean
  postsOffersEvents: boolean
  fullAnalytics: boolean
  analyticsExport: boolean
  detailedLeads: boolean
  aiAssistance: boolean
  additionalManagers: number
  bookingLinks: boolean
  priorityPlacement: boolean
  categoryBenchmarking: boolean
}
```

### Recommended tier matrix

| Capability | Basic Free | Founders / Premium | Featured |
| --- | --- | --- | --- |
| Claim and owner CMS | Yes | Yes | Yes |
| Name, category, address, phone, website | Yes | Yes | Yes |
| Standard and special hours | Yes | Yes | Yes |
| Basic description and one primary image | Yes | Yes | Yes |
| Detailed bilingual profile and social links | Locked | Yes | Yes |
| Full gallery and video | Locked | Yes | Yes |
| Services, products, menu, attributes | Locked | Yes | Yes |
| Posts, offers, and events | Locked | Yes | Yes |
| Manual review replies | Yes | Yes | Yes |
| AI review and content assistance | Locked | Yes | Yes |
| Basic rolling 30-day analytics | Yes | Yes | Yes |
| Full history, comparisons, export, reports | Locked | Yes | Yes |
| Lead totals | Yes | Yes | Yes |
| Full lead inbox and customer contact details | Locked | Yes | Yes |
| Booking/action links | Locked | Yes | Yes |
| Additional managers | Locked | Yes | Yes |
| Priority placement and badge | Locked | Locked | Yes |
| Category/competitor benchmarks | Locked | Locked | Yes |
| Multi-location/bulk tools | Locked | Locked | Yes |

### Locked-feature presentation

Free owners must be able to understand what they are missing:

- Render the complete module.
- Desaturate and gray the protected controls.
- Add a lock label and one-sentence benefit.
- Set actual controls to `disabled` or `aria-disabled`.
- Prevent keyboard and pointer activation.
- Put the upgrade action outside the disabled overlay.
- Do not expose paid data in the HTML/API response merely because the control is
  disabled.

### Acceptance tests

- Owners can edit only their own listings.
- Staff overrides are role checked and audited.
- Basic API requests cannot write Premium fields.
- Basic API responses do not leak protected lead or analytics data.
- Founders receives Premium functionality.
- Featured receives every Premium entitlement.
- Locked modules are visible, understandable, keyboard-safe, and non-clickable.
- Downgrading retains data safely but prevents future protected edits.

---

## Implementation package 3: Google Business Profile parity and CityBeat advantages

### Goal

Match the useful business-management surface of Google Business Profile, then
provide additional value through CityBeat's local media reach.

### Core parity features

Implement or complete:

- Business name, category, description, address/service area, contact data, and
  website.
- Standard hours, special/holiday hours, and temporary closures.
- Business attributes and accessibility information.
- Logo, cover image, gallery, captions, and video.
- Services, prices, products, menu items, and service areas.
- Posts, announcements, offers, and business events with scheduling and
  expiration.
- Booking, order, reservation, appointment, quote, and other action links.
- Review list, owner replies, reporting/moderation actions, and review-request
  sharing.
- Owners, managers, role invitations, revocation, and audit history.
- Listing status, moderation status, and public preview.

### CityBeat differentiators

Build beyond the baseline:

- English/Spanish fields with assisted translation and human-editable output.
- SEO completeness score with missing-field recommendations.
- Structured-data/schema preview and validation.
- CityBeat backlink/referral traffic reporting.
- AI-assisted descriptions, posts, offers, and review-reply drafts.
- Unified review, lead, comment, and activity inbox.
- Printable and shareable review-request QR code.
- Local category and competitor benchmarks for Featured customers.
- Cross-promotion opportunities into CityBeat stories, events, jobs,
  newsletters, and advertising inventory.
- Multi-location and bulk editing.
- A visible explanation that CityBeat listings create a relevant local backlink
  and discovery surface, without guaranteeing ranking improvements.

### Content integrity

- Sanitize all rich text and URLs.
- Validate image type, dimensions, and size.
- Preserve moderation for risky public content.
- Log owner/staff changes.
- Never let AI publish autonomously; the owner reviews and submits generated
  content.

### Benchmark references

- Profile editing:
  https://support.google.com/business/answer/3039617
- Posts, offers, and events:
  https://support.google.com/business/answer/7342169
- Services:
  https://support.google.com/business/answer/9455399
- Reviews and replies:
  https://support.google.com/business/answer/3474050
- Performance metrics:
  https://support.google.com/business/answer/9918094
- Owners and managers:
  https://support.google.com/business/answer/3403100
- Attributes:
  https://support.google.com/business/answer/9049526
- Booking links:
  https://support.google.com/business/answer/7475773

These links are product benchmarks, not authorization to copy Google's visual
design or wording.

---

## Implementation package 4: Listing analytics

### Goal

Give owners useful, privacy-conscious measurements tied to a specific listing.

### Events to track

- `listing_view`
- `website_click`
- `phone_click`
- `directions_click`
- `quote_request`
- `message_or_lead`
- `review_created`
- `comment_created`
- `save_listing`, if the feature exists
- `share_listing`
- `booking_click`

### Event model

Extend the existing analytics pipeline with fields such as:

```text
event_type
listing_id
owner_id_snapshot
path
referrer_domain
locale
day
created_at
visitor_dedupe_hash
campaign_or_utm fields
```

Do not store raw IP addresses. Reuse the current staff exclusion, rate limiting,
and privacy controls. Add reasonable bot filtering and deduplication so refresh
loops cannot inflate owner metrics.

### Owner analytics UI

Show:

- Current 30 days
- Previous 30 days
- Percentage and absolute change
- Daily trend
- Top actions
- Top referrer categories
- English/Spanish audience split where meaningful
- Leads and review conversion
- Most recent meaningful activity

Basic owners receive a useful rolling 30-day overview. Paid owners receive
history, comparisons, sources, campaign attribution, and export. Featured owners
receive local category benchmarks when sufficient anonymized data exists.

### Privacy and authorization

- Owners may query only listings they own/manage.
- Aggregate benchmarking must enforce minimum cohort sizes.
- Do not expose individual visitor identity through analytics.
- Apply retention limits to detailed events.
- Keep analytics export separate from the developer audience export.

### Acceptance tests

- Each public action creates the correct listing-scoped event.
- Duplicate refreshes/click storms are limited.
- Staff traffic is excluded.
- Cross-owner queries return `403` or `404`.
- Basic, Premium, and Featured results match their entitlements.
- Empty data renders a useful zero state rather than an error.

---

## Implementation package 5: Owner notifications and monthly reports

### Goal

Alert business owners about activity that requires attention and provide a clear
monthly summary without producing excessive email.

### Immediate notifications

Create first-party notification records for:

- New review
- New comment
- New lead or quote request
- Claim/verification status change
- Listing moderation request or rejection
- Payment or entitlement problem

Deliver through:

- In-app notification inbox
- Email, when enabled
- SMS only after explicit opt-in

Views, website clicks, calls, and directions should not create immediate alerts.
They belong in analytics and the monthly report.

### First-party reliability

The current Novu inbox may render nothing when Novu is not configured. Store
notification records in CityBeat's database first and treat Novu/email/SMS as
delivery channels. The in-app inbox must work without Novu.

The current review route records notification metadata but does not reliably
send owner email. Connect it to the existing email provider and log delivery
outcomes.

### Preference center

Create owner settings for:

- Review alerts
- Comment alerts
- Lead alerts
- Claim/moderation alerts
- Monthly business report
- Email channel
- SMS channel
- Promotional newsletter

Promotional newsletter must remain a separate setting and consent record.

### Monthly business performance report

Send a bilingual report containing:

- Listing views
- Website clicks
- Phone taps
- Direction requests
- Leads/quote requests
- Reviews and comments
- Average rating and rating change
- Current 30 days versus previous 30 days
- Top-performing listing actions
- Profile-completion/SEO recommendations
- A direct link to the owner CMS and analytics

Implementation requirements:

- Idempotency key per listing/reporting month.
- Delivery status, provider ID, timestamp, and failure reason.
- Retry-safe generation.
- Respect the monthly-report preference.
- Do not mix promotional content into a transactional report unless it is
  clearly separated and legally appropriate.
- Add or verify the Cloud Scheduler job after deployment.

### Acceptance tests

- A new review/comment/lead creates one in-app record.
- Email sends only when enabled.
- SMS never sends without affirmative consent.
- Passive metrics do not trigger immediate alerts.
- The same monthly period cannot send twice accidentally.
- A disabled monthly report is skipped and logged.
- English and Spanish report links use the correct locale.

---

## Implementation package 6: Newsletter preferences and developer-only audience console

### Goal

Capture the requested promotional newsletter choice transparently, maintain a
reliable suppression system, and provide developers with safe, downloadable
customer/audience datasets.

### Newsletter checkbox placement

Add a clearly worded newsletter choice to:

- Account signup
- Directory claim/acceptance
- Customer-facing post-payment fulfillment
- Free listing customer handoff/claim
- Relevant profile/preferences pages

For US-targeted flows, the checkbox should be preselected as requested. The
customer must be able to uncheck it without losing access to the product.

Do not let a salesperson silently provide marketing consent on the customer's
behalf. When a salesperson enters a customer email, the customer-facing claim or
fulfillment step should confirm the preference.

Use a policy/jurisdiction setting that can render the checkbox unchecked where
affirmative opt-in is required. Keep the label specific:

> Email me the CityBeat newsletter with local stories, events, and offers. I can
> unsubscribe at any time.

Provide Spanish copy with the same meaning.

### Consent/subscription record

Normalize email addresses and deduplicate records. Suggested fields:

```text
email_normalized
email_display
status: active | unsubscribed | bounced | complained
newsletter_opt_in
consent_timestamp
consent_source
consent_policy_version
consent_locale
consent_method
user_id, when known
listing_ids, when known
created_at
updated_at
unsubscribed_at
bounced_at
complained_at
```

For legacy records, preserve their existing active/unsubscribed state and label
their source as legacy. Never turn an existing unsubscribe back on during
migration.

### Suppression and unsubscribe hardening

The current newsletter unsubscribe URL exposes the raw email in a GET query and
shows success even if the database update fails. Replace it with:

- A signed, opaque, expiring or purpose-limited unsubscribe token.
- A one-click endpoint that records suppression before showing success.
- An error/retry page when persistence genuinely fails.
- A global marketing suppression check used by every newsletter/outreach sender.
- Bounce and complaint states where the email provider supports webhooks.

The digest must select only active, non-suppressed subscribers. Every commercial
newsletter needs accurate sender information, the CityBeat postal address, and a
clear unsubscribe link.

### Keep communications separate

Use distinct preferences:

- `promotional_newsletter`
- `monthly_business_report`
- `review_activity`
- `lead_activity`
- `security_and_transactional` (cannot be disabled when required to operate the
  account or fulfill an order)

Unsubscribing from promotional newsletters must not prevent receipts, security
notices, claim codes, or fulfillment messages.

### Developer-only Audience & Accounts console

Add an `Audience & Accounts` card/section to:

```text
/{locale}/developer
```

Recommended datasets:

- Registered profiles
- Active newsletter subscribers
- Unsubscribed/suppressed newsletter addresses
- Claimed directory owners
- Free directory listings
- Founders subscribers
- Premium subscribers
- Featured subscribers
- Advertisers and campaign customers
- Job-posting customers
- Event customers
- Other sales-order/product customers
- Referral participants
- Sales-originated customers
- Creators/contributors where useful

Recommended columns:

- Name
- Email
- User/customer ID
- Customer type
- Listing/business name and ID
- Plan/product
- Subscription/payment state, without card data
- Newsletter status
- Consent source and date
- Locale
- Signup/created date
- Last meaningful activity

Add totals, search, dataset filters, status/plan/source/date filters, pagination,
and an explicit empty state.

### Access control

- Use `hasDeveloperAccess` on the server for every data and export endpoint.
- Do not rely on the current client-side redirect.
- Admin, editor, sales, advertiser, writer, and ordinary owner roles must be
  denied unless they also have explicit developer access.
- Avoid broad collection data in client page props.
- Log unauthorized attempts through the standard security logging path.

### Downloadable exports

Support a filtered UTF-8 CSV for each dataset and, if useful, a consolidated
audience export.

Requirements:

- Apply exactly the filters visible in the interface.
- Add UTF-8 BOM if necessary for Excel compatibility.
- Escape quotes/newlines correctly.
- Prevent CSV formula injection by prefixing cells beginning with `=`, `+`, `-`,
  or `@`.
- Use row limits, pagination/streaming, and rate limiting.
- Name files with dataset and UTC date.
- Log actor, timestamp, dataset, filters, row count, and success/failure.

Never export:

- Passwords or password hashes
- Card numbers or bank information
- Stripe secrets or payment method tokens
- Claim/verification codes
- Session, reset, unsubscribe, or invitation tokens
- Raw IP addresses
- Internal security flags not needed for customer operations
- Private notes unrelated to the selected dataset

### Compliance note

US CAN-SPAM generally uses an opt-out framework, but requires accurate sender
information, a postal address, clear unsubscribe instructions, and honoring
opt-outs within ten business days:

https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business

Jurisdictions governed by UK GDPR/PECR require a positive action and do not
accept pre-ticked boxes as consent:

https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/direct-marketing-guidance/plan-direct-marketing/

The jurisdiction switch is therefore a necessary safeguard if CityBeat targets
people outside the applicable US opt-out regime. Confirm the final policy with
qualified counsel for every served jurisdiction.

### Acceptance tests

- US-targeted checkbox starts selected and can be unchecked.
- A jurisdiction/policy requiring affirmative consent starts unchecked.
- Declining the newsletter does not block signup, claim, payment, or listing
  activation.
- Consent source/version/time/locale are persisted.
- Existing unsubscribes are not reactivated.
- Unsubscribe tokens do not reveal email addresses.
- Digest and outreach jobs respect suppression.
- Only developer users can access audience data or exports.
- CSV output is filter-correct, safe from spreadsheet formulas, and audited.

---

## Existing code map

Inspect these files before choosing final abstractions.

### Sales and directory creation

- `apps/web/src/app/[locale]/admin/sales/me/page.tsx`
- `apps/web/src/app/[locale]/admin/sales/new/page.tsx`
- `apps/web/src/app/api/sales/checkout/route.ts`
- `apps/web/src/lib/sales-directory.ts`
- `apps/web/src/lib/sales-products.ts`
- `apps/web/src/lib/sales-checkout.ts`
- `apps/web/src/lib/sales-intake.ts`
- `apps/web/src/lib/sales-fulfillment.ts`
- `apps/web/src/lib/pricing.ts`

### Claims and listing security

- `apps/web/src/app/[locale]/directory/[id]/claim/page.tsx`
- `apps/web/src/app/api/directory/[id]/claim/start/route.ts`
- `apps/web/src/app/api/directory/[id]/claim/verify/route.ts`
- `apps/web/src/lib/directory-security.ts`
- `apps/web/src/lib/directory-security.test.ts`
- `docs/CLAIM_VERIFICATION.md`

Current behavior: public claim verification supports email. Postcard status
exists in the data model/admin flow, but automated postal sending is not
implemented.

### Existing owner editing and dashboard

- `apps/web/src/app/[locale]/directory/[id]/DirectoryDetailClient.tsx`
- `apps/web/src/components/citybeat/MyListingsBoost.tsx`
- `apps/web/src/app/[locale]/dashboard/page.tsx`
- `apps/web/src/app/api/dashboard/route.ts`
- `apps/web/src/app/api/directory/[id]/route.ts`

Current behavior: core fields are editable on Basic; description, image,
gallery, and social fields are already partly gated for paid listings. This
logic must be centralized before the CMS expands.

### Analytics, reviews, and notifications

- `apps/web/src/components/Analytics.tsx`
- `apps/web/src/app/api/track/pageview/route.ts`
- `apps/web/src/app/api/directory/[id]/reviews/route.ts`
- `apps/web/src/components/NotificationInbox.tsx`
- `apps/web/src/app/api/cron/owner-reports/route.ts`

Current gaps:

- Page views are path-scoped, not reliably listing/event scoped.
- Review notification metadata is recorded, but owner email is not reliably
  delivered.
- The notification inbox depends on Novu configuration and can render nothing.
- The monthly owner report covers only a subset of metrics and lacks robust
  comparison, idempotency, and scheduler verification.

### Newsletter

- `apps/web/src/components/NewsletterForm.tsx`
- `apps/web/src/components/citybeat/LeadMagnet.tsx`
- `apps/web/src/app/api/newsletter/subscribe/route.ts`
- `apps/web/src/app/api/newsletter/unsubscribe/route.ts`
- `apps/web/src/app/api/cron/newsletter-digest/route.ts`
- `apps/web/src/lib/suppression.ts`

Current gaps:

- Subscription records do not capture a complete consent history.
- Duplicate/normalization behavior is incomplete.
- Unsubscribe exposes email in the URL.
- Unsubscribe fails soft and can display success after a database failure.
- Digest selection only checks that status is not `unsubscribed`; it must use
  the central suppression rules.

### Developer authorization

- `apps/web/src/app/[locale]/developer/page.tsx`
- `packages/lib/src/roles.ts`
- `packages/lib/src/roles.test.ts`

Current behavior: the developer page performs a client-side access redirect.
The new audience APIs and exports require independent server-side developer
authorization.

---

## Suggested data collections

Use existing collections where they are a good fit, but keep these concerns
logically separate:

- `directory_verification_audits`
- `directory_claim_tokens`
- `directory_manager_memberships`
- `directory_services`
- `directory_products`
- `directory_posts`
- `directory_activity_events`
- `directory_notifications`
- `directory_notification_preferences`
- `directory_monthly_reports`
- `newsletter_subscribers`
- `marketing_suppressions`
- `developer_export_audits`

Prefer stable document IDs and idempotency keys over repeated unbounded
`where(email == ...)` scans. Normalize email once at the boundary. Add Firestore
indexes through the repository's index configuration when queries require them.

## Recommended rollout order

Implement in small, independently verifiable commits/tasks:

1. Central entitlement registry and migration compatibility.
2. Dedicated owner CMS shell with existing fields and locked-module states.
3. Salesperson verification bypass, audit trail, claim acceptance, and next-step
   popup.
4. Services, products/menu, attributes, posts/offers/events, action links,
   reviews, and manager access.
5. Listing-scoped event collection and owner analytics.
6. First-party notification inbox and email delivery.
7. Monthly owner report, preferences, idempotency, and scheduler.
8. Newsletter consent history, preference surfaces, suppression, and secure
   unsubscribe.
9. Developer-only audience APIs, console, CSV exports, and export auditing.
10. CityBeat bilingual, SEO, AI-assistance, review QR, benchmarking, and
    cross-promotion differentiators.
11. User/sales guide updates, full regression testing, deployment, and
    production smoke verification.

Do not attempt all packages in one oversized unreviewable commit.

## Testing and verification

At minimum, add unit/integration coverage for:

- Entitlement resolution and server-side enforcement.
- Owner/staff/developer role boundaries.
- Claim token integrity, expiration, reuse, and email matching.
- Sales bypass authorization and audit creation.
- Free versus paid activation.
- Listing event validation, deduplication, and owner scoping.
- Notification preferences and delivery idempotency.
- Monthly report idempotency and period comparisons.
- Newsletter consent capture, suppression, and secure unsubscribe.
- Developer-only dataset and export authorization.
- CSV escaping and formula-injection prevention.

Run from the repository root:

```powershell
npm test
npm run lint
npm run type-check
npm run build
```

Add targeted tests to the root `test` script if they are not already discovered.
Do not accept a successful build as a substitute for role/security tests.

## Documentation updates required before completion

Update:

- `docs/USER_GUIDE.md`
- `docs/CLAIM_VERIFICATION.md`
- The downloadable sales guide source and generated PDF, when the sales workflow
  changes.
- Privacy/newsletter disclosure text.
- Cloud Scheduler/deployment documentation for monthly reports.

The owner guide must explain:

- How to claim/accept a listing.
- How to edit every CMS module.
- Which features belong to each plan.
- How to read analytics.
- How to change activity, monthly-report, and newsletter preferences.
- How to invite or remove a manager.

The salesperson guide must explain:

- When verification bypass is allowed.
- Which attestation option to choose.
- What to tell free and paid customers.
- Which link/QR to send.
- That payment is never bypassed.

## Deployment handoff

Production is Google Cloud Run service `citybeat-web` in GCP project
`kerstenblueprint`.

- Pushes to `main` normally deploy through `.github/workflows/deploy-web.yml`.
- The local helper is `scripts/deploy-web.ps1`.
- Follow `AGENTS.md` and use `agentctl` for task operations and commits.
- Verify environment variables and scheduler secrets without printing them.
- After deployment, inspect the new Cloud Run revision and confirm 100% traffic
  only after health checks pass.

Production smoke checks should cover:

- Free and paid directory creation.
- Standard and bypassed claim acceptance.
- Owner CMS access and cross-owner denial.
- Locked/free and unlocked/paid behavior.
- Analytics events and dashboard.
- Notification preference changes.
- Secure newsletter unsubscribe.
- Developer audience console and a safe CSV download.
- `403` responses for non-developer audience/export requests.

## Definition of done

The implementation is complete only when:

- All six packages meet their acceptance criteria.
- Free owners can see but cannot operate paid controls.
- Server authorization matches the interface entitlement matrix.
- Verification bypass is restricted and auditable.
- Paid access still depends on confirmed payment.
- Listing activity is measurable without exposing visitor identity.
- Owner alerts and monthly reports are reliable and preference-aware.
- Newsletter choice is transparent and reversible.
- Marketing suppression is honored by every sender.
- Customer/audience lists and exports are developer-only and audited.
- English and Spanish flows are complete.
- Tests, lint, type checking, build, documentation, deployment, and production
  smoke checks pass.

## Final warning to the next agent

Do not expose customer data through the existing client-side developer-role
check. Do not treat disabled controls as authorization. Do not reactivate
suppressed newsletter addresses. Do not let a salesperson bypass payment. Do not
claim that postcard verification or email notification delivery occurred unless
an actual provider action succeeded and was recorded.
