---
id: "202610151818-RAFHZT"
title: "Create Super H Automotive Premium listing handoff"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "Start: Verified the production listing and live Stripe Checkout; generated the customer QR; owner approval is reflected on the public listing. Preparing the exact customer email for action-time send confirmation." }
  - { author: "ORCHESTRATOR", body: "Blocked: Gmail accepted the send request but ignored from_address=hello@citybeatmag.co and emitted the message from Morning Star <morningstarelp@gmail.com> (message 1a140d880cb6dde8). The official CityBeat transactional mailer is configured for hello@citybeatmag.co, but its current Sales Desk template only sends the payment link and cannot include the requested custom login/edit instructions without a code change/deployment or direct mailbox access. Do not mark complete until the sender issue is corrected." }
doc_version: 2
doc_updated_at: "2026-10-15T18:31:54+00:00"
doc_updated_by: "agentctl"
description: "Finalize the existing live Super H Automotive listing at 4550 Hercules Ave with phone (915) 202-6730; preserve the recurring USD 19.99/month Stripe Checkout handoff; generate and verify its QR code; confirm approved owner/edit access; and email the payment link plus login/edit instructions after action-time send confirmation. No customer payment is authorized or initiated."
---
## Summary

Finalize the existing live Super H Automotive directory listing, private recurring Premium checkout handoff, QR code, approved owner access, and customer email instructions.

## Scope

Use the existing live listing and sales order for Super H Automotive at 4550 Hercules Ave, El Paso, TX 79904 with phone (915) 202-6730. Preserve the Stripe-hosted Premium checkout for USD 19.99 per month for one location; generate a QR code for that private checkout; verify public listing data and approved owner access; and send the payment link plus login/editing instructions to vhautomotive.vh@gmail.com only after the required action-time confirmation. Do not enter customer card details or complete payment.

## Risks

Duplicate records, accidental payment, incorrect ownership, or disclosure of a private checkout could confuse or mischarge the customer. Reuse the existing listing and unpaid Checkout Session, disclose automatic monthly renewal until cancellation, send only to the verified on-record owner email, and never enter payment details for the customer.

## Verify Steps

Confirm the canonical production listing and public page show the correct address, phone, category, and Monday-Friday 9:00 AM-6:00 PM hours with weekends closed; confirm the pending-approval banner is absent after owner approval; confirm Stripe Checkout displays USD 19.99 monthly recurring for one location and remains unpaid; verify the QR PNG renders and encodes the same URL; after explicit send confirmation, verify Gmail reports the message sent to vhautomotive.vh@gmail.com.

## Rollback Plan

If the handoff is wrong, expire the unpaid Stripe Checkout Session using the supported Stripe workflow and correct the existing listing rather than creating a duplicate. If an email is sent with an error, send a clear correction because sent email cannot be recalled reliably. Delete only the generated QR artifact after confirming its exact path.

