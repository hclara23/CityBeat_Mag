---
id: "202610230424-EEJ2W8"
title: "Renew and send Varsity Roofing claim invitation"
status: "TODO"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: ["202610221253-QF37BA"]
tags: []
doc_version: 2
doc_updated_at: "2026-10-23T04:26:15+00:00"
doc_updated_by: "agentctl"
description: "User authorized sending fresh claim invitation to recorded business email; rotate expired token only, preserve billing tier and analytics and leave Super H website blank."
---
## Summary

Renewed Varsity Roofing invitation and sent via connected Gmail to recorded business email. Gmail SENT message1a167021cbb9c43e from morningstarelp@gmail.com.

## Scope

Rotated expired unused token with transaction checking owner absent and recorded email unchanged. Added invitation audit202610230424-EEJ2W8. Fourteen-day single-use token; raw token not logged or saved locally.

## Risks

SMTP not configured, so authorized connected Gmail used with no paid fallback. Email instructs recipient to verify recorded email and accept ownership, and not start another checkout for existing paid listing. SENT confirms sending, not inbox delivery.

## Verify Steps

Gmail returned SENT. Firestore audit marked sent with message ID. Varsity owner remains unassigned pending acceptance, premium tier preserved, Super H website remains blank. No analytics events, purchases or billing modifications.

## Rollback Plan

Invalidate invitation hash if explicitly requested; do not resend without checking sent record. User must accept before ownership assigned.

