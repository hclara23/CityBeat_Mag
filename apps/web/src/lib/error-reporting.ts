import crypto from 'crypto'

// Make bugs report themselves.
//
// Before this, a client-side exception reached nobody: the error boundaries
// called console.error in the USER's browser, which no server ever sees, and
// server-side failures were only reported from crons and the Stripe webhook via
// reportFailure. A user hitting a broken checkout button produced exactly zero
// signal. This module is the shared spine: it turns any error — browser or
// server — into a stable FINGERPRINT so occurrences group into one issue with a
// count, instead of ten thousand identical emails.
//
// Grouping is the whole trick. A deploy that breaks one component throws the same
// error for every visitor; alerting per occurrence is how you train yourself to
// ignore alerts. We alert once when a fingerprint is FIRST seen, then just count.
//
// Pure + dependency-free so it unit-tests without Firebase.

export const ERROR_COLLECTION = 'error_reports'
export const MAX_MESSAGE_CHARS = 500
export const MAX_STACK_CHARS = 4000

export type ErrorSource = 'client' | 'server' | 'cron' | 'webhook'

export interface ErrorInput {
  message: string
  stack?: string | null
  /** Route or cron/job name where it happened. */
  route?: string | null
  source: ErrorSource
  /** Deploy identifier, so "started after the 3pm deploy" is answerable. */
  release?: string | null
  userAgent?: string | null
  extra?: Record<string, unknown> | null
}

/**
 * Noise that is either not ours, not actionable, or already self-healing.
 * Filtering at the edge keeps the board readable — an unreadable board is
 * functionally the same as no board.
 */
const IGNORED = [
  /ResizeObserver loop/i, // benign browser quirk, fires constantly
  /^Script error\.?$/i, // cross-origin script with no detail — unactionable
  /ChunkLoadError/i, // deploy transient; the error boundary already auto-reloads
  /Loading chunk \d+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /NetworkError when attempting to fetch/i, // user's connection dropped
  /The operation was aborted/i,
  /AbortError/i,
  /chrome-extension:|moz-extension:|safari-extension:/i, // injected by an add-on
  /Non-Error promise rejection captured with value: undefined/i,
]

export function shouldIgnoreError(message: string, stack?: string | null): boolean {
  const msg = String(message || '').trim()
  if (!msg) return true
  // Test message and stack SEPARATELY: concatenating them always appended a
  // newline, which silently broke every end-anchored pattern — JS `$` without
  // /m/ matches only the true end of the string, so the exact-match rule for
  // "Script error." never fired against "Script error.\n".
  return IGNORED.some((re) => re.test(msg) || (stack ? re.test(stack) : false))
}

/**
 * Strip the parts of a message that vary per occurrence so the same bug hashes
 * to one fingerprint: ids, numbers, urls, quoted values, hex blobs.
 */
export function normalizeErrorMessage(message: string): string {
  return String(message || '')
    .slice(0, MAX_MESSAGE_CHARS)
    .replace(/https?:\/\/[^\s"')]+/g, '<url>')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<uuid>')
    .replace(/\b[0-9a-f]{16,}\b/gi, '<hash>')
    .replace(/\b\d[\d,._]*\b/g, '<n>')
    .replace(/(["'`])(?:(?!\1).){1,80}\1/g, '<str>')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * The first stack frame that belongs to OUR code — the line a developer would
 * open. Vendor/runtime frames are skipped so two bugs surfacing through the same
 * React internals don't collapse into one issue.
 */
export function topAppFrame(stack?: string | null): string {
  if (!stack) return ''
  const lines = String(stack).split('\n').slice(0, 40)
  for (const raw of lines) {
    const line = raw.trim()
    if (!line.startsWith('at ') && !line.includes('@')) continue
    if (/node_modules|webpack-internal|next\/dist|react-dom|node:internal/.test(line)) continue
    // No parens in the character class — including them captured the opening
    // "(" from "at fn (src/x.tsx:1:1)" into the frame itself.
    const m = line.match(/([\w./\\-]+\.(?:tsx?|jsx?|mjs))(?::(\d+))?/)
    if (m) {
      let file = m[1]
      // Bundle filenames carry a per-build content hash; strip it so the same bug
      // doesn't become a brand-new issue on every deploy. Detect build output from
      // the RAW line, not the extracted filename: real production frames are
      // percent-encoded URLs like
      // /_next/static/chunks/app/%5Blocale%5D/directory/page-9f2a1b.js and the
      // filename regex stops at the '%', so testing `file` never matched.
      // Restricted to build output so a source file like `my-component.tsx` is
      // left alone.
      if (/(?:chunks|_next)\//.test(line)) file = file.replace(/-[a-z0-9]{6,}\.(?=[a-z]+$)/i, '.')
      return `${file}:${m[2] || '0'}`
    }
  }
  return ''
}

/**
 * Stable id for "this bug". Same bug across users, sessions and (deliberately)
 * across releases → one row whose count climbs, so an operator sees severity.
 */
export function fingerprintError(input: Pick<ErrorInput, 'message' | 'stack' | 'route' | 'source'>): string {
  const basis = [
    input.source,
    normalizeErrorMessage(input.message),
    topAppFrame(input.stack),
    // Route is included only for server errors: the same client component can be
    // reached from many paths, and splitting by path would fragment the group.
    input.source === 'client' ? '' : String(input.route || ''),
  ].join('|')
  return crypto.createHash('sha256').update(basis).digest('hex').slice(0, 16)
}

/** Severity heuristic — what deserves a human tonight vs. a Monday review. */
export function classifySeverity(input: Pick<ErrorInput, 'message' | 'route' | 'source'>): 'critical' | 'error' {
  // TRUST BOUNDARY: `message` on a client report is attacker-controlled (the
  // intake is public), so it must never be able to elevate its own severity —
  // otherwise anyone can manufacture "critical" alerts by typing "stripe".
  // Client reports are capped at 'error'; only first-party sources can be
  // critical, and for those the keyword heuristic is safe.
  if (input.source === 'client') return 'error'
  if (input.source === 'webhook' || input.source === 'cron') return 'critical'
  const hay = `${input.message || ''} ${input.route || ''}`.toLowerCase()
  // Anything on a money path is critical by definition.
  if (/stripe|checkout|payout|webhook|payment|invoice|transfer|refund/.test(hay)) return 'critical'
  return 'error'
}

export interface NormalizedError {
  fingerprint: string
  message: string
  stack: string | null
  route: string | null
  source: ErrorSource
  release: string | null
  user_agent: string | null
  extra: Record<string, unknown> | null
  severity: 'critical' | 'error'
}

/** Validate + normalize an inbound report. Returns null when it should be dropped. */
export function normalizeErrorInput(raw: Partial<ErrorInput> & { source: ErrorSource }): NormalizedError | null {
  const message = String(raw.message || '').slice(0, MAX_MESSAGE_CHARS).trim()
  const stack = raw.stack ? String(raw.stack).slice(0, MAX_STACK_CHARS) : null
  if (shouldIgnoreError(message, stack)) return null

  const route = raw.route ? String(raw.route).slice(0, 200) : null
  const source: ErrorSource = (['client', 'server', 'cron', 'webhook'] as const).includes(raw.source)
    ? raw.source
    : 'client'

  return {
    fingerprint: fingerprintError({ message, stack, route, source }),
    message,
    stack,
    route,
    source,
    release: raw.release ? String(raw.release).slice(0, 60) : null,
    user_agent: raw.userAgent ? String(raw.userAgent).slice(0, 300) : null,
    extra: raw.extra && typeof raw.extra === 'object' ? raw.extra : null,
    severity: classifySeverity({ message, route, source }),
  }
}
