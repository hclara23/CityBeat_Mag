import assert from 'node:assert/strict'
import test from 'node:test'
import {
  NEWSROOM_MAX_REWRITE_ATTEMPTS,
  NEWSROOM_RETRY_DELAY_MS,
  nextRetryRecord,
  shouldAttemptProcessedNews,
} from './newsroom-processing'

test('unseen and legacy provider-failure records are eligible for processing', () => {
  assert.equal(shouldAttemptProcessedNews(undefined, 1000), true)
  assert.equal(shouldAttemptProcessedNews({ publishable: false }, 1000), true)
})

test('published and editorially rejected records remain deduplicated', () => {
  assert.equal(shouldAttemptProcessedNews({ publishable: true }, 1000), false)
  assert.equal(shouldAttemptProcessedNews({ article_id: 'article-1' }, 1000), false)
  assert.equal(
    shouldAttemptProcessedNews({ publishable: false, outcome: 'editorial_reject' }, 1000),
    false,
  )
})

test('retryable errors wait until due and stop after the bounded attempt count', () => {
  const due = new Date(1000).toISOString()
  const future = new Date(2000).toISOString()

  assert.equal(
    shouldAttemptProcessedNews(
      { publishable: false, outcome: 'retryable_error', retry_count: 1, retry_after: due },
      1000,
    ),
    true,
  )
  assert.equal(
    shouldAttemptProcessedNews(
      { publishable: false, outcome: 'retryable_error', retry_count: 1, retry_after: future },
      1000,
    ),
    false,
  )
  assert.equal(
    shouldAttemptProcessedNews({
      publishable: false,
      outcome: 'retryable_error',
      retry_count: NEWSROOM_MAX_REWRITE_ATTEMPTS,
      retry_after: due,
    }, 1000),
    false,
  )
})

test('retry records increment attempts and store only a bounded sanitized reason', () => {
  const result = nextRetryRecord(
    { publishable: false, outcome: 'retryable_error', retry_count: 1 },
    'anthropic_http_429'.repeat(10),
    1000,
  )

  assert.equal(result.retry_count, 2)
  assert.equal(result.retry_after, new Date(1000 + NEWSROOM_RETRY_DELAY_MS).toISOString())
  assert.equal(result.failure_reason.length, 80)
  assert.equal(result.outcome, 'retryable_error')
})
