# El Paso directory coverage and source assessment

Date: October 20, 2026. Task: 202610202341-R7SRW4. Assessment only; no production data/configuration changes, imports, outreach, purchases, or deployment. No subagents.

## Executive decision

Expand with a review-first, location-aware pipeline, starting with Texas Comptroller outlet data and an Overture Places pilot. First address legacy provenance, geography and search scaling. Do not bulk-publish merged records or present permit/license counts as unique, active storefront counts. Adding useful, accurate details is as important as adding cards.

## Inventory: directly observed production data

Read at 2026-10-20T23:43:32.701Z from kerstenblueprint / (default) / directory_listings using a bounded public-field projection. Aggregate evidence: [inventory JSON](evidence/directory-coverage-2026-10-20.json).

| Measure | Records |
|---|---:|
| All stored listing records | 9,789 |
| Published directory cards | 8,037 |
| Unpublished | 1,752 |
| Marked merged into another listing | 1,729 |
| Unpublished without a merge marker | 23 |
| Published despite a merge marker | 0 |
| Published with El Paso city/locality text | 5,483 |
| Other or unresolved locality | 2,554 |
| Basic tier | 8,023 |
| Premium tier | 14 |
| Claim status approved | 3 |
| Claim status unclaimed | 8,034 |

Premium is a stored tier, **not a verified count of paying subscriptions**. Approved is a claim-status field, not an ownership/security audit. No Stripe or owner data was read.

885 published records have location arrays containing 1,740 entries. These can include the primary address, so they must not simply be added to the card count. Consolidation hides branches under canonical cards; measuring physical-location coverage requires expanding and deduplicating those arrays.

El Paso text matching is only a provisional locality indicator, not city-boundary verification. The inventory includes surrounding areas and West Texas. The OSM source uses a wide bounding box; ScrapeFlow accepts broad regional city/ZIP matches and sometimes phone-only records. Conflicting locality/ZIP combinations remain in the data. Neither 8,037 nor 5,483 is an audited count of unique, active El Paso storefronts.

## Quality and customer value

| Published field | Missing / available | Meaning |
|---|---:|---|
| Website | 3,987 missing (49.6%) | Nearly half cannot provide a website visit from that field |
| Phone | 780 missing (9.7%) | Call action unavailable from that field |
| Description | 7,197 missing (89.5%) | Little business-specific detail |
| Address | 73 missing | Some may legitimately be service-area businesses |
| Hours | 266 available (3.3%) | Do not infer open/closed for the rest |
| Cover or gallery | 4 available | Very limited owner/listing imagery; excludes visitor-review media and UI fallbacks |
| Coordinates | 6,804 available | Presence does not establish accuracy or permitted provenance |
| Source URL | 3,856 missing (48.0%) | Provenance cannot be established from this field alone |

No exact normalized name-plus-full-address duplicate groups were found among published or unmerged records. Two name-plus-phone groups involve four published records; these are review candidates, not confirmed duplicates. This does not detect fuzzy name variants, address abbreviations, missing suites, or mistaken historic brand consolidation.

13 published records use 12 categories outside the canonical filter taxonomy (including Electrical Contractor versus Electrical Contractors, Marketing Agency, and Real-Estate/ Realtor). Normalize through a reviewed mapping without discarding the original value. The current API uses exact category equality.

Stored updated_at is not a last-verified date: 5,775 records were last updated in August 2026 and only 277 in October. Do not advertise freshness based on update timestamps alone.

### Priority category hypotheses

El Paso-locality cards: Beauty 1,404, Health 736, Restaurant 536, Childcare & Education 423, Electrical Contractors 325, Home Services 231, Auto Repair 188, Retail 134, Insurance 124, Financial 36, Marketing 12, Web Development 2, Title & Notary 1. Full distribution is in the evidence file.

Prioritize retail, restaurants/cafes, automotive, home services, and professional services for a measured pilot. These are hypotheses based on current inventory and source suitability—not proof that those businesses are more likely to buy. Track claim and upgrade conversion by source/category before scaling. Beauty is already heavily represented; more of the same feed alone will not provide balanced coverage.

### ZIP comparison: prioritization signal, not a missing-business count

The right column is active sales-tax outlet records with outlet_city=EL PASO and outlet_state=TX. The left is published cards matching El Paso locality with an extractable ZIP. These universes differ; do not subtract them or call their ratio market coverage. Several ZIPs cross municipal boundaries; neither filter proves city limits.

| ZIP | Directory cards, El Paso locality | Sales-tax outlet records, El Paso address |
|---|---:|---:|
| 79936 | 591 | 2589 |
| 79912 | 646 | 2255 |
| 79925 | 407 | 1727 |
| 79938 | 237 | 1653 |
| 79915 | 149 | 1065 |
| 79907 | 162 | 963 |
| 79904 | 77 | 455 |
| 79934 | 42 | 378 |

1,047 El Paso-locality cards have no safely extractable ZIP. Extraction requires an explicit ZIP field or TX/NM state context so five-digit street numbers are not mistaken for ZIPs. Before neighborhood claims, normalize locations and resolve inconsistent city/state/country/ZIP fields.

## Source assessment

Official public metadata and aggregate endpoints checked on October 20. [Source evidence JSON](evidence/directory-sources-2026-10-20.json) preserves filters, timestamps, declared licenses and counts. Counts overlap and must never be added together as net-new listings.

| Source | Observed pool | Permission / suitability | Recommendation |
|---|---|---|---|
| Texas Comptroller active sales-tax outlets | 18,877 with El Paso, TX outlet address; updated Oct 17 | Metadata explicitly Public Domain. Outlet name/address/NAICS; no phone/site fields. Covers taxable outlets, not all businesses. | First candidate feed. Use outlet—not taxpayer mailing—address, preserve outlet key privately, screen non-public/residential locations, dedupe and map NAICS. |
| Overture Places | Local pool not counted or downloaded in this assessment | Official Places documentation lists CDLA Permissive 2.0 / Apache 2.0; individual sources include CC0. Retain source-specific license/notice obligations. | Second, bounded pilot for broad POI/contact coverage. Filter geography, operating status and confidence; exclude non-business POIs. No assumed net-new yield. |
| Texas HHSC operations | 389 active-status records in El Paso County; 273 Licensed Centers | Metadata CC0. Includes childcare homes, placing agencies and residential operations—not all public storefronts. | Begin with licensed centers, check temporary-closure/adverse-action fields. Home-based locations require privacy review and owner-controlled address visibility. |
| TDLR all licenses | 19,776 El Paso County records, including individual licensees; 316 Electrical Contractor and 383 A/C Contractor rows before expiration filtering | No license declaration in retrieved metadata. Public accessibility alone is not blanket reuse clearance. | Confirm reuse terms; establishment/contractor types only, current-validity checks, exclude individual employees/apprentices, avoid owner/mailing fields. |
| TABC | 1,890 active primary-status license records in El Paso County | No license declaration in retrieved metadata; multiple permits can describe one venue. | Confirm reuse terms, dedupe by venue/location, map actual business type—not every permit to Restaurant. |
| OpenStreetMap / Overpass | Existing source inferred for 1,113 published IDs | ODbL requires attribution and applicable share-alike compliance. Broad bbox includes places outside requested city. | Supplemental source only after attribution/licensing review and geography gating. Keep provenance boundaries; don't assume mixing data removes ODbL obligations. |
| Chambers and private directories | 369 published source URLs point to Hispanic Chamber GrowthZone | No reuse permission established here. Existing template uses AI extraction and is default-enabled in source, not runtime-verified. | Seek a partner feed/license before scaling. Do not evade blocks, assume public pages authorize bulk reuse, or invoke paid AI extraction. |
| Business owners / first-party websites | Not counted | Owner-submitted facts and explicitly permitted first-party content are preferred; photos/logos need rights. | Free claim/add/correct flow, service-area privacy, reviewed updates. No bulk outreach approved. |
| City GIS open-data folder | Inspected folder lists geographic/public-facility layers, not a comprehensive business register | Dataset-specific terms still apply. | Geography/context aid, not a promised master business list. |
| Census | County benchmark only | Aggregate statistics, not a business-name/contact feed | Use for context, not imports or exact live coverage percentage. |

### Critical legacy provenance finding

3,812 published records have www.google.com source URLs. This is a strong provenance-review signal, not a field-by-field legal conclusion. Current directory-sink.ts rejects Google-derived candidates and Places templates are disabled in source, but that does not clean legacy records. Google's Maps Platform terms prohibit using its Core Services in a listings/directory service and restrict scraping/caching. Review these records before further enrichment or expansion; independently source replacement facts with field-level provenance, preserving owner-provided content, claims and billing. Do not simply relabel the source URL or silently delete/unpublish customer listings. This assessment made no such changes.

3856 records lack source_url; source=scrapeflow identifies the pipeline, not the underlying license. OSM attribution was not found in the inspected listing-detail/footer files; inspect the full rendered attribution path and applicable database obligations before further OSM use. A map-tile credit alone should not be assumed to cover a derived directory database.

### Realistic scale

The current Census QuickFacts page reports 16,280 employer establishments (2023) and 85,247 nonemployer establishments (2024) for El Paso **County**. These different-year measures include businesses unlike public storefronts; do not sum them into a precise current city target or use them as the denominator for this directory. Hundreds of thousands of useful, distinct El Paso storefront listings is not supported by this assessment. Define success as coverage of eligible, active businesses and locations, plus correction/claim participation—not an inflated card count.

## Recommended next phase (not executed)

1. **Data safeguards and provenance:** review legacy Google/missing-source records; establish immutable source IDs, license, fetched_at, verified_at, business/location distinction, city/county/country, operating status, and field ownership. Protect all owner-managed/paid records. Audit the 23 unmerged unpublished records individually. Never publish merge children wholesale.
2. **Dry-run expansion:** extract a bounded first batch from Public Domain Comptroller data and a separate Overture pilot. Produce create/match/review/reject manifests. No automatic publication. Normalize business locations and map source categories; omit tax IDs, taxpayer home/mailing data, and private contacts from public profiles. Resolve licenses before any TDLR/TABC/chamber expansion.
3. **Global discovery:** replace user-facing 8,000-record inventory windows with one logical search across the eligible corpus, matching location/category synonyms. Introduce a public-field-only index with bounded incremental updates and location search. Prototype using existing infrastructure/local builds; measure reads/storage/runtime before selecting an approach. An open-source library is not proof of zero operating cost.
4. **UI/UX and perceived value:** location-first mobile search, clear results count and filters, useful contact actions, branch-aware cards, prominent free claim/correct/add actions; clearly label owner-verified vs source-listed and unknown hours. Avoid unsupported popularity/traffic promises. Owner completeness checklist and honest view/call-click/site-click reporting make benefits tangible. No paid upgrade should be required just to correct basic business facts.
5. **Pilot gate:** review at least 100 candidate records across target ZIPs/categories; retain named evidence for rejected/duplicate/out-of-area candidates. Confirm 0 overwrites of protected records, correct location handling, and reproducible rollback. Measure search success, claim starts/completions, contact actions and actual upgrades before scaling. Set business-specific import caps after deduped yield and operating-cost estimates—not before.

No deployment or new spend is authorized by this assessment approval. Any paid source, paid API, cloud charge, subscription or import-related infrastructure change requires an explicit vendor/cost-cap approval. Existing database reads are metered; no claim of a verified zero-dollar bill is made.

## Verification and reproducibility

- New read-only scripts: scripts/directory-coverage-audit.mjs and scripts/directory-source-assessment.mjs. Neither contains database mutations. First reads only selected public/provenance fields with a 25,001-record ceiling; it refuses to label a larger result complete. Tokens are transient environment values, never committed.
- scripts/directory-coverage-audit.test.mjs: three tests passed for ZIP parsing, locality/merge accounting, and duplicate handling.
- All tier, claim-status, source, category, ZIP and month totals reconcile to 8,037. Source ZIP totals reconcile to 18,877.
- Default ADC lacked access; existing morningstarelp@gmail.com authorization was used without changing IAM or account configuration. The failed custom Firebase credential adapter was replaced by the existing Google Firestore client with OAuth2 credentials.
- Initial exploratory ZIP parsing wrongly matched five-digit street numbers. It was corrected and tested before the saved evidence scan. Initial loose El Paso text matching was also tightened. Only the corrected final scan is used in this report.
- Existing Graphify graph lacked relevant directory vocabulary; direct source inspection was used. No graph rebuild or external LLM/API calls; additional graph token cost: zero.
- Production runtime, UI, listing records, schedules and financial settings were unchanged. No new browser UX review was performed in this assessment; UI recommendations follow the inventory and inspected search implementation.

## Primary references

- [Texas Comptroller open-data datasets](https://comptroller.texas.gov/transparency/open-data/search-datasets/index.php)
- [Sales-tax dataset metadata and declared Public Domain license](https://data.texas.gov/api/views/jrea-zgmq.json)
- [HHSC metadata and CC0 license](https://data.texas.gov/api/views/bc5r-88dy.json)
- [TDLR metadata](https://data.texas.gov/api/views/7358-krk7.json)
- [TABC metadata](https://data.texas.gov/api/views/7hf9-qc9f.json)
- [Overture Places guide](https://docs.overturemaps.org/guides/places/), [source licensing](https://docs.overturemaps.org/attribution/), [bounded downloads](https://docs.overturemaps.org/getting-data/)
- [OpenStreetMap copyright and license](https://www.openstreetmap.org/copyright)
- [Google Maps Platform terms, section 3.2.3](https://cloud.google.com/maps-platform/terms)
- [City open-data service directory](https://gis.elpasotexas.gov/dev/rest/services/OpenData)
- [Census El Paso County QuickFacts](https://www.census.gov/quickfacts/fact/table/elpasocountytexas/SBO020223)

Public directory:

```text
https://citybeatmag.co/en/directory
```
