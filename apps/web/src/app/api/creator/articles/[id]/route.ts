import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { FieldValue } from 'firebase-admin/firestore'
import { translateArticleToEs } from '@/lib/translate'
import { hasEditorAccess } from '@citybeat/lib/roles'

async function getCategoryId(slug?: string) {
  const categorySlug = slug || 'news'
  const snapshot = await adminDb.collection('categories').where('slug', '==', categorySlug).limit(1).get()

  if (!snapshot.empty) return snapshot.docs[0].id

  const title = categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1)
  const newCatRef = await adminDb.collection('categories').add({
    slug: categorySlug,
    name_en: title,
    name_es: title,
    created_at: FieldValue.serverTimestamp()
  })

  return newCatRef.id
}

async function clearArticleTags(articleId: string) {
  const snap = await adminDb.collection('article_tags').where('article_id', '==', articleId).get()
  if (snap.empty) return
  const batch = adminDb.batch()
  snap.docs.forEach((d) => batch.delete(d.ref))
  await batch.commit()
}

function textToContent(text: string) {
  return text.split('\n\n').filter(Boolean).map((paragraph, i) => ({
    type: 'paragraph',
    content: [{ type: 'text', text: paragraph.trim() }],
  }))
}

function contentToText(content: any): string {
  if (!Array.isArray(content)) return ''
  return content
    .map(block => {
      if (block.type === 'paragraph' && Array.isArray(block.content)) {
        return block.content.map((c: any) => c.text || '').join('')
      }
      return ''
    })
    .filter(Boolean)
    .join('\n\n')
}

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const profile = await getServerUserProfile(user.id)

  try {
    const docSnap = await adminDb.collection('articles').doc(id).get()

    if (!docSnap.exists) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    const article = { id: docSnap.id, ...docSnap.data() } as any

    if (article.created_by !== user.id && !hasEditorAccess(profile)) {
       return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    // Resolve Category Slug
    let categorySlug = article.category_id
    if (article.category_id) {
       const catSnap = await adminDb.collection('categories').doc(article.category_id).get()
       if (catSnap.exists) categorySlug = catSnap.data()?.slug || article.category_id
    }

    // Resolve Author Name
    let authorName = ''
    if (article.author_id) {
       const authSnap = await adminDb.collection('authors').doc(article.author_id).get()
       if (authSnap.exists) authorName = authSnap.data()?.name || ''
    }

    // Transform for frontend compatibility
    const transformedArticle = {
      ...article,
      _id: article.id,
      _createdAt: article.created_at?.toDate ? article.created_at.toDate().toISOString() : article.created_at,
      imageUrl: article.image_url,
      category: categorySlug,
      authorName,
      content: article.content,
      bodyText: contentToText(article.content),
    }

    return NextResponse.json({ article: transformedArticle })
  } catch (error) {
    console.error('Error fetching article:', error)
    return NextResponse.json({ error: 'Failed to fetch article' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const profile = await getServerUserProfile(user.id)

  const docRef = adminDb.collection('articles').doc(id)
  const docSnap = await docRef.get()

  if (!docSnap.exists || (docSnap.data()?.created_by !== user.id && !hasEditorAccess(profile))) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  }

  const existing = docSnap.data() as any

  if (existing.status === 'published' && !hasEditorAccess(profile)) {
    return NextResponse.json({ error: 'Published articles cannot be edited' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { title, excerpt, content, bodyText, category, tags, assetId, submitForReview, status } = body as {
    title?: string
    excerpt?: string
    content?: any
    bodyText?: string
    category?: string
    tags?: string[]
    assetId?: string
    submitForReview?: boolean
    status?: 'draft' | 'pending_review' | 'published' | 'rejected' | 'approved'
  }

  const updateData: any = {
    updated_at: FieldValue.serverTimestamp()
  }
  if (title) updateData.title = title.trim()
  if (excerpt !== undefined) updateData.excerpt = excerpt
  if (content !== undefined) updateData.content = content
  else if (bodyText !== undefined) updateData.content = textToContent(bodyText)
  
  if (category !== undefined) {
      updateData.category_id = category ? await getCategoryId(category) : null
  }

  if (status) {
    if (!['draft', 'pending_review', 'published', 'rejected', 'approved'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    if (status === 'published' && !hasEditorAccess(profile)) {
      return NextResponse.json({ error: 'Editor access is required to publish' }, { status: 403 })
    }
    updateData.status = status
    // Preserve the original publish date when re-saving an already-published
    // article (an edit shouldn't reset when it first went live).
    updateData.published_at = status === 'published'
      ? (existing.published_at ?? FieldValue.serverTimestamp())
      : null
  } else if (submitForReview !== undefined) {
    updateData.status = submitForReview ? 'pending_review' : 'draft'
    updateData.published_at = null
  }
  if (assetId !== undefined) updateData.image_url = assetId

  try {
    await docRef.update(updateData)
    const updatedSnap = await docRef.get()
    const updated = { id: updatedSnap.id, ...updatedSnap.data() }

    // Handle tags if provided
    if (Array.isArray(tags)) {
      // Clear existing tags
      await clearArticleTags(id)

      if (tags.length > 0) {
        const batch = adminDb.batch()
        for (const name of tags) {
           const tagName = name.trim().toLowerCase()
           const tagQuery = await adminDb.collection('tags').where('name', '==', tagName).limit(1).get()
           let tagId
           if (tagQuery.empty) {
               const tagRef = adminDb.collection('tags').doc()
               batch.set(tagRef, { name: tagName, created_at: FieldValue.serverTimestamp() })
               tagId = tagRef.id
           } else {
               tagId = tagQuery.docs[0].id
           }

           const articleTagRef = adminDb.collection('article_tags').doc()
           batch.set(articleTagRef, { article_id: id, tag_id: tagId })
        }
        await batch.commit()
      }
    }

    // Keep the Spanish translation in sync whenever an article is live.
    const finalStatus = (updateData.status as string) || existing.status
    if (finalStatus === 'published') {
      const u = updated as any
      await translateArticleToEs(docRef, { title: u.title, excerpt: u.excerpt, content: u.content })
    }

    return NextResponse.json({ article: { ...updated, _id: updated.id } })
  } catch (error) {
    console.error('Error updating article:', error)
    return NextResponse.json({ error: 'Failed to update article' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const profile = await getServerUserProfile(user.id)

  const docRef = adminDb.collection('articles').doc(id)
  const docSnap = await docRef.get()

  const isOwner = docSnap.data()?.created_by === user.id
  if (!docSnap.exists || (!isOwner && !hasEditorAccess(profile))) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  }
  if (docSnap.data()?.status === 'published' && !hasEditorAccess(profile)) {
    return NextResponse.json({ error: 'Editor access is required to delete a published article' }, { status: 403 })
  }

  try {
    // Remove the article and its tag join rows atomically so no orphans remain.
    const tagsSnap = await adminDb.collection('article_tags').where('article_id', '==', id).get()
    const batch = adminDb.batch()
    tagsSnap.docs.forEach((d) => batch.delete(d.ref))
    batch.delete(docRef)
    await batch.commit()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting article:', error)
    return NextResponse.json({ error: 'Failed to delete article' }, { status: 500 })
  }
}
