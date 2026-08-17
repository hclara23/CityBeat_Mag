import { FieldValue } from 'firebase-admin/firestore'
import sharp from 'sharp'
import { adminDb, adminStorage } from '@citybeat/lib/firebase/admin'
import { hasEditorAccess, type PlatformProfile } from '@citybeat/lib/roles'
import { notifyUser } from './user-notifications'
import {
  buildPublicSubmissionArticle,
  publicSubmissionArticleId,
  validatePublicSubmissionImage,
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
    url: `https://storage.googleapis.com/${bucket.name}/${path}`,
  }
}

export async function promotePublicSubmission(submissionId: string) {
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
      if (!existing.image_url && article.data.image_url) {
        transaction.set(
          articleRef,
          {
            image_url: article.data.image_url,
            cover_image_path: article.data.cover_image_path,
            submission_image_path: article.data.submission_image_path,
            submission_image_missing: false,
            updated_at: FieldValue.serverTimestamp(),
          },
          { merge: true },
        )
      }
    }

    transaction.set(
      submissionRef,
      {
        status,
        article_id: articleId,
        queued_at: submission.queued_at || FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
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
