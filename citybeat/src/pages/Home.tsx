import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { HeroFeature } from "../components/features/HeroFeature";
import { StoryCard } from "../components/features/StoryCard";
import { EventCard } from "../components/features/EventCard";
import { NewsletterSignup } from "../components/features/NewsletterSignup";
import { AdSlot } from "../components/features/AdSlot";
import { staggerContainer, fadeInUp } from "../lib/animations";
import { PageTransition } from "../components/layout/PageTransition";
import { useEffect, useState } from "react";
import { fetchAPI } from "../lib/api";
import { Story, CityEvent } from "../lib/types";

export function Home() {
  const [featuredStory, setFeaturedStory] = useState<Story | null>(null);
  const [topStories, setTopStories] = useState<Story[]>([]);
  const [events, setEvents] = useState<CityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const stories = await fetchAPI<Story[]>("/stories?limit=4");
        const eventsData = await fetchAPI<CityEvent[]>("/events?limit=3");
        
        if (stories.length > 0) {
          setFeaturedStory(stories[0]);
          setTopStories(stories.slice(1));
        }
        setEvents(eventsData);
      } catch (error) {
        console.error("Failed to fetch home data", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-brand-dark flex items-center justify-center text-white">Loading...</div>;
  }

  return (
    <PageTransition>
      {featuredStory && (
        <HeroFeature
          title={featuredStory.title}
          subtitle={featuredStory.dek}
          image={featuredStory.heroImage}
          ctaLink={`/stories/${featuredStory.slug}`}
        />
      )}

      <div className="container mx-auto px-4 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-display font-bold text-white">Top Stories</h2>
          <Link to="/stories" className="text-brand-neon flex items-center gap-2 hover:underline">
            View All <ArrowRight size={16} />
          </Link>
        </div>
        
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
        >
          {topStories.map((story) => (
            <motion.div key={story.id} variants={fadeInUp}>
              <StoryCard story={story} />
            </motion.div>
          ))}
        </motion.div>
      </div>

      <AdSlot type="banner" className="my-8" />

      <section className="bg-brand-charcoal py-20 border-y border-white/5">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-12">
            <div>
              <span className="text-brand-neon font-mono text-xs uppercase tracking-widest mb-2 block">Happening Now</span>
              <h2 className="text-4xl font-display font-bold text-white">Events & Culture</h2>
            </div>
            <Link to="/events" className="hidden md:flex items-center gap-2 text-white hover:text-brand-neon transition-colors">
              Full Calendar <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {events.map((event: CityEvent) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
          
          <div className="mt-8 text-center md:hidden">
            <Link to="/events" className="inline-flex items-center gap-2 text-brand-neon font-bold">
              View All Events <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <NewsletterSignup />
    </PageTransition>
  );
}
