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
  imageUrl?: unknown
  image_path?: unknown
  imagePath?: unknown
  cover_image_url?: unknown
  coverImageUrl?: unknown
  cover_image_path?: unknown
  asset_id?: unknown
  assetId?: unknown
  image?: unknown
  image_filename?: unknown
  image_recovery_status?: unknown
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

function safeHttpUrl(value: unknown): string | null {
  const candidate = text(value)
  if (!candidate) return null
  try {
    const url = new URL(candidate)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function nestedImageValue(image: unknown, key: 'url' | 'path'): unknown {
  if (!image || typeof image !== 'object' || Array.isArray(image)) return null
  return (image as Record<string, unknown>)[key]
}

export function storedSubmissionImageUrl(submission: StoredPublicSubmission): string | null {
  const candidates = [
    submission.image_url,
    submission.imageUrl,
    submission.cover_image_url,
    submission.coverImageUrl,
    submission.cover_image_path,
    submission.asset_id,
    submission.assetId,
    nestedImageValue(submission.image, 'url'),
  ]
  for (const candidate of candidates) {
    const url = safeHttpUrl(candidate)
    if (url) return url
  }
  return null
}

function storagePath(value: unknown): string | null {
  let candidate = text(value)
  if (!candidate || safeHttpUrl(candidate)) return null
  if (candidate.startsWith('gs://')) {
    candidate = candidate.slice(5)
    const firstSlash = candidate.indexOf('/')
    candidate = firstSlash >= 0 ? candidate.slice(firstSlash + 1) : ''
  }
  candidate = candidate.replace(/^\/+/, '')
  if (!candidate || candidate.length > 1024 || candidate.includes('\\')) return null
  if (candidate.split('/').some((part) => !part || part === '.' || part === '..')) return null
  return candidate
}

function safeFilename(value: unknown): string | null {
  const candidate = text(value)
  if (!candidate) return null
  const name = candidate.split(/[\\/]/).pop()?.trim() || ''
  return name && name !== '.' && name !== '..' && name.length <= 240 ? name : null
}

export function publicSubmissionImageCandidates(
  submissionId: string,
  submission: StoredPublicSubmission,
): string[] {
  const explicit = [
    submission.image_path,
    submission.imagePath,
    submission.cover_image_path,
    submission.asset_id,
    submission.assetId,
    nestedImageValue(submission.image, 'path'),
  ]
    .map(storagePath)
    .filter(
      (value): value is string =>
        value !== null && value.split('/').some((part) => part === submissionId),
    )

  const filename = safeFilename(submission.image_filename)
  const conventional = [
    `contributions/${submissionId}/cover.webp`,
    `submissions/${submissionId}/cover.webp`,
    ...(filename
      ? [
          `contributions/${submissionId}/${filename}`,
          `submissions/${submissionId}/${filename}`,
          `uploads/submissions/${submissionId}/${filename}`,
        ]
      : []),
  ]

  return [...new Set([...explicit, ...conventional])]
}

export function publicStorageObjectUrl(bucketName: string, path: string): string {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  return `https://storage.googleapis.com/${bucketName}/${encodedPath}`
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
  const imageUrl = storedSubmissionImageUrl(submission)
  const imagePath = storagePath(submission.image_path) || storagePath(submission.imagePath)
  const imageRecoveryStatus = text(submission.image_recovery_status) || null
  const author = text(submission.name) || 'Community Contributor'
  const category = (text(submission.category) || 'news').toLowerCase()
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
      submission_image_url: imageUrl,
      submission_image_filename: originalImageName,
      submission_image_recovery_status: imageRecoveryStatus,
      submission_image_missing: Boolean(
        originalImageName && !imageUrl && imageRecoveryStatus === 'missing',
      ),
      origin: 'public_submission',
      source_submission_id: submissionId,
      created_at: submission.created_at || new Date().toISOString(),
      updated_at: submission.created_at || new Date().toISOString(),
    },
  }
}
