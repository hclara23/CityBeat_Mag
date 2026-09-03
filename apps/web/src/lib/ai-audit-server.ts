import { adminDb } from '@citybeat/lib/firebase/admin'
import { AI_AUDIT_COLLECTION, buildAuditRecord } from './ai-audit'
import { reportFailure } from './alerts'

/** How long an AI audit record is retained before the Firestore TTL removes it. */
export const RETENTION_DAYS = 180

// Firestore side of the AI audit trail. Append-only: records are created and
// never updated, and each carries a SHA-256 over its own content so a later
// reader can prove it is unaltered (see verifyAuditRecord).
//
// This is called from traceClaude, which every Anthropic call site in the app
// already funnels through — so instrumenting that one function gives complete
// coverage, and a future call site that follows the existing pattern is audited
// automatically.

export async function recordAiCall(input: {
  purpose: string
  promptInput: unknown
  responseData: any
  metadata?: Record<string, unknown> | null
  startTime?: Date | null
  ok?: boolean
  error?: string | null
}): Promise<void> {
  try {
    const record = buildAuditRecord(input)
    await adminDb.collection(AI_AUDIT_COLLECTION).add({
      ...record,
      // Server-side clock for ordering; created_at (ISO) is the hashed,
      // evidential timestamp.
      recorded_at: new Date(),
      // Retention: prompts and outputs include end-user chat text and business
      // contact data, so records are not kept forever. A Firestore TTL policy on
      // this field deletes the document at that instant. Deliberately OUTSIDE the
      // hashed fields, so setting a retention date cannot invalidate the checksum.
      //   gcloud firestore fields ttls update expires_at       //     --collection-group=ai_audit --enable-ttl --project=kerstenblueprint
      expires_at: new Date(Date.now() + RETENTION_DAYS * 86400000),
    })
  } catch (error) {
    // Must never break the feature it observes — but a SILENT audit failure means
    // the log is quietly incomplete, which is worse than no log. Surface it once
    // (reportFailure dedupes to 3 emails per 6h).
    console.error('ai_audit write failed', input.purpose, error)
    await reportFailure('ai-audit', error, { purpose: input.purpose }).catch(() => {})
  }
}
