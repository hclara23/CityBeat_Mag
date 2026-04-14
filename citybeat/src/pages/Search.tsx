import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Search as SearchIcon, X } from "lucide-react";
import { Link } from "react-router-dom";
import { PageTransition } from "../components/layout/PageTransition";
import { fetchAPI } from "../lib/api";
import { Story, CityEvent } from "../lib/types";

export function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ stories: Story[], events: CityEvent[] }>({ stories: [], events: [] });

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.length > 2) {
        try {
          const [stories, events] = await Promise.all([
            fetchAPI<Story[]>(`/stories?search=${query}`),
            fetchAPI<CityEvent[]>(`/events?search=${query}`) // Assuming events API supports search, though server.ts didn't implement it explicitly yet, let's just fetch all and filter client side or update server. Wait, server.ts didn't implement search for events.
          ]);
          // Since server.ts doesn't support search for events yet, let's just fetch all and filter client side for now, OR better, update server.ts.
          // Actually, let's just use the stories search which IS implemented. For events, I'll just fetch all and filter client-side for this step to avoid context switching too much, or I can update server.ts.
          // Let's check server.ts again. It has `if (category ...)` but no search for events.
          // I'll just fetch all events and filter client side for now to keep it simple, or I can add search to events API.
          // Let's stick to what I have.
          
          // Actually, let's just use the stories search.
          setResults(prev => ({ ...prev, stories }));
        } catch (e) {
          console.error(e);
        }
      } else {
        setResults({ stories: [], events: [] });
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  // Fetch events separately and filter client side for now since I didn't add search to events API
  useEffect(() => {
     if (query.length > 2) {
        fetchAPI<CityEvent[]>("/events").then(events => {
            const filtered = events.filter(e => e.title.toLowerCase().includes(query.toLowerCase()) || e.description.toLowerCase().includes(query.toLowerCase()));
            setResults(prev => ({ ...prev, events: filtered }));
        });
     }
  }, [query]);

  return (
    <PageTransition>
      <div className="min-h-screen pt-32 container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <div className="relative mb-12">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-6 h-6" />
            <input
              type="text"
              placeholder="Search stories, events, and more..."
              className="w-full bg-transparent border-b-2 border-white/20 text-3xl md:text-5xl font-display font-bold text-white py-4 pl-14 pr-4 focus:outline-none focus:border-brand-neon placeholder:text-gray-700 transition-colors"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {query && (
              <button 
                onClick={() => setQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                <X size={24} />
              </button>
            )}
          </div>

          <div className="space-y-12">
            {results.stories.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-6">Stories</h3>
                <div className="space-y-6">
                  {results.stories.map(story => (
                    <Link to={`/stories/${story.slug}`} key={story.id} className="flex gap-4 group">
                      <img src={story.heroImage} alt={story.title} className="w-24 h-16 object-cover rounded bg-gray-800" />
                      <div>
                        <h4 className="text-xl font-bold text-white group-hover:text-brand-neon transition-colors">{story.title}</h4>
                        <p className="text-gray-400 text-sm line-clamp-1">{story.dek}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </motion.div>
            )}

            {results.events.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-6">Events</h3>
                <div className="space-y-6">
                  {results.events.map(event => (
                    <Link to="/events" key={event.id} className="flex gap-4 group">
                      <div className="w-16 h-16 bg-brand-charcoal rounded flex flex-col items-center justify-center border border-white/10 group-hover:border-brand-neon transition-colors">
                        <span className="text-xs font-bold text-brand-neon uppercase">{new Date(event.date).toLocaleString('default', { month: 'short' })}</span>
                        <span className="text-xl font-bold text-white">{new Date(event.date).getDate()}</span>
                      </div>
                      <div>
                        <h4 className="text-xl font-bold text-white group-hover:text-brand-neon transition-colors">{event.title}</h4>
                        <p className="text-gray-400 text-sm">{event.venue}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </motion.div>
            )}

            {query.length > 2 && results.stories.length === 0 && results.events.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No results found for "{query}"
              </div>
            )}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
