---
id: "202610151818-RAFHZT"
title: "Create Super H Automotive Premium listing handoff"
status: "TODO"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
doc_version: 2
doc_updated_at: "2026-10-15T18:18:58+00:00"
doc_updated_by: "agentctl"
description: "Create the public Super H Automotive directory listing at 4550 Hercules Ave with phone (915) 202-6730, generate a recurring USD 19.99/month Stripe checkout link and QR code, verify claim/edit access, and prepare customer login instructions. No customer payment or outbound message is authorized."
---
## Summary

Create a claimable Super H Automotive directory listing and a private recurring Premium checkout handoff for the owner.

## Scope

Create one unclaimed listing for Super H Automotive at 4550 Hercules Ave, El Paso, TX 79904 with phone (915) 202-6730; generate a Stripe-hosted Premium checkout for USD 19.99 per month for one location; generate a QR code for that private checkout; verify public listing and claim routes; prepare login, claim, payment, and editing instructions. Do not enter customer card details, submit payment, assign ownership without verified acceptance, or contact the customer.

## Risks

Duplicate directory records, disclosure mistakes, accidental ownership assignment, or exposing a private checkout could confuse or mischarge the customer. Search first, preserve Stripe-hosted card entry, disclose automatic monthly renewal until cancellation, and keep ownership unclaimed until the customer verifies it.

## Verify Steps

Confirm the canonical production listing data and public EN/ES listing pages; confirm the checkout is Stripe-hosted, live, scoped to this listing, and displays USD 19.99 monthly recurring for one location without completing payment; verify the QR resolves to the same checkout URL; verify the claim page requires sign-in and ownership verification; verify no payment, customer email, or ownership assignment occurred.

## Rollback Plan

Expire the unpaid Stripe Checkout Session and remove or archive the newly created unclaimed directory listing and sales order using the supported administrative workflow if the handoff was created incorrectly. Delete only generated local QR artifacts after confirming their exact paths.

