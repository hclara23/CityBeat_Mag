import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { pb } from '@/src/lib/pocketbase'
import { AdSlot } from '@/src/components/features/AdSlot'
import { ArrowLeft, Share2, Bookmark, Clock, Calendar } from "lucide-react"
import { NewsletterSignup } from '@/src/components/features/NewsletterSignup'
import { Button } from '@/src/components/ui/Button'

export const revalidate = 3600

interface PageProps {
  params: Promise<{ slug: string; locale: string }>
}

export default async function ArticlePage(props: PageProps) {
  const params = await props.params;
  const locale = params.locale

  // Fetch Article Detail from PocketBase
  let article: any;
  try {
    article = await pb.collection('articles').getFirstListItem(`slug="${params.slug}"`, {
      expand: 'category'
    });
  } catch (err: any) {
    notFound()
  }

  const title = locale === 'es' ? article.title_es : article.title_en
  const excerpt = locale === 'es' ? article.excerpt_es : article.excerpt_en
  const content = locale === 'es' ? article.content_es : article.content_en
  const coverUrl = article.cover ? pb.files.getURL(article, article.cover) : null
    
  const category = article.expand?.category
  const categoryName = locale === 'es' ? category?.name_es : category?.name_en
  const author = { name: 'CityBeat Staff', avatar: 'https://i.pravatar.cc/150?u=citybeat', bio: '' }

  // Fetch Related Stories (same category, excluding current)
  let relatedStories: any[] = []
  try {
    const relatedResult = await pb.collection('articles').getList(1, 3, {
      filter: `category = "${category?.id}" && id != "${article.id}" && is_published = true`,
      sort: '-published_at'
    });
    relatedStories = relatedResult.items.map(s => ({
      id: s.id,
      slug: s.slug,
      title: locale === 'es' ? s.title_es : s.title_en,
      date: s.published_at || s.created
    }));
  } catch (e) {
    console.error("Failed to fetch related stories:", e);
  }


  return (
    <article className="min-h-screen bg-brand-dark pt-20">
      {/* Hero Header */}
      <div className="relative h-[70vh] w-full overflow-hidden">
        {coverUrl && (
          <div className="absolute inset-0 w-full h-full">
            <Image 
              src={coverUrl} 
              alt={title ?? 'Article cover'} 
              fill
              className="object-cover" 
              priority
              unoptimized
            />
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-transparent to-transparent" />
          </div>
        )}
        
        <div className="absolute bottom-0 left-0 w-full p-6 md:p-12 lg:p-20 z-10">
          <div className="container mx-auto max-w-4xl">
            <Link 
              href={`/${locale}/stories`} 
              className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors text-sm font-medium uppercase tracking-wider"
            >
              <ArrowLeft size={16} /> {locale === 'es' ? 'Volver a Historias' : 'Back to Stories'}
            </Link>
            
            <div>
              <span className="inline-block px-3 py-1 rounded mb-4 text-xs font-bold uppercase tracking-widest bg-brand-neon text-black">
                {categoryName}
              </span>
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold text-white mb-6 leading-[1.1] text-balance">
                {title}
              </h1>
              <p className="text-xl md:text-2xl text-gray-200 font-light leading-relaxed max-w-2xl mb-8">
                {excerpt}
              </p>
              
              <div className="flex flex-wrap items-center gap-6 text-sm text-gray-300 border-t border-white/10 pt-6">
                <div className="flex items-center gap-3">
                  {author.avatar && (
                    <div className="relative w-10 h-10 overflow-hidden rounded-full border border-white/20">
                      <Image 
                        src={author.avatar} 
                        alt={author.name} 
                        fill 
                        className="object-cover" 
                        unoptimized
                      />
                    </div>
                  )}
                  <div>
                    <span className="block font-bold text-white">{author.name}</span>
                    <span className="text-xs text-gray-400 capitalize">{article.is_sponsored ? 'Sponsored' : 'Editor'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={16} /> 
                  {article.published_at ? new Date(article.published_at).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  }) : 'Draft'}
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={16} /> 5 min read
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="container mx-auto px-4 py-16 grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Content Column */}
        <div className="lg:col-span-8">
          <div className="prose prose-invert prose-lg max-w-none prose-p:text-gray-300 prose-headings:font-display prose-headings:font-bold prose-blockquote:border-brand-neon prose-blockquote:text-white prose-blockquote:font-display">
            {content && (
              <div dangerouslySetInnerHTML={{ __html: content }} className="whitespace-pre-wrap" />
            )}
          </div>

          {/* Ad Slot */}
          <div className="my-12">
            <AdSlot placementKey="article_inline" />
          </div>

          {/* Author Card */}
          <div className="mt-16 p-8 bg-brand-charcoal rounded-xl border border-white/5 flex flex-col md:flex-row gap-6 items-center md:items-start text-center md:text-left">
            {author.avatar && (
              <div className="relative w-20 h-20 overflow-hidden rounded-full border-2 border-brand-neon flex-shrink-0">
                <Image 
                  src={author.avatar} 
                  alt={author.name} 
                  fill 
                  className="object-cover" 
                  unoptimized
                />
              </div>
            )}
            <div>
              <h3 className="text-xl font-bold text-white mb-2">
                {locale === 'es' ? `Sobre ${author.name}` : `About ${author.name}`}
              </h3>
              <p className="text-gray-400 mb-4">{author.bio || (locale === 'es' ? 'Escritor del personal de CityBeat.' : 'CityBeat Staff Writer.')}</p>
              <Link href={`/${locale}/author/${author.name.toLowerCase().replace(/\s+/g, '-')}`}>
                <Button variant="outline" size="sm">
                  {locale === 'es' ? 'Ver todas las historias' : 'View all stories'}
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-8">
          <div className="sticky top-24 space-y-8">
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-2">
                <Share2 size={16} /> Share
              </Button>
              <Button variant="outline" className="flex-1 gap-2">
                <Bookmark size={16} /> Save
              </Button>
            </div>

            {relatedStories.length > 0 && (
              <div className="bg-brand-charcoal p-6 rounded-xl border border-white/5">
                <h4 className="font-display font-bold text-white mb-4 uppercase tracking-wider text-sm">
                  {locale === 'es' ? `Más en ${categoryName}` : `More in ${categoryName}`}
                </h4>
                <ul className="space-y-4">
                  {relatedStories.map((s) => (
                    <li key={s.id}>
                      <Link href={`/${locale}/article/${s.slug}`} className="group block">
                        <h5 className="text-white font-medium group-hover:text-brand-neon transition-colors mb-1 line-clamp-2">
                          {s.title}
                        </h5>
                        <span className="text-xs text-gray-500">
                          {s.date ? new Date(s.date).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US') : ''}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <AdSlot placementKey="sidebar_rect" />
            
            <div className="bg-brand-neon text-black p-6 rounded-xl">
              <h4 className="font-display font-bold text-2xl mb-2">
                {locale === 'es' ? 'Suscríbete' : 'Get the newsletter'}
              </h4>
              <p className="text-sm mb-4 font-medium opacity-80">
                {locale === 'es' ? 'Actualizaciones semanales sobre las mejores historias.' : 'Weekly updates on the best stories.'}
              </p>
              <Link href={`/${locale}/newsletter`}>
                <Button className="w-full bg-black text-white hover:bg-gray-800">
                  {locale === 'es' ? 'Suscribirse' : 'Subscribe'}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <NewsletterSignup />
    </article>
  )
}
