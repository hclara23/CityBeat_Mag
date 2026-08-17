import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PUBLIC_SUBMISSION_MAX_IMAGE_BYTES,
  buildPublicSubmissionArticle,
  publicSubmissionArticleId,
  validatePublicSubmissionImage,
} from './public-submissions'

test('public submissions use a deterministic review article id', () => {
  assert.equal(publicSubmissionArticleId('abc123'), 'submission-abc123')
})

test('review copy preserves content but never copies private contributor fields', () => {
  const article = buildPublicSubmissionArticle('ABC123XYZ', {
    title: 'A Community Story',
    name: 'Jane Contributor',
    body_text: 'First paragraph.\n\nSecond paragraph.',
    excerpt: 'A short summary.',
    category: 'Culture',
    tags: [' Arts ', 'LOCAL'],
    image_filename: 'cover.png',
    created_at: '2026-08-17T00:00:00.000Z',
    // Deliberately supplied as extra runtime fields to prove they are omitted.
    email: 'private@example.com',
    source_ip: '192.0.2.1',
  } as any)

  assert.equal(article.id, 'submission-ABC123XYZ')
  assert.equal(article.data.status, 'pending_review')
  assert.equal(article.data.author, 'Jane Contributor')
  assert.equal(article.data.category, 'culture')
  assert.deepEqual(article.data.tags, ['arts', 'local'])
  assert.equal(article.data.content.length, 2)
  assert.equal(article.data.submission_image_missing, true)
  assert.equal('email' in article.data, false)
  assert.equal('source_ip' in article.data, false)
})

test('stored image is attached to the review copy and no longer marked missing', () => {
  const article = buildPublicSubmissionArticle('image1', {
    title: 'Photo Story',
    body_text: 'A complete story body.',
    image_filename: 'photo.jpg',
    image_url: 'https://storage.googleapis.com/example/contributions/image1/cover.webp',
    image_path: 'contributions/image1/cover.webp',
  })
  assert.equal(article.data.image_url?.endsWith('/cover.webp'), true)
  assert.equal(article.data.submission_image_missing, false)
})

test('public image validation accepts supported files and rejects unsafe input', () => {
  assert.equal(validatePublicSubmissionImage(null), null)
  assert.equal(validatePublicSubmissionImage({ name: 'photo.jpg', type: 'image/jpeg', size: 2000 }), null)
  assert.match(
    validatePublicSubmissionImage({ name: 'payload.svg', type: 'image/svg+xml', size: 2000 }) || '',
    /JPEG/,
  )
  assert.match(
    validatePublicSubmissionImage({
      name: 'huge.png',
      type: 'image/png',
      size: PUBLIC_SUBMISSION_MAX_IMAGE_BYTES + 1,
    }) || '',
    /10 MB/,
  )
})
