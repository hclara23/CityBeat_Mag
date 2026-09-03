import crypto from 'crypto'

// Durable, first-party audit trail for every AI generation.
//
// Why this exists: CityBeat publishes AI-written news, sends AI-written sales
// mail, and answers customers with an AI concierge. Until now the ONLY record of
// any of that was Langfuse — a third-party service that is fully env-gated, so
// with no LANGFUSE_* keys set (the current state) nothing was recorded anywhere.
// For a publisher that is untenable: "which model wrote this story, from what
// source, when, and what did it actually say" must be answerable from our own
// data, months later, without depending on a vendor.
//
// Design rules:
//   • append-only — records are created, never updated or deleted in code
//   • self-checksummed — each record carries a SHA-256 over its own audited
//     fields (verifyAuditRecord). Be precise about what this buys: it detects
//     accidental corruption, partial writes and naive edits. It is NOT tamper
//     evidence against anyone who can write the collection, since that writer
//     can recompute the hash. Real tamper-evidence needs a keyed HMAC (key in
//     Secret Manager, never in the DB) or a hash chain anchored externally.
//   • complete over pretty — the raw prompt and output are kept (capped), because
//     a redacted-to-uselessness audit log is not an audit log
//   • secrets are still stripped: an API key must never be persisted, even if a
//     caller accidentally interpolates one into a prompt
//   • it must never break the AI feature it observes (all writes are best-effort)
//
// Pure + dependency-free so it unit-tests without Firebase.

export const AI_AUDIT_COLLECTION = 'ai_audit'
export const MAX_INPUT_CHARS = 3000
export const MAX_OUTPUT_CHARS = 6000

/** Patterns that must never be persisted, even inside a prompt. */
const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/sk-ant-[A-Za-z0-9_-]{8,}/g, 'sk-ant-[REDACTED]'],
  [/sk_(live|test)_[A-Za-z0-9]{8,}/g, 'sk_[REDACTED]'],
  [/\bBearer\s+[A-Za-z0-9._~+/-]{12,}=*/gi, 'Bearer [REDACTED]'],
  [/\bAKIA[0-9A-Z]{16}\b/g, 'AKIA[REDACTED]'],
  [/\b[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27}\b/g, '[REDACTED_TOKEN]'],
  [/"?(api[_-]?key|secret|password|token)"?\s*[:=]\s*"?[A-Za-z0-9._~+/-]{12,}"?/gi, '$1=[REDACTED]'],
]

/** Strip credential-shaped strings. Business/contact data is deliberately kept. */
export function redactSecrets(text: string): string {
  let out = String(text ?? '')
  for (const [re, replacement] of SECRET_PATTERNS) out = out.replace(re, replacement)
  return out
}

/** Flatten any prompt shape (string, message array, object) to auditable text. */
export function summarizeAiInput(input: unknown, max = MAX_INPUT_CHARS): string {
  let text: string
  if (typeof input === 'string') {
    text = input
  } else if (Array.isArray(input)) {
    text = input
      .map((m: any) => {
        if (typeof m === 'string') return m
        const role = m?.role ? `${m.role}: ` : ''
        const content =
          typeof m?.content === 'string'
            ? m.content
            : Array.isArray(m?.content)
              ? m.content.map((c: any) => c?.text ?? '').join(' ')
              : JSON.stringify(m?.content ?? m)
        return `${role}${content}`
      })
      .join('\n')
  } else if (input && typeof input === 'object') {
    try {
      text = JSON.stringify(input)
    } catch {
      text = '[unserializable input]'
    }
  } else {
    text = String(input ?? '')
  }
  return truncate(redactSecrets(text), max)
}

/** Pull the generated text out of an Anthropic Messages response. */
export function extractAiOutput(data: any, max = MAX_OUTPUT_CHARS): string {
  const blocks = data?.content
  let text = ''
  if (Array.isArray(blocks)) {
    text = blocks.map((b: any) => (typeof b?.text === 'string' ? b.text : '')).join('\n').trim()
  }
  if (!text && typeof data === 'string') text = data
  if (!text && data) {
    try {
      text = JSON.stringify(data)
    } catch {
      text = ''
    }
  }
  return truncate(redactSecrets(text), max)
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, max)}…[truncated ${s.length - max} chars]`
}

export interface AiAuditRecord {
  /** Call site / purpose, e.g. 'newsroom.rewrite', 'concierge.chat'. */
  purpose: string
  model: string
  input: string
  output: string
  input_tokens: number | null
  output_tokens: number | null
  latency_ms: number | null
  /** What this generation was about — article id, listing id, session id, … */
  subject: Record<string, unknown> | null
  /** Did the model call succeed? A refusal/error is as auditable as a success. */
  ok: boolean
  error: string | null
  created_at: string
}

/** The fields covered by the integrity hash (everything that matters evidentially). */
function canonicalize(rec: AiAuditRecord): string {
  return JSON.stringify([
    rec.purpose,
    rec.model,
    rec.input,
    rec.output,
    rec.input_tokens,
    rec.output_tokens,
    // Key-sorted: Firestore returns map fields sorted, so insertion-order
    // JSON.stringify would re-serialise differently on read and break verification.
    rec.subject ? JSON.stringify(Object.keys(rec.subject).sort().map((k) => [k, (rec.subject as any)[k]])) : null,
    rec.ok,
    rec.error,
    rec.created_at,
  ])
}

/** SHA-256 over the record's audited content — lets a later reader prove it is unaltered. */
export function auditContentHash(rec: AiAuditRecord): string {
  return crypto.createHash('sha256').update(canonicalize(rec)).digest('hex')
}

/**
 * Re-derive the hash and compare. False for any altered field.
 * Detects corruption and naive edits — NOT a determined writer, who can
 * recompute the hash. See the header note.
 */
export function verifyAuditRecord(rec: AiAuditRecord & { content_hash?: string }): boolean {
  if (!rec?.content_hash) return false
  return auditContentHash(rec) === rec.content_hash
}

/** Build the full stored record (hash included) from a raw generation. */
export function buildAuditRecord(input: {
  purpose: string
  promptInput: unknown
  responseData: any
  metadata?: Record<string, unknown> | null
  startTime?: Date | null
  now?: Date
  ok?: boolean
  error?: string | null
}): AiAuditRecord & { content_hash: string } {
  const now = input.now || new Date()
  // Firestore is initialised without ignoreUndefinedProperties, so a single
  // undefined value anywhere in metadata would reject the entire audit write.
  const md = input.metadata
    ? Object.fromEntries(Object.entries(input.metadata).filter(([, v]) => v !== undefined))
    : null
  const cleanMetadata = md && Object.keys(md).length > 0 ? md : null
  const usage = input.responseData?.usage
  const rec: AiAuditRecord = {
    purpose: String(input.purpose || 'unknown'),
    model: String(input.responseData?.model || 'unknown'),
    input: summarizeAiInput(input.promptInput),
    output: extractAiOutput(input.responseData),
    input_tokens: Number.isFinite(usage?.input_tokens) ? Number(usage.input_tokens) : null,
    output_tokens: Number.isFinite(usage?.output_tokens) ? Number(usage.output_tokens) : null,
    latency_ms: input.startTime ? Math.max(0, now.getTime() - input.startTime.getTime()) : null,
    subject: cleanMetadata,
    ok: input.ok !== false,
    error: input.error ? redactSecrets(String(input.error)).slice(0, 500) : null,
    created_at: now.toISOString(),
  }
  return { ...rec, content_hash: auditContentHash(rec) }
}
