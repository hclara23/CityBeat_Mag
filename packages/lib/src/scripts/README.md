# Directory ingest scripts

## Crawlee OpenStreetMap ingest

Use this path for production directory expansion. It reads public OpenStreetMap data through Overpass, deduplicates businesses, and writes candidates to `directory_listings` as unpublished, unclaimed basic listings.

Dry run:

```bash
npm run directory:ingest --workspace=@citybeat/lib -- --limit=25
```

Write unpublished review candidates:

```bash
npm run directory:ingest:write --workspace=@citybeat/lib -- --limit=250
```

Optional category filter:

```bash
npm run directory:ingest --workspace=@citybeat/lib -- --category=Restaurant --limit=25
```

Safety defaults:

- The script uses Crawlee with single-request concurrency and retries.
- The default source is OpenStreetMap/Overpass, not Google Maps.
- Writes require Supabase server credentials.
- Imported listings are `is_published = false` so editors can review them before they appear publicly.
- Source identifiers are stored as `google_place_id = osm:<type>:<id>` to reuse the existing unique constraint.
