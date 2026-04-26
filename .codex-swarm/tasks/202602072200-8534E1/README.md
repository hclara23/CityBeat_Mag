---
id: "202602072200-8534E1"
title: "Fix Vercel monorepo builds"
status: "DOING"
priority: "high"
owner: "ORCHESTRATOR"
depends_on: []
tags: []
comments:
  - { author: "ORCHESTRATOR", body: "Updated Vercel configs to run installs/builds from repo root for workspace resolution." }
  - { author: "CODER", body: "Start: reproduce the current Vercel deployment failure locally, trace the failing Next.js build output, and apply only the root-cause fix." }
doc_version: 2
doc_updated_at: "2026-04-26T20:29:28+00:00"
doc_updated_by: "agentctl"
description: "Adjust Vercel build/install commands for monorepo so workspace packages resolve."
---
## Summary

Fixed the current Vercel deployment failure by typing the briefs detail page content parser. The failed build was caused by an any-typed structured-content branch that made contentParagraphs any and triggered noImplicitAny in the JSX map callback.

## Scope

Updated apps/web/src/app/[locale]/briefs/[id]/page.tsx only. Added explicit BriefContent, RichTextBlock, and RichTextSpan types; adjusted localized content fallback handling; and replaced the inline any-based parser with getContentParagraphs returning string[].

## Risks

Low risk. The change preserves existing string content rendering and keeps support for structured paragraph blocks. Structured content with unexpected shapes now renders as empty text instead of relying on any-typed access.

## Verify Steps

npm run build passed after reproducing the original failure. npm run type-check passed across the monorepo.

## Rollback Plan

Revert the implementation commit to restore the previous briefs detail page content typing and parser. No database, environment, or deployment configuration changes are required to roll back.

## Notes

Root cause: the Vercel/Next.js build failed under strict TypeScript because contentParagraphs was inferred as any after the structured Sanity content branch used any casts. The build failure was reproduced locally before the fix.

