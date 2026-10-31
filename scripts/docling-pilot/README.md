# Local document-to-directory pilot

This experiment has no application runtime dependency, hosted service, scheduler,
database credentials or paid API. Docling runs in an isolated local virtual
environment. It produces **review-only drafts**, never listings or publications.

From the repository root (PowerShell):

```powershell
python -m venv .tmp/docling-pilot-venv
.tmp/docling-pilot-venv/Scripts/python.exe -m pip install -r scripts/docling-pilot/requirements.txt
.tmp/docling-pilot-venv/Scripts/python.exe -m unittest discover -s scripts/docling-pilot -v
.tmp/docling-pilot-venv/Scripts/python.exe scripts/docling-pilot/pilot.py .tmp/business.docx --output .tmp/business-draft.json
```

Installation downloads free packages. Conversion disables outbound socket
connections and model downloads. Inputs must be local DOCX or HTML files inside
the repository, at most 10 MiB. DOCX expanded contents are limited to 50 MiB and
2,000 entries. Outputs are confined to `.tmp`. Do not include customer documents
in commits.

## Tested contract

The real conversion test generates an English HTML brochure and Spanish DOCX
brochure with synthetic names, reserved example domains and fictional phone
numbers. It checks all seven extracted fields against their known answers.
Separate checks exercise all eleven cities, conflicting/missing values and
instruction-like document text. Documents are data; embedded instructions cannot
authorize actions.

The deliberately conservative extractor recognizes labelled lines: Business /
Negocio, Address / Dirección, City / Ciudad, State / Estado, Phone / Teléfono,
Website / Sitio web, Services / Servicios. Unlabelled or ambiguous fields remain
empty. A draft retains extracted evidence, the source filename and SHA-256 hash.
An address must agree with the structured city/state in the shared service-area
policy. Unknown or outside locations are marked `reject_or_correct`.

**Limits:** these synthetic samples do not establish accuracy on arbitrary real
brochures. Scanned PDFs, OCR, layout-model downloads, image extraction, automatic
category assignment and direct directory import are not enabled. A next pilot
would need representative, permitted local documents and a measured review of
extraction errors before extending supported formats. Local processing uses
disk, CPU and electricity; it introduces no new monthly service charge.

## Imported listing review

OSM and ScrapeFlow imports now create hidden records under `import_quality_review`.
Explicit outside cities are rejected; missing or conflicting locality evidence
stays in review. No ZIP or phone number substitutes for city/state evidence.
The shared policy is `packages/lib/src/directory/service-area.json`; Anthony
allows TX and NM, and Horizon City is an alias for Horizon.

In the admin directory, filter for hidden listings and edit an imported draft.
Correct the full address, review its source and duplicates, record verification
notes, and confirm the review checkbox. Saving records the reviewer and date and
clears only this import hold. Enable Published when ready, either in the same
save or afterward. Other holds and restricted-source records cannot be cleared
through this approval. Audit records retain the verification notes and source.

Existing live listings, ownership, billing and paid tiers are not migrated.
Imports use create-only writes; a concurrent duplicate insertion fails safely
instead of overwriting the existing record. Retry the import to skip existing
IDs. Imported branches no longer trigger automatic consolidation.

## Local web release check

```powershell
$env:CITYBEAT_BUILD_DIR = '.tmp/quality-next'
npm run build --workspace=@citybeat/web
```

The separate output directory avoids replacing the build files of an active
development server. The default production output remains `.next`.

## Import integration check

Start the Firestore emulator bound to `127.0.0.1:8088`, then from `apps/web`:

```powershell
$env:FIRESTORE_EMULATOR_HOST = '127.0.0.1:8088'
node --import tsx ../../scripts/directory-quality-local.ts
```

The script refuses any other database host. It runs both real import paths using
a local mock Overpass response and synthetic ScrapeFlow rows. It checks rejected
outside cities, held drafts, repeat imports, preservation of paid owner records,
and separate branches despite legacy publish/consolidate flags. It leaves only
synthetic fixtures in the emulator, including two public examples for a local
browser check. Stop the emulator after testing; do not run production ingestion
as a substitute for this check.
