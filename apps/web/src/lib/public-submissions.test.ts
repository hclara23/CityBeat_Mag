import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PUBLIC_SUBMISSION_MAX_IMAGE_BYTES,
  buildPublicSubmissionArticle,
  publicStorageObjectUrl,
  publicSubmissionArticleId,
  publicSubmissionImageCandidates,
  storedSubmissionImageUrl,
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
    image_recovery_status: 'missing',
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

test('legacy image URLs are resolved without accepting unsafe protocols', () => {
  assert.equal(
    storedSubmissionImageUrl({ coverImageUrl: 'https://cdn.example.com/story image.jpg' }),
    'https://cdn.example.com/story%20image.jpg',
  )
  assert.equal(storedSubmissionImageUrl({ image_url: 'javascript:alert(1)' }), null)
  assert.equal(
    storedSubmissionImageUrl({ image: { url: 'https://images.example.com/nested.webp' } }),
    'https://images.example.com/nested.webp',
  )
})

test('legacy image recovery searches only submission-scoped object paths', () => {
  assert.deepEqual(
    publicSubmissionImageCandidates('submission123', {
      image_filename: 'front photo.jpg',
      image_path: 'gs://legacy-bucket/custom/submission123/photo.png',
    }),
    [
      'custom/submission123/photo.png',
      'contributions/submission123/cover.webp',
      'submissions/submission123/cover.webp',
      'contributions/submission123/front photo.jpg',
      'submissions/submission123/front photo.jpg',
      'uploads/submissions/submission123/front photo.jpg',
    ],
  )
  assert.equal(
    publicStorageObjectUrl('citybeat-media', 'contributions/submission123/front photo.jpg'),
    'https://storage.googleapis.com/citybeat-media/contributions/submission123/front%20photo.jpg',
  )
  assert.equal(
    publicSubmissionImageCandidates('submission123', { image_path: '../another-user/photo.jpg' })
      .includes('../another-user/photo.jpg'),
    false,
  )
  assert.equal(
    publicSubmissionImageCandidates('submission123', { image_path: 'uploads/another-user/photo.jpg' })
      .includes('uploads/another-user/photo.jpg'),
    false,
  )
})

test('a filename is marked missing only after Storage recovery confirms it', () => {
  const unchecked = buildPublicSubmissionArticle('unchecked', {
    title: 'Unchecked Photo Story',
    body_text: 'The story body is safely preserved.',
    image_filename: 'photo.jpg',
  })
  assert.equal(unchecked.data.submission_image_missing, false)
  assert.equal(unchecked.data.submission_image_recovery_status, null)
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
  assert.equal(article.data.submission_image_url, article.data.image_url)
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
