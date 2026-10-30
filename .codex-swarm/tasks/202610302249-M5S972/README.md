---
id: "202610302249-M5S972"
title: "Add bilingual apartments directory with RPM communities"
status: "DONE"
priority: "high"
owner: "CODER"
depends_on: []
tags: []
commit: { hash: "1ff6a5476e77ec026c099d384f786c504d75d357", message: "✨ M5S972 start: restore readable apartment finder footnote contrast on the light search panel" }
comments:
  - { author: "CODER", body: "Start: build bilingual apartments directory and verified RPM catalog using existing CityBeat navigation and design tokens." }
  - { author: "CODER", body: "start: add bilingual apartment directory and ten verified RPM community profiles | details: details: match directory finder and cards; add search and ZIP and property-type filters, leasing contacts, sources, SEO and navigation; pass typecheck and three regression tests" }
  - { author: "CODER", body: "start: correct singular apartment search counts in English and Spanish after browser review" }
  - { author: "CODER", body: "start: restore readable apartment finder footnote contrast on the light search panel" }
  - { author: "CODER", body: "Verified: independent code review passed; browser verified English and Spanish index/detail routes, locale switch, ALZA search, ZIP 79935, combined empty results, reset and rental-home filter, mobile navigation and no horizontal overflow. Visual footnote contrast fixed in 1ff6a5; implementation 6c02368 and singular copy 5bbb6f0. Awaiting specific approval for up to 1 USD Google Cloud build/deployment for this apartments release; no push or production deployment performed." }
  - { author: "CODER", body: "verified: published ten bilingual RPM Living profiles in successful deployment 41141318718 | details: all 22 live pages passed HTTP, locale, heading, canonical and leasing checks; live ALZA search, language switching, ZIP and rental-home filters passed." }
doc_version: 2
doc_updated_at: "2026-10-30T23:07:45+00:00"
doc_updated_by: "agentctl"
description: "Approved apartments section matching the business directory in English and Spanish, with all ten verified RPM Living El Paso communities, searchable cards and details, navigation and tests. Prepare release; additional paid deployment requires approval."
---
## Summary

Published the bilingual Apartments directory and ten RPM Living community profiles, matching the business directory finder, cards, navigation and design tokens.

## Context

The user approved all ten El Paso properties from RPM Living's official directory and authorized up to USD 1 in Google Cloud deployment usage on October 30, 2026. Shared management does not establish shared ownership. TerraLane is correctly labeled as rental homes.

## Scope

Bundled source catalog; English and Spanish index and detail routes; name/address/amenity search, ZIP and community-type filters; leasing phone, website and map links; management/source disclosures; metadata and structured data. Header, footer, directory cross-link and sitemap include the section. No database migration or duplicate Firestore records.

## Risks

Pricing and availability are intentionally omitted because they change. The editorial catalog needs updates when management or contact details change. Official contact numbers may be tracking lines. No invented ratings or copied photography. One deployment used existing hosting; final billed usage is not yet available.

## Verify Steps

Local typecheck, three catalog/filter regression tests, diff check and independent review passed. Local browser checks covered both languages, search, ZIP/type combinations, empty state/reset, language switching and mobile navigation without horizontal overflow.

Production deployment of 1ff6a5476e77ec026c099d384f786c504d75d357 succeeded in GitHub Actions run 41141318718, including typecheck, audit, tests, candidate smoke checks, traffic promotion and production smoke checks. Cloud Build b2b4313b-c62a-4012-b599-dbae24177bbf completed successfully.

Live HTTP/HTML validation passed all 22 public pages: two indexes and twenty detail pages. Checked HTTP 200, all ten locale-specific index links, property headings, canonical URLs, translated leasing/management content and phone links. Live browser confirmed ALZA search returns one, ALZA detail navigation and Spanish switch preserve the property, ZIP 79935 returns two, rental homes returns TerraLane, and reset returns ten. Screenshot: apartments-live.png in the current conversation visualization folder.

## Rollback Plan

Revert implementation commits and redeploy using the existing workflow with approved spending, or restore the prior Cloud Run revision. No database rollback is necessary.

## Notes

Primary source: https://rpmliving.com/find-a-community-post-search/, checked October 30, 2026. Individual community websites substantiate amenities where verified. Desert Commons East uses verified catalog details only. Public directories: https://citybeatmag.co/en/apartments and https://citybeatmag.co/es/apartments. Implementation commits: 6c02368, 5bbb6f0, 1ff6a54. Release and live verification complete.

