export const NEWSROOM_MAX_REWRITE_ATTEMPTS = 3
export const NEWSROOM_RETRY_DELAY_MS = 60 * 60 * 1000

export type ProcessedNewsRecord = {
  publishable?: boolean
  article_id?: string
  outcome?: 'editorial_reject' | 'retryable_error'
  retry_count?: number
  retry_after?: string | Date | { toMillis?: () => number }
}

function retryAfterMillis(value: ProcessedNewsRecord['retry_after']): number {
  if (!value) return 0
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return typeof value.toMillis === 'function' ? value.toMillis() : 0
}

// Existing records created before retry outcomes were tracked are eligible once
// so provider failures that were mislabeled as editorial rejections can recover.
export function shouldAttemptProcessedNews(
  record: ProcessedNewsRecord | undefined,
  nowMs = Date.now(),
): boolean {
  if (!record) return true
  if (record.publishable || record.article_id || record.outcome === 'editorial_reject') return false
  if (!record.outcome) return record.publishable === false
  if (record.outcome !== 'retryable_error') return false

  const attempts = Math.max(0, Number(record.retry_count) || 0)
  return attempts < NEWSROOM_MAX_REWRITE_ATTEMPTS && retryAfterMillis(record.retry_after) <= nowMs
}

export function nextRetryRecord(
  previous: ProcessedNewsRecord | undefined,
  reason: string,
  nowMs = Date.now(),
) {
  const retryCount = Math.max(0, Number(previous?.retry_count) || 0) + 1
  return {
    publishable: false,
    outcome: 'retryable_error' as const,
    failure_reason: reason.slice(0, 80),
    retry_count: retryCount,
    retry_after: new Date(nowMs + NEWSROOM_RETRY_DELAY_MS).toISOString(),
  }
}
