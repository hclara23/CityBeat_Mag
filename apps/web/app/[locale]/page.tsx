import Link from 'next/link'
import { pb } from '@/src/lib/pocketbase'
import { HeroFeature } from '@/src/components/features/HeroFeature'
import { StoryCard } from '@/src/components/features/StoryCard'
import { EventCard } from '@/src/components/features/EventCard'
import { NewsletterSignup } from '@/src/components/features/NewsletterSignup'
import { AdSlot } from '@/src/components/features/AdSlot'
import { ArrowRight } from 'lucide-react'
import { Story, CityEvent } from '@/src/lib/types'

export const revalidate = 3600

export default async function HomePage(
  props: {
    params: Promise<{ locale: string }>
  }
) {
  const params = await props.params;
  const locale = params.locale

  // Fetch Articles from PocketBase
  interface PBArticle {
    id: string;
    slug: string;
    title_en: string;
    title_es: string;
    excerpt_en: string;
    excerpt_es: string;
    published_at?: string;
    created: string;
    cover?: string;
    expand?: {
      category?: {
        id: string;
        name_en: string;
        name_es: string;
        slug: string;
      }
    }
  }

  let articleRows: { items: PBArticle[] } = { items: [] };
  try {
    articleRows = await pb.collection('articles').getList(1, 4, {
      sort: '-published_at',
      expand: 'category',
      filter: 'is_published = true',
    }) as unknown as { items: PBArticle[] };
  } catch (e) {
    console.error("Failed to fetch articles from PocketBase:", e);
  }

  // Map to Story type
  const stories: Story[] = (articleRows.items ?? []).map((row: PBArticle) => {
    return {
      id: row.id,
      title: locale === 'es' ? row.title_es : row.title_en,
      dek: locale === 'es' ? row.excerpt_es : row.excerpt_en,
      slug: row.slug,
      date: row.published_at || row.created,
      readTime: '5 min',
      heroImage: row.cover 
        ? pb.files.getURL(row, row.cover)
        : 'https://images.unsplash.com/photo-1514525253344-9f0aa3641772?q=80&w=2670&auto=format&fit=crop',
      category: {
        id: row.expand?.category?.id || '1',
        name: locale === 'es' ? row.expand?.category?.name_es || 'General' : row.expand?.category?.name_en || 'General',
        slug: row.expand?.category?.slug || 'general',
        color: 'text-brand-neon'
      },
      author: {
        id: '1',
        name: 'CityBeat Staff',
        avatar: 'https://i.pravatar.cc/150?u=citybeat',
        role: 'Editor',
        bio: ''
      },
      content: '',
      isSponsored: false
    }
  });

  // Mock Events for now (can be replaced with Supabase fetch if table exists)
  const mockEvents: CityEvent[] = [
    {
      id: '1',
      title: 'Neon Nights: Rooftop Jazz',
      date: new Date().toISOString(),
      time: '9:00 PM',
      venue: 'Skyline Terrace',
      price: '$25',
      category: 'Music',
      image: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?q=80&w=2670&auto=format&fit=crop',
      description: 'Experience jazz like never before under the city lights.'
    },
    {
      id: '2',
      title: 'Modern Art Expo',
      date: new Date().toISOString(),
      time: '11:00 AM',
      venue: 'Contemporary Gallery',
      price: 'Free',
      category: 'Arts',
      image: 'https://images.unsplash.com/photo-1554941068-a252680d25d9?q=80&w=2670&auto=format&fit=crop',
      description: 'A showcase of regional contemporary artists.'
    },
    {
      id: '3',
      title: 'Global Food Festival',
      date: new Date().toISOString(),
      time: '1:00 PM',
      venue: 'Central Park',
      price: '$10',
      category: 'Food',
      image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=2670&auto=format&fit=crop',
      description: 'Tastes from around the world in one location.'
    }
  ];

  const featuredStory = stories[0];
  const topStories = stories.slice(1);

  return (
    <div className="bg-brand-dark min-h-screen pb-20">
      {featuredStory && (
        <HeroFeature
          title={featuredStory.title}
          subtitle={featuredStory.dek}
          image={featuredStory.heroImage}
          ctaLink={`/${locale}/article/${featuredStory.slug}`}
        />
      )}

      <div className="container mx-auto px-4 py-20">
        <div className="flex items-center justify-between mb-12">
          <h2 className="text-4xl font-display font-bold text-white tracking-tight">Top Stories</h2>
          <Link href={`/${locale}/stories`} className="text-brand-neon flex items-center gap-2 hover:underline font-bold uppercase tracking-widest text-sm">
            View All <ArrowRight size={16} />
          </Link>
        </div>
        
        {stories.length === 0 ? (
          <div className="bg-brand-charcoal border border-white/5 rounded-2xl p-12 text-center">
            <p className="text-gray-400">No stories found. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {topStories.map((story) => (
              <StoryCard key={story.id} story={story} locale={locale} />
            ))}
          </div>
        )}
      </div>

      <div className="my-12">
        <AdSlot placementKey="homepage_banner" />
      </div>

      <section className="bg-brand-charcoal/50 py-24 border-y border-white/5">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div>
              <span className="text-brand-neon font-mono text-xs uppercase tracking-[0.3em] mb-3 block">Happening Now</span>
              <h2 className="text-5xl font-display font-bold text-white tracking-tight">Events & Culture</h2>
            </div>
            <Link href={`/${locale}/events`} className="hidden md:flex items-center gap-2 text-white hover:text-brand-neon transition-colors font-bold uppercase tracking-widest text-sm">
              Full Calendar <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {mockEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
          
          <div className="mt-12 text-center md:hidden">
            <Link href={`/${locale}/events`} className="inline-flex items-center gap-2 text-brand-neon font-bold uppercase tracking-widest text-sm">
              View All Events <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-24">
        <NewsletterSignup />
      </div>
    </div>
  )
}
