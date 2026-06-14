import { SiteHeader } from '@/components/citybeat/SiteHeader'
import Link from 'next/link'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { getServerUser } from '@citybeat/lib/firebase/server'
import { sanityClient } from '@citybeat/lib/sanity/client'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface SavedItem {
  id: string
  content_type: 'article' | 'directory'
  content_id: string
  title: string
  description?: string
  created_at: string
}

export default async function SavedPage({ params }: { params: { locale: string } }) {
  const user = await getServerUser()
  
  if (!user) {
    redirect(`/${params.locale}/login`)
  }

  // Fetch bookmarks from Firestore
  const snapshot = await adminDb.collection('user_bookmarks').where('user_id', '==', user.id).get()
  const rawBookmarks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

  const populatedBookmarks: SavedItem[] = await Promise.all(
    rawBookmarks.map(async (bm: any) => {
      let title = `Unknown ${bm.content_type}`
      let description = ''

      if (bm.content_type === 'article') {
        const query = `*[_type == "article" && _id == $id][0] { title, excerpt }`
        const article = await sanityClient.fetch(query, { id: bm.content_id })
        if (article) {
          title = article.title
          description = article.excerpt || ''
        }
      } else if (bm.content_type === 'directory') {
        const doc = await adminDb.collection('directory_listings').doc(bm.content_id).get()
        if (doc.exists) {
          const data = doc.data()
          title = data?.name || 'Unknown Business'
          description = data?.description || ''
        }
      }

      return {
        id: bm.id,
        content_type: bm.content_type,
        content_id: bm.content_id,
        title,
        description,
        created_at: bm.created_at
      }
    })
  )

  return (
    <div className="min-h-screen bg-black text-white">
      <SiteHeader />
      <main className="container-wide py-12">
        <h1 className="text-4xl font-display font-black uppercase tracking-widest mb-8">
          My Weekend / Saved
        </h1>

        {populatedBookmarks.length === 0 ? (
          <div className="text-white/50 border border-white/10 rounded-xl p-8 text-center bg-white/5">
            You haven&apos;t saved any items yet. Browse the directory or articles to bookmark your favorites!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {populatedBookmarks.map((bookmark) => (
              <div key={bookmark.id} className="citybeat-panel p-6 flex flex-col justify-between">
                <div>
                  <div className="text-xs text-brand-neon font-bold uppercase tracking-widest mb-2">
                    {bookmark.content_type}
                  </div>
                  <h3 className="text-xl font-bold mb-2">
                    {bookmark.title}
                  </h3>
                  <p className="text-white/60 text-sm line-clamp-3 mb-4">
                    {bookmark.description}
                  </p>
                </div>
                <Link
                  href={`/${params.locale}/${bookmark.content_type === 'article' ? 'briefs' : 'directory'}/${bookmark.content_id}`}
                  className="mt-4 inline-block text-sm border border-white/20 px-4 py-2 rounded text-center hover:bg-white/10 transition"
                >
                  View Details
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
