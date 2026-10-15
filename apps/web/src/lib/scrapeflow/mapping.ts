// Pure helpers for MAP_JSON_TO_LISTINGS — factored out so they're unit-testable
// without spinning up a full ExecutionEnvironment.

export function getPath(obj: any, path: string): any {
  return String(path)
    .split('.')
    .filter(Boolean)
    .reduce((acc, key) => (acc === null || acc === undefined ? undefined : acc[key]), obj)
}

/**
 * Resolve one field-map template against a row:
 *  - "=literal text"  → the literal string after "="
 *  - "A+B+C"          → each path resolved, joined with a space, blanks dropped
 *  - "a.b.0"          → getPath
 */
export function getMappedValue(row: any, template: string | undefined): string | null {
  if (!template) return null
  if (template.startsWith('=')) return template.slice(1)
  if (template.includes('+')) {
    const parts = template
      .split('+')
      .map((p) => getPath(row, p.trim()))
      .filter((v) => v !== undefined && v !== null && String(v).trim() !== '')
      .map(String)
    return parts.length ? parts.join(' ') : null
  }
  const v = getPath(row, template)
  return v === undefined || v === null || v === '' ? null : String(v)
}

/**
 * Row filter: {field: value | [values]}, case-insensitive, trimmed, AND across keys.
 * A row survives only if every filter key's row value matches (or is one of the values).
 */
export function matchesRowFilter(row: any, filter: Record<string, unknown> | null | undefined): boolean {
  if (!filter) return true
  const norm = (v: unknown) => String(v ?? '').trim().toUpperCase()
  for (const [key, want] of Object.entries(filter)) {
    const actual = norm(row?.[key])
    const wanted = Array.isArray(want) ? want.map(norm) : [norm(want)]
    if (!wanted.includes(actual)) return false
  }
  return true
}

/** Accept MM/DD/YYYY or ISO-like source dates and reject missing/invalid/expired rows. */
export function isDateOnOrAfter(raw: unknown, minimum: string, now: Date = new Date()): boolean {
  const value = String(raw ?? '').trim()
  if (!value) return false
  const us = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  const parsed = us
    ? new Date(Date.UTC(Number(us[3]), Number(us[1]) - 1, Number(us[2])))
    : new Date(value)
  if (Number.isNaN(parsed.getTime())) return false

  const floorUtc = (date: Date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  const minimumDate = minimum.trim().toLowerCase() === 'today' ? now : new Date(minimum)
  if (Number.isNaN(minimumDate.getTime())) return false
  return floorUtc(parsed) >= floorUtc(minimumDate)
}
