export const PUBLIC_SUBMISSION_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

export const PUBLIC_SUBMISSION_MAX_IMAGE_BYTES = 10 * 1024 * 1024

type SubmissionImage = {
  name?: string | null
  type?: string | null
  size?: number | null
}

export type StoredPublicSubmission = {
  title?: unknown
  name?: unknown
  body_text?: unknown
  excerpt?: unknown
  category?: unknown
  tags?: unknown
  image_url?: unknown
  image_path?: unknown
  image_filename?: unknown
  created_at?: unknown
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

export function validatePublicSubmissionImage(image: SubmissionImage | null | undefined): string | null {
  if (!image || !image.size) return null
  if (!(PUBLIC_SUBMISSION_IMAGE_TYPES as readonly string[]).includes(image.type || '')) {
    return 'Use a JPEG, PNG, WebP, or GIF image.'
  }
  if (image.size > PUBLIC_SUBMISSION_MAX_IMAGE_BYTES) {
    return 'Image size must be 10 MB or less.'
  }
  return null
}

export function publicSubmissionArticleId(submissionId: string): string {
  return `submission-${submissionId}`
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 86)
}

function textToBlocks(value: string) {
  return value
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: paragraph }],
    }))
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20)
}

export function buildPublicSubmissionArticle(submissionId: string, submission: StoredPublicSubmission) {
  const title = text(submission.title)
  const bodyText = text(submission.body_text)
  if (!title || !bodyText) {
    throw new Error('Public submission is missing a title or body')
  }

  const articleId = publicSubmissionArticleId(submissionId)
  const originalImageName = text(submission.image_filename) || null
  const imageUrl = text(submission.image_url) || null
  const imagePath = text(submission.image_path) || null
  const author = text(submission.name, 'Community Contributor')
  const category = text(submission.category, 'news').toLowerCase()
  const excerpt = text(submission.excerpt) || bodyText.slice(0, 160)

  // Contributor email and source IP intentionally remain only on the private
  // submissions record. Articles can become public after editorial approval.
  return {
    id: articleId,
    data: {
      title,
      slug: `${slugify(title) || 'community-story'}-${submissionId.slice(0, 8).toLowerCase()}`,
      excerpt,
      content: textToBlocks(bodyText),
      content_es: [],
      category,
      author,
      tags: normalizeTags(submission.tags),
      status: 'pending_review',
      published_at: null,
      image_url: imageUrl,
      cover_image_path: imageUrl,
      submission_image_path: imagePath,
      submission_image_filename: originalImageName,
      submission_image_missing: Boolean(originalImageName && !imageUrl),
      origin: 'public_submission',
      source_submission_id: submissionId,
      created_at: submission.created_at || new Date().toISOString(),
      updated_at: submission.created_at || new Date().toISOString(),
    },
  }
}
