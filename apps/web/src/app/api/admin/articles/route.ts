import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasEditorAccess } from '@citybeat/lib/roles'
import { adminDb } from '@citybeat/lib/firebase/admin'
import {
  notifyEditorialTeam,
  promotePublicSubmission,
  reconcilePendingPublicSubmissions,
} from '@/lib/public-submission-service'

export const dynamic = 'force-dynamic'

function toIso(v: any): string | null {
  if (!v) return null
  if (v?.toDate) return v.toDate().toISOString()
  return typeof v === 'string' ? v : null
}

export async function GET(request: NextRequest) {
  const user = await getServerUser()
  const profile = user ? await getServerUserProfile(user.id) : null
  // Shared helper (vs raw flags) so editors granted via profile_roles also pass.
  if (!user || !hasEditorAccess(profile)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  try {
    // Legacy public submissions were stored in `submissions` but never copied
    // into `articles`. Reconcile them on the authenticated review-queue read;
    // deterministic ids make this safe across reloads and concurrent editors.
    let recovery = { recovered: [] as Array<{ submissionId: string; articleId: string }>, failed: [] as Array<{ submissionId: string; error: string }> }
    if (!status || status === 'pending_review') {
      try {
        recovery = await reconcilePendingPublicSubmissions()
      } catch (error) {
        console.error('Public submission reconciliation failed:', error)
      }
    }

    let query: any = adminDb.collection('articles')
    if (status) query = query.where('status', '==', status)
    let snap = await query.get()
    let articles = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))

    // Re-check submission-scoped Storage objects for review copies that were
    // already created, then retry any alert-only failure. Both operations are
    // idempotent and preserve editorial changes.
    if (!status || status === 'pending_review') {
      const publicArticles = articles.filter(
        (article: any) => article.origin === 'public_submission' && article.source_submission_id,
      )
      await Promise.all(
        publicArticles.map(async (article: any) => {
          await promotePublicSubmission(String(article.source_submission_id)).catch((error) => {
            console.error('Submission image reconciliation failed:', article.id, error)
          })
          await notifyEditorialTeam(
            article.id,
            String(article.title || 'New community article'),
          ).catch((error) => {
              console.error('Editorial notification retry failed:', article.id, error)
          })
        }),
      )
      if (publicArticles.length > 0) {
        snap = await query.get()
        articles = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))
      }
    }

    // Resolve author names and creator emails.
    const authorsSnap = await adminDb.collection('authors').get()
    const authorMap = new Map<string, string>(
      authorsSnap.docs.map((d) => [d.id, (d.data() as any).name])
    )

    const creatorIds = [...new Set(articles.map((a: any) => a.created_by).filter(Boolean))]
    const creatorMap = new Map<string, any>()
    await Promise.all(
      creatorIds.map(async (cid: any) => {
        const p = await adminDb.collection('profiles').doc(cid).get()
        if (p.exists) creatorMap.set(cid, p.data())
      })
    )

    const submissionIds = [
      ...new Set(articles.map((article: any) => article.source_submission_id).filter(Boolean)),
    ]
    const submissionMap = new Map<string, any>()
    await Promise.all(
      submissionIds.map(async (submissionId: any) => {
        const submission = await adminDb.collection('submissions').doc(submissionId).get()
        if (submission.exists) submissionMap.set(submissionId, submission.data())
      }),
    )

    const transformed = articles
      .map((a: any) => {
        const creator = creatorMap.get(a.created_by)
        const submission = submissionMap.get(a.source_submission_id)
        return {
          ...a,
          created_at: toIso(a.created_at),
          published_at: toIso(a.published_at),
          author_email: creator?.email ?? submission?.email ?? null,
          author_name:
            (a.author_id && authorMap.get(a.author_id)) ||
            creator?.full_name ||
            creator?.email ||
            a.author ||
            'CityBeat',
        }
      })
      .sort((x: any, y: any) => (String(y.created_at) > String(x.created_at) ? 1 : -1))

    return NextResponse.json({ articles: transformed, recovery })
  } catch (error) {
    console.error('Admin articles error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
