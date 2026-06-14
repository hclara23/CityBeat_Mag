import { adminDb } from '@citybeat/lib/firebase/admin'
import { localArticles } from './localArticles'

export async function getPublishedArticles(limit = 10) {
  try {
    const snapshot = await adminDb.collection('articles')
      .where('status', '==', 'published')
      .orderBy('published_at', 'desc')
      .limit(limit)
      .get()

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  } catch (err) {
    console.error('Error fetching published articles:', err)
    return []
  }
}

export async function getArticleBySlug(slug: string) {
  try {
    const snapshot = await adminDb.collection('articles')
      .where('slug', '==', slug)
      .where('status', '==', 'published')
      .limit(1)
      .get()

    if (snapshot.empty) throw new Error('Not found')
    
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() }
  } catch (err) {
    // Fallback to local articles if not found in DB
    return localArticles.find(a => a.slug === slug)
  }
}
