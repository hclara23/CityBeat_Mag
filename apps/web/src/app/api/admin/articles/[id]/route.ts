import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { translateArticleToEs } from '@/lib/translate'
import { hasEditorAccess } from '@citybeat/lib/roles'

export const dynamic = 'force-dynamic'

function toIso(v: any): string | null {
  if (!v) return null
  if (v?.toDate) return v.toDate().toISOString()
  return typeof v === 'string' ? v : null
}

async function requireEditor() {
  const user = await getServerUser()
  const profile = user ? await getServerUserProfile(user.id) : null
  if (!user || !hasEditorAccess(profile)) return null
  // Publishing is a privileged, public-facing action: the admin PAGES force
  // 2FA enrollment, and this API must not accept a password-only session.
  if (!profile?.mfa_enabled) return null
  return user
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireEditor())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { status, rejection_reason } = await request.json()

  if (!['published', 'rejected', 'draft'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (status === 'published') {
    updateData.published_at = new Date().toISOString()
  }
  if (status === 'rejected' && rejection_reason) {
    updateData.rejection_reason = rejection_reason
  }

  try {
    const ref = adminDb.collection('articles').doc(id)
    // Existence FIRST: set({merge}) creates the doc, so the old order wrote a
    // ghost "Untitled" article from any mistyped/stale id and the 404 branch
    // below it could never fire.
    const doc = await ref.get()
    if (!doc.exists) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    await ref.set(updateData, { merge: true })
    const data = { ...(doc.data() as any), ...updateData }

    if (data.source_submission_id) {
      await adminDb.collection('submissions').doc(data.source_submission_id).set(
        {
          status,
          article_id: id,
          reviewed_at: new Date().toISOString(),
        },
        { merge: true },
      )
    }

    // When publishing, keep the Spanish translation in sync (best-effort).
    if (status === 'published') {
      await translateArticleToEs(ref, { title: data.title, excerpt: data.excerpt, content: data.content })
    }

    return NextResponse.json({
      article: { id: doc.id, ...data, created_at: toIso(data.created_at), published_at: toIso(data.published_at) },
    })
  } catch (error) {
    console.error('Admin PATCH error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireEditor())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  try {
    const doc = await adminDb.collection('articles').doc(id).get()
    if (!doc.exists) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const data = doc.data() as any

    let bylineName: string | undefined
    if (data.author_id) {
      const aDoc = await adminDb.collection('authors').doc(data.author_id).get()
      bylineName = aDoc.exists ? (aDoc.data() as any).name : undefined
    }
    let creator: any
    if (data.created_by) {
      const pDoc = await adminDb.collection('profiles').doc(data.created_by).get()
      creator = pDoc.exists ? pDoc.data() : undefined
    }
    let submission: any
    if (data.source_submission_id) {
      const submissionDoc = await adminDb.collection('submissions').doc(data.source_submission_id).get()
      submission = submissionDoc.exists ? submissionDoc.data() : undefined
    }

    return NextResponse.json({
      article: {
        id: doc.id,
        ...data,
        created_at: toIso(data.created_at),
        published_at: toIso(data.published_at),
        author: {
          email: creator?.email || submission?.email,
          full_name: bylineName || creator?.full_name || creator?.email || data.author,
        },
      },
    })
  } catch (error) {
    console.error('Admin GET error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
