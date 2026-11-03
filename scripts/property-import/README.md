# Reviewed property imports

This is a local-tested integration, **not an activated service**. No default setting
enables Firecrawl, AI usage, document processing or deployment. The owner must approve
the specific operating costs before activation. See `docs/property-import-costs.md`.

## User workflow

An approved corporate portfolio owner opens **Import website or brochure** in the
company portfolio. They select a new property or an existing approved property,
submit one individual property website page or a PDF/DOCX, and review an editable
English/Spanish draft, original source excerpt, extracted evidence, duplicate
candidates and photo links. Unknown fields require correction. A company directory
containing multiple properties is not automatically split or bulk-crawled.

Without the optional AI adapter, descriptions are explicitly labelled **basic fact
templates**. They use recognized labels or a single supported JSON-LD entity, plus
a small conservative amenity vocabulary. They do not translate arbitrary marketing
prose. The optional OpenAI adapter extracts richer details and writes equivalent
English/Spanish descriptions; output still needs human review.

The user must explicitly select each field to replace on an existing listing.
Identity/address edits use the existing listing editor, not the import overwrite
action. The application compares selected fields with the original snapshot inside
a transaction; concurrent edits reject the save. Description and gallery updates
retain existing paid-feature gates. New properties remain Basic, unpublished and
pending staff review and paid enrollment. Importing never changes ownership, grants
a claim, initiates billing, or enrolls a property.

This first screen is for approved corporate owners, not delegated listing managers
or staff acting on unclaimed firms. It does not invent a corporate owner to let staff
import into an unclaimed portfolio. A future staff workflow needs its own existing
staff-role checks and review queue before it can be activated.

## Configuration (all defaults are off / zero)

Do not paste secrets into chat or commit them. Configure server-side environment
variables only after approving the relevant services and usage limits.

| Variable | Purpose |
| --- | --- |
| `PROPERTY_IMPORT_ENABLED=true` | Master feature switch; absent means disabled. |
| `PROPERTY_IMPORT_FIRECRAWL_ENABLED=true` | Explicit Firecrawl activation. Requires `FIRECRAWL_API_KEY`. |
| `PROPERTY_IMPORT_DOCLING_ENABLED=true` | Explicit offline worker activation. |
| `PROPERTY_IMPORT_AI_ENABLED=true` | Optional paid bilingual extraction/drafting. Requires existing `OPENAI_API_KEY`. |
| `PROPERTY_IMPORT_MONTHLY_REQUEST_LIMIT` | Whole-project preview reservations per UTC month, default zero, maximum 1,000. |
| `PROPERTY_IMPORT_MONTHLY_AI_LIMIT` | Whole-project AI requests per UTC month, default zero, maximum 1,000. |
| `PROPERTY_IMPORT_PYTHON` | Absolute Python executable path in a dedicated virtual environment. |
| `PROPERTY_IMPORT_WORKER` | Absolute path to `scripts/property-import/docling_worker.py`. |
| `PROPERTY_IMPORT_TEMP_DIR` | Writable temporary directory; prefer repository `.tmp` locally. |
| `PROPERTY_IMPORT_MODEL_CACHE` | Explicit offline Hugging Face cache directory; defaults to a subdirectory of the temp directory. |

Request allowances are reserved atomically before provider calls, are not refunded
after failure, and are shared across companies. No retries, background crawls, paid
Firecrawl JSON extraction, automatic credit purchases or recurring refreshes are
implemented. Six combined preview/apply requests per owner per hour additionally
limit abuse. These are request-count controls, not a claim that Google Cloud billing
budgets are hard caps. Keep Firecrawl auto-recharge disabled independently.

Firecrawl uses its fixed official `POST /v2/scrape` endpoint with `rawHtml` and
`markdown`, one page per request, 30-second provider timeout and a bounded response.
It rejects private/literal/credential-bearing target URLs and unexpected final hosts.
The app does not directly connect to the submitted website; Firecrawl is the fetcher.
Optional AI uses the application's established Chat Completions pattern, fixed
`gpt-4.1-mini-2025-04-14`, no tools, no stored responses, and at most 2,500 output
tokens. Only the source text and extracted public facts are submitted, not the
original brochure binary or account/billing data.

## Local Docling setup

Use the repository's existing `.tmp/docling-pilot-venv` if present. Otherwise create
a virtual environment **inside this repository** and install the existing pinned
requirements (free packages, no API calls):

```powershell
python -m venv .tmp/docling-pilot-venv
.tmp/docling-pilot-venv/Scripts/python.exe -m pip install -r scripts/docling-pilot/requirements.txt
```

PDF conversion requires the Docling layout model in the configured local model
cache. Download required public model artifacts separately into that cache during
setup; do not enable downloads during processing of an uploaded document. The
worker sets Hugging Face offline flags and blocks socket connection methods. The
Node adapter passes a minimal environment without Firebase, Stripe, OpenAI or other
service credentials. This is defense in depth, not a full operating-system sandbox;
hosted activation should run the converter in a separately restricted worker with
no service credentials or outbound network access.

The adapter uses `execFile` without a shell, a generated temporary filename, a
90-second timeout and a 512 KiB output bound, and deletes its generated directory
in `finally`. Uploads are streamed into a bounded buffer (10 MiB plus multipart
overhead), including requests without Content-Length. PDF files are limited to
30 pages; DOCX archives to 2,000 entries and 50 MiB expanded size. Text output is
limited to 40,000 characters. Image-only/scanned PDFs are unsupported: OCR is off.
Embedded brochure photos are not extracted; users must upload permitted photos
through the listing editor. Website photo candidates are links, not downloaded or
licensed assets, and require explicit rights/accuracy confirmation before saving.

Draft receipts retain source hash, date, extracted facts, candidate URLs, selected
listing baseline and expiration (24 hours). They do not retain uploaded files or
full source text. The source excerpt is returned only for immediate review. Applied
receipts and the audit log retain provenance. Expiration rejects use; it does not
automatically delete old receipts. Configure retention cleanup before sustained use.

Duplicate checks cover normalized own-portfolio records and the static catalog,
plus bounded exact-name/address queries against dynamic listings. New importer
writes also use an address/city/state identity lock to prevent concurrent copies
across companies. This is not comprehensive fuzzy deduplication of every legacy
dynamic record. Ambiguous matches require review, never automatic consolidation.

## Verification

```powershell
node --import tsx --test apps/web/src/lib/property-import.test.ts apps/web/src/lib/property-portfolio-flow.test.ts
npm run type-check --workspace=@citybeat/web
```

Tests mock Firecrawl/OpenAI and Firebase/Stripe to avoid live traffic and charges.
They exercise zero-default provider gates, bounded scrape shape, malformed source
responses, AI output validation, permissions, origin checking, chunked body bounds,
quota races, duplicate races, selected-field compare-and-set, paid entitlements,
photo rights, pending/unpublished new listings and their later safe public gallery
projection. A regression fixture mirrors actual flattened Docling PDF output.

Local verification on November 3, 2026 also ran the real offline Docling PDF worker
against a synthetic one-page brochure after downloading the free layout model
separately into the repository cache. The complete Node upload-buffer adapter →
minimal-environment Python process → Docling → bilingual fact extractor took
6.837 seconds with a warmed cache. Name, city, ZIP, phone and translated amenity
facts were asserted; unknown property type correctly remained blank for review.
The first worker-only PDF run took 18.251 seconds. These small local fixtures do
not establish throughput, OCR support or accuracy on arbitrary customer brochures.
Neither Firecrawl nor the optional OpenAI adapter was called live.

Roll back by leaving/removing `PROPERTY_IMPORT_ENABLED`, which disables preview and
apply while retaining existing listings. No migration or cloud resource creation
is needed for local testing. Production activation requires a separately reviewed
worker packaging/deployment configuration and an approved operating budget.
