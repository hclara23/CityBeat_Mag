import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { FieldValue } from 'firebase-admin/firestore'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .slice(0, 96)
}

function textToContent(text: string) {
  return text.split('\n\n').filter(Boolean).map((paragraph, i) => ({
    type: 'paragraph',
    content: [{ type: 'text', text: paragraph.trim() }],
  }))
}

function hasCreatorAccess(profile: any) {
  return Boolean(profile?.is_developer || profile?.is_writer || profile?.is_editor || ['developer', 'admin', 'editor', 'writer'].includes(profile?.role))
}

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

async function getAuthorId(name: string) {
  const authorName = name.trim() || 'CityBeat Staff'
  const snapshot = await adminDb.collection('authors').where('name', '==', authorName).limit(1).get()

  if (!snapshot.empty) return snapshot.docs[0].id

  const newAuthorRef = await adminDb.collection('authors').add({ 
    name: authorName,
    created_at: FieldValue.serverTimestamp() 
  })

  return newAuthorRef.id
}

export async function GET(request: NextRequest) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  let query = adminDb.collection('articles').where('created_by', '==', user.id)

  if (status) {
    query = query.where('status', '==', status)
  }

  query = query.orderBy('created_at', 'desc')

  try {
    const snapshot = await query.get()
    
    const transformedArticles = snapshot.docs.map(doc => {
      const a = doc.data()
      return {
        id: doc.id,
        created_at: a.created_at?.toDate ? a.created_at.toDate().toISOString() : a.created_at,
        title: a.title,
        slug: a.slug,
        excerpt: a.excerpt,
        category_id: a.category_id,
        status: a.status,
        published_at: a.published_at?.toDate ? a.published_at.toDate().toISOString() : a.published_at,
        image_url: a.image_url,
        _id: doc.id,
        _createdAt: a.created_at?.toDate ? a.created_at.toDate().toISOString() : a.created_at,
        imageUrl: a.image_url,
        category: a.category_id,
      }
    })

    return NextResponse.json({ articles: transformedArticles })
  } catch (error) {
    console.error('Error fetching articles:', error)
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await getServerUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const profile = await getServerUserProfile(user.id)
  if (!hasCreatorAccess(profile)) {
    return NextResponse.json({ error: 'Writer access is required' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { title, excerpt, content, bodyText, category, tags, assetId, submitForReview } = body as {
    title?: string
    excerpt?: string
    content?: any
    bodyText?: string
    category?: string
    tags?: string[]
    assetId?: string 
    submitForReview?: boolean
  }

  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const slug = slugify(title)

  const contentValue = content || (bodyText ? textToContent(bodyText as string) : [])
  const categoryId = await getCategoryId(category)
  const authorId = await getAuthorId(typeof body.authorName === 'string' ? body.authorName : user.email ?? '')
  
  const articleData = {
    title: title.trim(),
    slug: `${slug}-${Date.now().toString(36)}`,
    author_id: authorId,
    created_by: user.id,
    excerpt: excerpt || '',
    content: contentValue,
    category_id: categoryId,
    status: submitForReview ? 'pending_review' : 'draft',
    published_at: null,
    cover_image_path: assetId || null,
    image_url: assetId || null,
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp()
  }

  try {
    const docRef = await adminDb.collection('articles').add(articleData)
    const created = { id: docRef.id, ...articleData }

    if (Array.isArray(tags) && tags.length > 0) {
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
        batch.set(articleTagRef, {
          article_id: created.id,
          tag_id: tagId
        })
      }
      
      await batch.commit()
    }

    return NextResponse.json({ article: { ...created, _id: created.id } }, { status: 201 })
  } catch (error) {
    console.error('Error creating article:', error)
    return NextResponse.json({ error: 'Failed to create article' }, { status: 500 })
  }
}
