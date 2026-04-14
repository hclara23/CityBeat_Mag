import { useParams, Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowLeft, Share2, Bookmark, Clock, Calendar } from "lucide-react";
import { PageTransition } from "../components/layout/PageTransition";
import { Button } from "../components/ui/Button";
import { AdSlot } from "../components/features/AdSlot";
import { NewsletterSignup } from "../components/features/NewsletterSignup";
import { formatDate } from "../lib/utils";
import { useEffect, useState } from "react";
import { fetchAPI } from "../lib/api";
import { Story } from "../lib/types";

export function StoryDetail() {
  const { slug } = useParams();
  const [story, setStory] = useState<Story | null>(null);
  const [relatedStories, setRelatedStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const { scrollYProgress } = useScroll();
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 1.1]);
  const opacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);

  useEffect(() => {
    async function loadData() {
      if (!slug) return;
      try {
        const storyData = await fetchAPI<Story>(`/stories/${slug}`);
        setStory(storyData);
        
        // Fetch related stories
        const allStories = await fetchAPI<Story[]>("/stories");
        setRelatedStories(allStories.filter(s => s.category.id === storyData.category.id && s.id !== storyData.id).slice(0, 3));
      } catch (error) {
        console.error("Failed to fetch story", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug]);

  if (loading) return <div className="min-h-screen bg-brand-dark flex items-center justify-center text-white">Loading...</div>;
  if (!story) return <div className="min-h-screen bg-brand-dark flex items-center justify-center text-white">Story not found</div>;

  return (
    <PageTransition>
      <article className="min-h-screen bg-brand-dark">
        {/* Hero */}
        <div className="relative h-[80vh] w-full overflow-hidden">
          <motion.div style={{ scale, opacity }} className="absolute inset-0 w-full h-full">
            <img src={story.heroImage} alt={story.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-transparent to-transparent" />
          </motion.div>
          
          <div className="absolute bottom-0 left-0 w-full p-6 md:p-12 lg:p-20 z-10">
            <div className="container mx-auto max-w-4xl">
              <Link to="/stories" className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors text-sm font-medium uppercase tracking-wider">
                <ArrowLeft size={16} /> Back to Stories
              </Link>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <span className={`inline-block px-3 py-1 rounded mb-4 text-xs font-bold uppercase tracking-widest bg-brand-neon text-black`}>
                  {story.category.name}
                </span>
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-bold text-white mb-6 leading-[1.1] text-balance">
                  {story.title}
                </h1>
                <p className="text-xl md:text-2xl text-gray-200 font-light leading-relaxed max-w-2xl mb-8">
                  {story.dek}
                </p>
                
                <div className="flex flex-wrap items-center gap-6 text-sm text-gray-300 border-t border-white/10 pt-6">
                  <div className="flex items-center gap-3">
                    <img src={story.author.avatar} alt={story.author.name} className="w-10 h-10 rounded-full border border-white/20" />
                    <div>
                      <span className="block font-bold text-white">{story.author.name}</span>
                      <span className="text-xs text-gray-400">{story.author.role}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={16} /> {formatDate(story.date)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={16} /> {story.readTime}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Main Column */}
          <div className="lg:col-span-8">
            <div className="prose prose-invert prose-lg max-w-none">
              <p className="lead text-2xl font-light text-gray-300 mb-8">
                {story.content.replace(/<[^>]*>?/gm, '')} 
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
              </p>
              
              <h2 className="text-3xl font-display font-bold text-white mt-12 mb-6">The Heart of the Matter</h2>
              <p className="text-gray-300 mb-6 leading-relaxed">
                Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
              </p>
              
              <figure className="my-12">
                <img src="https://picsum.photos/seed/detail1/800/500" alt="Detail shot" className="w-full rounded-xl" />
                <figcaption className="text-center text-sm text-gray-500 mt-3 italic">Photo by {story.author.name}</figcaption>
              </figure>
              
              <p className="text-gray-300 mb-6 leading-relaxed">
                Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
              </p>
              
              <blockquote className="border-l-4 border-brand-neon pl-6 my-12 italic text-2xl font-display text-white">
                "We wanted to create something that felt like the city itself—chaotic, beautiful, and constantly evolving."
              </blockquote>
              
              <p className="text-gray-300 mb-6 leading-relaxed">
                Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.
              </p>
            </div>

            {/* Author Bio */}
            <div className="mt-16 p-8 bg-brand-charcoal rounded-xl border border-white/5 flex flex-col md:flex-row gap-6 items-center md:items-start">
              <img src={story.author.avatar} alt={story.author.name} className="w-20 h-20 rounded-full border-2 border-brand-neon" />
              <div className="text-center md:text-left">
                <h3 className="text-xl font-bold text-white mb-2">About {story.author.name}</h3>
                <p className="text-gray-400 mb-4">{story.author.bio}</p>
                <Button variant="outline" size="sm">View all stories</Button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-8">
            <div className="sticky top-24 space-y-8">
              <div className="flex gap-2 mb-8">
                <Button variant="outline" className="flex-1 gap-2">
                  <Share2 size={16} /> Share
                </Button>
                <Button variant="outline" className="flex-1 gap-2">
                  <Bookmark size={16} /> Save
                </Button>
              </div>

              <div className="bg-brand-charcoal p-6 rounded-xl border border-white/5">
                <h4 className="font-display font-bold text-white mb-4 uppercase tracking-wider text-sm">More in {story.category.name}</h4>
                <ul className="space-y-4">
                  {relatedStories.map(s => (
                    <li key={s.id}>
                      <Link to={`/stories/${s.slug}`} className="group block">
                        <h5 className="text-white font-medium group-hover:text-brand-neon transition-colors mb-1">{s.title}</h5>
                        <span className="text-xs text-gray-500">{formatDate(s.date)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <AdSlot type="card" />
              
              <div className="bg-brand-neon text-black p-6 rounded-xl">
                <h4 className="font-display font-bold text-2xl mb-2">Get the newsletter</h4>
                <p className="text-sm mb-4 font-medium opacity-80">Weekly updates on the best stories.</p>
                <input type="email" placeholder="Email" className="w-full p-2 rounded mb-2 text-sm" />
                <Button className="w-full bg-black text-white hover:bg-gray-800">Subscribe</Button>
              </div>
            </div>
          </div>
        </div>
        
        <NewsletterSignup />
      </article>
    </PageTransition>
  );
}
