# Founders funnel

Public target after deployment: `/en/founders` and `/es/founders`.

## Pricing

The first 100 businesses pay $9.99/month total, including every location grouped under their business listing. The existing annual Founders plan likewise bills one business unit. The shared reservation gate still counts businesses, not locations. The rate stays locked while subscribed. Later standard Premium signups pay $19.99/month per location. This release does not migrate or alter existing subscriptions.

Self-service and Sales Desk checkout now distinguish `location_count` from `billing_quantity`. A prior open Founders session with different line items is held for staff reconciliation instead of being silently reused at its old per-location amount. No automatic cancellation or retroactive price change occurs.

## Customer flow

1. Search public directory using the existing rate-limited search endpoint.
2. Select a listing and sign in (Google supported by existing login). The selected listing survives sign-in through `redirectTo`.
3. Verify control of the on-file business inbox, then await staff approval. Missing inbox: contact support with ownership evidence, never change the verification recipient to a claimant-supplied email.
4. If missing, submit a three-step Basic listing form: business details, optional main photo URL, locations/hours, preview and representation attestation. Actual uploads and advanced content remain in the existing owner CMS after approval.
5. New submissions are unpublished, Basic, unverified and pending staff approval. Server checks existing normalized business names, addresses and phones with a bounded five-minute cache; deterministic document IDs prevent concurrent identical creations. This is duplicate prevention, not proof of ownership. Staff also checks conflicts and content before approval.
6. An approved owner can keep Basic free or explicitly open Stripe checkout. Founders availability is provisional until the atomic allocator confirms it. When unavailable, a clearly labeled standard per-location Premium alternative is offered. Existing subscribers go to Billing. Premier's private invitation stays in its dashboard.
7. Successful Stripe return goes to the dashboard; cancellation returns to the chosen business. Only a validated paid webhook activates Premium. The webhook rechecks ownership transactionally so payment cannot restore revoked access.

## Operations and validation

- Review new requests in the existing admin claims queue. Approval publishes Founders-origin submissions and unlocks Basic ownership; notification uses the existing account/email mechanism.
- Unpublished listings are excluded from the public server page and require owner/staff authentication on the detail API.
- Tests cover unsafe input, cross-origin submissions, verified identity, duplicate races, private draft IDs, free submissions when sold out, payment validation, return URLs, flat Founders quantity and standard quantity preservation. Existing capacity tests cover the last-slot race.
- UI fixture (not production) checked search, multi-location flat quote, three-step submission, pending state, Spanish and mobile layout.
- No production records, emails, charges, subscription migrations or deployment performed during implementation.
