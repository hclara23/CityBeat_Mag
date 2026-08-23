// Minimal RFC 4180 CSV parser for FETCH_JSON's `Format: csv` mode — Texas
// regulatory boards (TSBDE, CBP) publish flat CSV dumps with no query API, so
// the whole file has to be fetched and parsed client-side before the
// Row filter in MAP_JSON_TO_LISTINGS can narrow it down.
//
// Handles: quoted fields, embedded commas/newlines inside quotes, doubled
// "" as an escaped quote. Header row becomes the object keys (matching the
// shape Socrata's JSON already returns, so both formats feed the same map).

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  const src = text.replace(/^﻿/, '') // strip BOM if present

  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
      continue
    }
    if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\r') {
      // swallow; \n (bare or following \r) ends the row
    } else if (c === '\n') {
      row.push(field)
      field = ''
      rows.push(row)
      row = []
    } else {
      field += c
    }
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  if (!rows.length) return []

  const header = rows[0]
  const out: Record<string, string>[] = []
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]
    if (cells.length === 1 && cells[0] === '') continue // trailing blank line
    const obj: Record<string, string> = {}
    for (let c = 0; c < header.length; c++) obj[header[c]] = cells[c] ?? ''
    out.push(obj)
  }
  return out
}
