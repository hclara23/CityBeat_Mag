import { FieldValue } from 'firebase-admin/firestore'
import sharp from 'sharp'
import { adminDb, adminStorage } from '@citybeat/lib/firebase/admin'
import { hasEditorAccess, type PlatformProfile } from '@citybeat/lib/roles'
import { notifyUser } from './user-notifications'
import {
  buildPublicSubmissionArticle,
  publicStorageObjectUrl,
  publicSubmissionArticleId,
  publicSubmissionImageCandidates,
  storedSubmissionImageUrl,
  validatePublicSubmissionImage,
  type StoredPublicSubmission,
} from './public-submissions'

const MEDIA_BUCKET = process.env.MEDIA_BUCKET || 'kerstenblueprint-media'

export async function storePublicSubmissionImage(submissionId: string, file: File) {
  const validationError = validatePublicSubmissionImage(file)
  if (validationError) throw new Error(validationError)

  const optimized = await sharp(Buffer.from(await file.arrayBuffer()))
    .rotate()
    .resize(1600, null, { withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer()

  const path = `contributions/${submissionId}/cover.webp`
  const bucket = adminStorage.bucket(MEDIA_BUCKET)
  await bucket.file(path).save(optimized, {
    resumable: false,
    metadata: {
      contentType: 'image/webp',
      cacheControl: 'public,max-age=31536000,immutable',
    },
  })

  return {
    path,
    url: publicStorageObjectUrl(bucket.name, path),
  }
}

function hasImageHint(submission: StoredPublicSubmission): boolean {
  return Boolean(
    submission.image_filename ||
      submission.image_path ||
      submission.imagePath ||
      submission.cover_image_path ||
      submission.asset_id ||
      submission.assetId ||
      submission.image,
  )
}

function isLikelyImageObject(path: string): boolean {
  return /\.(?:avif|gif|jpe?g|png|webp)$/i.test(path)
}

// Legacy versions of /contribute sometimes retained only a filename or a
// Storage path. Check the submission-scoped objects before declaring the bytes
// missing; never scan the whole bucket, where duplicate filenames could attach
// another contributor's image.
export async function recoverStoredPublicSubmissionImage(submissionId: string) {
  const submissionRef = adminDb.collection('submissions').doc(submissionId)
  const snapshot = await submissionRef.get()
  if (!snapshot.exists) throw new Error(`Submission ${submissionId} was not found`)

  const submission = (snapshot.data() || {}) as StoredPublicSubmission
  const existingUrl = storedSubmissionImageUrl(submission)
  if (existingUrl) {
    if (submission.image_recovery_status !== 'found') {
      await submissionRef.set(
        {
          image_url: existingUrl,
          image_recovery_status: 'found',
          image_checked_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
    }
    return { status: 'found' as const, url: existingUrl, path: null }
  }

  if (!hasImageHint(submission)) {
    return { status: 'not_attached' as const, url: null, path: null }
  }
  if (submission.image_recovery_status === 'missing') {
    return { status: 'missing' as const, url: null, path: null }
  }

  const bucket = adminStorage.bucket(MEDIA_BUCKET)
  try {
    const candidates = publicSubmissionImageCandidates(submissionId, submission)
    let foundPath: string | null = null
    for (const path of candidates) {
      const [exists] = await bucket.file(path).exists()
      if (exists) {
        foundPath = path
        break
      }
    }

    if (!foundPath) {
      const prefixes = [`contributions/${submissionId}/`, `submissions/${submissionId}/`]
      for (const prefix of prefixes) {
        const [files] = await bucket.getFiles({ prefix, maxResults: 20, autoPaginate: false })
        const image = files.find((file) => isLikelyImageObject(file.name))
        if (image) {
          foundPath = image.name
          break
        }
      }
    }

    if (foundPath) {
      const url = publicStorageObjectUrl(bucket.name, foundPath)
      await submissionRef.set(
        {
          image_url: url,
          image_path: foundPath,
          image_recovery_status: 'found',
          image_recovered_at: FieldValue.serverTimestamp(),
          image_checked_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      return { status: 'found' as const, url, path: foundPath }
    }

    await submissionRef.set(
      {
        image_recovery_status: 'missing',
        image_checked_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    return { status: 'missing' as const, url: null, path: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await submissionRef
      .set(
        {
          image_recovery_status: 'check_failed',
          image_recovery_error: message.slice(0, 300),
          image_checked_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      .catch(() => {})
    return { status: 'check_failed' as const, url: null, path: null }
  }
}

export async function promotePublicSubmission(submissionId: string) {
  await recoverStoredPublicSubmissionImage(submissionId)
  const submissionRef = adminDb.collection('submissions').doc(submissionId)
  const articleId = publicSubmissionArticleId(submissionId)
  const articleRef = adminDb.collection('articles').doc(articleId)
  let title = 'New community article'
  let created = false
  let status = 'pending_review'

  await adminDb.runTransaction(async (transaction) => {
    const [submissionDoc, articleDoc] = await Promise.all([
      transaction.get(submissionRef),
      transaction.get(articleRef),
    ])
    if (!submissionDoc.exists) throw new Error(`Submission ${submissionId} was not found`)

    const submission = submissionDoc.data() || {}
    const article = buildPublicSubmissionArticle(submissionId, submission)
    title = article.data.title
    created = !articleDoc.exists

    if (!articleDoc.exists) {
      transaction.create(articleRef, article.data)
    } else {
      // A retry must never overwrite editorial changes. It may only attach a
      // newly completed image upload when the review copy still has no image.
      const existing = articleDoc.data() || {}
      status = typeof existing.status === 'string' ? existing.status : 'pending_review'
      const articleUpdates: Record<string, unknown> = {}
      if (!existing.image_url && article.data.image_url) {
        articleUpdates.image_url = article.data.image_url
        articleUpdates.cover_image_path = article.data.cover_image_path
      }

      const desiredFilename = article.data.submission_image_filename || existing.submission_image_filename || null
      const desiredPath = article.data.submission_image_path || existing.submission_image_path || null
      const desiredSubmissionUrl = article.data.submission_image_url || existing.submission_image_url || null
      const desiredRecoveryStatus =
        article.data.submission_image_recovery_status || existing.submission_image_recovery_status || null
      const desiredMissing = Boolean(
        !existing.image_url && !article.data.image_url && article.data.submission_image_missing,
      )
      if (existing.submission_image_filename !== desiredFilename) {
        articleUpdates.submission_image_filename = desiredFilename
      }
      if (existing.submission_image_path !== desiredPath) {
        articleUpdates.submission_image_path = desiredPath
      }
      if (existing.submission_image_url !== desiredSubmissionUrl) {
        articleUpdates.submission_image_url = desiredSubmissionUrl
      }
      if (existing.submission_image_recovery_status !== desiredRecoveryStatus) {
        articleUpdates.submission_image_recovery_status = desiredRecoveryStatus
      }
      if (Boolean(existing.submission_image_missing) !== desiredMissing) {
        articleUpdates.submission_image_missing = desiredMissing
      }
      if (Object.keys(articleUpdates).length > 0) {
        articleUpdates.updated_at = FieldValue.serverTimestamp()
        transaction.set(articleRef, articleUpdates, { merge: true })
      }
    }

    const submissionUpdates: Record<string, unknown> = {}
    if (submission.status !== status) submissionUpdates.status = status
    if (submission.article_id !== articleId) submissionUpdates.article_id = articleId
    if (!submission.queued_at) submissionUpdates.queued_at = FieldValue.serverTimestamp()
    if (Object.keys(submissionUpdates).length > 0) {
      submissionUpdates.updated_at = FieldValue.serverTimestamp()
      transaction.set(submissionRef, submissionUpdates, { merge: true })
    }
  })

  return { articleId, title, created, status }
}

async function editorialProfiles() {
  const snapshot = await adminDb.collection('profiles').get()
  return snapshot.docs
    .map((doc) => ({
      ...(doc.data() as PlatformProfile & { email?: unknown }),
      userId: doc.id,
    }))
    .filter((profile) => hasEditorAccess(profile))
}

export async function notifyEditorialTeam(articleId: string, title: string) {
  const profiles = await editorialProfiles()
  if (profiles.length === 0) throw new Error('No editorial profiles are configured')

  const deliveries = await Promise.all(
    profiles.map((profile) =>
      notifyUser({
        userId: profile.userId,
        notificationId: `article-submission-${articleId}`,
        type: 'article_submission',
        title: `New article submitted: ${title}`,
        title_es: `Nuevo artículo enviado: ${title}`,
        body: 'A community contributor submitted an article for editorial review.',
        body_es: 'Un colaborador de la comunidad envió un artículo para revisión editorial.',
        link: `/admin/review/${articleId}`,
        email: typeof profile.email === 'string' ? profile.email : null,
      }),
    ),
  )
  if (deliveries.some((delivery) => !delivery.inAppCreated && !delivery.deduped)) {
    throw new Error('One or more editorial inbox notifications could not be stored')
  }
  return { recipients: profiles.length, deliveries }
}

export async function reconcilePendingPublicSubmissions(limit = 25) {
  const snapshot = await adminDb
    .collection('submissions')
    .where('status', '==', 'pending')
    .get()

  // Sort in memory so the just-reported submission is always recovered first
  // without introducing a Firestore composite-index dependency.
  const pending = [...snapshot.docs]
    .sort((left, right) => {
      const leftMs = left.data().created_at?.toMillis?.() || 0
      const rightMs = right.data().created_at?.toMillis?.() || 0
      return rightMs - leftMs
    })
    .slice(0, limit)

  const recovered: Array<{ submissionId: string; articleId: string }> = []
  const failed: Array<{ submissionId: string; error: string }> = []

  for (const doc of pending) {
    try {
      const promoted = await promotePublicSubmission(doc.id)
      if (promoted.status === 'pending_review') {
        await notifyEditorialTeam(promoted.articleId, promoted.title)
      }
      recovered.push({ submissionId: doc.id, articleId: promoted.articleId })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failed.push({ submissionId: doc.id, error: message.slice(0, 200) })
      console.error('public submission recovery error:', doc.id, error)
    }
  }

  return { recovered, failed }
}
