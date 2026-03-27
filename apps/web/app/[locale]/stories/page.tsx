import Link from 'next/link'
import Image from 'next/image'
import { pb } from '@/src/lib/pocketbase'
import { AdSlot } from '@/src/components/features/AdSlot'
import { Clock, Calendar, Filter } from "lucide-react"

export const revalidate = 3600

export default async function StoriesPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params

  // Fetch all published articles from PocketBase
  let list: any[] = [];
  try {
    const result = await pb.collection('articles').getList(1, 50, {
      filter: 'is_published = true',
      sort: '-published_at',
      expand: 'category'
    });
    list = result.items;
  } catch (e) {
    console.error("Failed to fetch stories:", e);
  }

  return (
    <main className="min-h-screen bg-brand-dark pt-32 pb-20">
      <div className="container mx-auto px-4">
        <header className="mb-12">
          <span className="inline-block px-3 py-1 rounded mb-4 text-xs font-bold uppercase tracking-widest bg-brand-neon text-black">
            {locale === 'es' ? 'Archivo' : 'Archive'}
          </span>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 font-display">
            <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight">
              {locale === 'es' ? 'Todas las Historias' : 'All Stories'}
            </h1>
            <div className="flex items-center gap-4 text-white/60">
              <Filter size={18} />
              <span className="font-bold uppercase tracking-widest text-xs">
                {list.length} {locale === 'es' ? 'Publicaciones' : 'Posts'}
              </span>
            </div>
          </div>
        </header>

        <div className="mb-12">
          <AdSlot placementKey="stories_banner" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {list.map((article) => {
            const title = locale === 'es' ? article.title_es : article.title_en
            const excerpt = locale === 'es' ? article.excerpt_es : article.excerpt_en
            const category = article.expand?.category
            const categoryName = locale === 'es' ? category?.name_es : category?.name_en
            const coverUrl = article.cover
              ? pb.files.getURL(article, article.cover)
              : null

            return (
              <article
                key={article.id}
                className="group flex flex-col bg-brand-charcoal rounded-2xl overflow-hidden border border-white/5 hover:border-brand-neon/30 transition-all duration-500 shadow-xl"
              >
                <Link href={`/${locale}/article/${article.slug}`} className="block relative aspect-[16/9] overflow-hidden">
                  {coverUrl ? (
                    <Image
                      src={coverUrl}
                      alt={title ?? 'Article cover'}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full bg-brand-dark flex items-center justify-center text-gray-700">
                      No Image
                    </div>
                  )}
                  <div className="absolute top-4 left-4 z-10">
                    <span className="px-2 py-1 bg-brand-neon text-black text-[10px] font-bold uppercase tracking-widest rounded shadow-lg">
                      {categoryName}
                    </span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-charcoal via-transparent to-transparent opacity-60" />
                </Link>
                
                <div className="flex flex-col p-6 flex-grow">
                  <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-3">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {article.published_at ? new Date(article.published_at).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US') : 'Draft'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      5 min
                    </span>
                  </div>
                  
                  <Link href={`/${locale}/article/${article.slug}`}>
                    <h2 className="text-xl font-display font-bold text-white mb-3 group-hover:text-brand-neon transition-colors line-clamp-2 leading-snug">
                      {title ?? 'Untitled'}
                    </h2>
                  </Link>
                  
                  <p className="text-sm text-gray-400 mb-6 line-clamp-3 leading-relaxed">
                    {excerpt ?? (locale === 'es' ? 'No hay resumen disponible.' : 'No excerpt available.')}
                  </p>
                  
                  <div className="mt-auto pt-6 border-t border-white/5 flex items-center justify-between">
                    <span className="text-xs font-bold text-white/80">
                      {article.author?.[0]?.name ?? 'CityBeat Staff'}
                    </span>
                    <Link 
                      href={`/${locale}/article/${article.slug}`}
                      className="text-xs font-bold uppercase tracking-widest text-brand-neon hover:text-white transition-colors"
                    >
                      {locale === 'es' ? 'Leer Más' : 'Read More'} ?
                    </Link>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </main>
  )
}
