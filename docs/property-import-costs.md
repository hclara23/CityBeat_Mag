# Property import cost assessment

Reviewed 2026-11-02. Implementation approval covers local development and tests only, not paid API calls, subscriptions, cloud deployment, or production activation.

## Proposed pilot

- Start with the Firecrawl free account, no card or paid top-ups. Its published allowance is 1,000 credits per month. Basic scrape costs one credit per page; structured JSON extraction adds four credits per page and is not needed for the initial adapter.
- Example: 100 properties with five basic pages each consume about 500 credits, excluding discovery, retries and other account usage. A page is not a property: portfolio and amenities pages count separately.
- If eventually needed, Hobby costs USD 19 per month billed monthly for 5,000 credits. No subscription has been purchased. Do not enable automatic top-ups or use a paid account key without separate authorization.
- Docling has an MIT software license and no per-document license charge. CPU time, memory, storage and model artifacts still need resources. Local execution does not create a new hosting subscription.
- The initial bilingual draft approach uses reviewed structured facts and deterministic English/Spanish templates, not paid generative translation. Arbitrary marketing prose requires human translation or a separately approved model integration.
- The optional, disabled AI adapter uses GPT-4.1 mini. Published standard pricing is USD 0.40 per million input tokens and USD 1.60 per million output tokens. As an illustration, 100 imports averaging 6,000 input and 2,000 output tokens would cost USD 0.56 in model usage. Actual usage, retries and document lengths vary; this is not authorization or a guaranteed cap. No live model call has been made for this feature.

## Cloud costs are not approved

For illustration only, Google's published us-central1 instance-based rate is USD 0.000018 per vCPU-second plus USD 0.000002 per GiB-second. A hypothetical 2-vCPU, 4-GiB worker running 100 two-minute conversions would have compute cost:

`100 * 120 * (2 * 0.000018 + 4 * 0.000002) = USD 0.528`

This is not a total bill or a measured PDF runtime. It excludes startup/model-loading time, retries, deployment builds, container-image storage, document storage, network traffic, database operations and the web application. Region and billing mode change rates. Free allowances are shared across the billing account and must not be assumed available. Budget alerts are not spending caps.

Before deployment: benchmark representative permitted PDFs, choose the worker deployment and limits, estimate all resources, and obtain explicit approval for the one-time deployment and recurring/usage budget. Keep the integration inactive until then.

## Local evidence

The existing isolated Docling environment passed four pilot tests, including actual English HTML and Spanish DOCX conversion, in 19.745 seconds for the entire test process. This verifies a local conversion path only; it is not a PDF/OCR benchmark or a cloud cost prediction. New importer tests and limitations are recorded in the task verification notes.

A new synthetic one-page text PDF converted with the real offline worker in 18.251 seconds (including Python imports and model initialization). The free Apache-2.0 `docling-project/docling-layout-heron` model was downloaded separately without credentials into the repository's temporary model cache. Conversion itself denied network connections. The model merged adjacent labeled lines, which was reported for parser regression coverage. This single-page CPU result does not predict performance on complex or scanned brochures; OCR is disabled in the initial version.

After the parser correction, the actual Node brochure adapter launched the worker with its restricted environment, parsed that PDF, and returned correct name, address, city, state, ZIP, phone and website plus English/Spanish pool and fitness-center descriptions. That warmed-cache run took 6.837 seconds. Unknown property type remained empty for human selection. This exercised the real adapter, not a mocked conversion.

## Sources

- [Firecrawl pricing](https://www.firecrawl.dev/pricing)
- [Docling repository and license](https://github.com/docling-project/docling)
- [Cloud Run pricing](https://cloud.google.com/run/pricing)
- [GPT-4.1 mini pricing](https://developers.openai.com/api/docs/models/gpt-4.1-mini)
