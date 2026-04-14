import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Search, Filter } from "lucide-react";
import { StoryCard } from "../components/features/StoryCard";
import { PageTransition } from "../components/layout/PageTransition";
import { Button } from "../components/ui/Button";
import { cn } from "../lib/utils";
import { fetchAPI } from "../lib/api";
import { Story, Category } from "../lib/types";

export function StoryIndex() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [stories, setStories] = useState<Story[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [storiesData, categoriesData] = await Promise.all([
          fetchAPI<Story[]>("/stories"),
          fetchAPI<Category[]>("/categories")
        ]);
        setStories(storiesData);
        setCategories(categoriesData);
      } catch (error) {
        console.error("Failed to fetch stories data", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredStories = stories.filter((story) => {
    const matchesCategory = activeCategory === "all" || story.category.slug === activeCategory;
    const matchesSearch = story.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          story.dek.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (loading) return <div className="min-h-screen bg-brand-dark flex items-center justify-center text-white">Loading...</div>;

  return (
    <PageTransition>
      <div className="pt-32 pb-20 container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
          <div>
            <h1 className="text-5xl md:text-7xl font-display font-bold text-white mb-4">Stories</h1>
            <p className="text-xl text-gray-400 max-w-2xl">
              Deep dives, quick hits, and everything in between.
            </p>
          </div>
          
          <div className="w-full md:w-auto flex flex-col gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search stories..." 
                className="w-full md:w-64 bg-brand-charcoal border border-white/10 rounded-full pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-brand-neon transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-12 border-b border-white/10 pb-6">
          <button
            onClick={() => setActiveCategory("all")}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all",
              activeCategory === "all" 
                ? "bg-white text-black" 
                : "bg-transparent text-gray-400 hover:text-white hover:bg-white/5"
            )}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.slug)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all",
                activeCategory === cat.slug 
                  ? "bg-brand-neon text-black shadow-[0_0_10px_rgba(0,240,255,0.3)]" 
                  : "bg-transparent text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredStories.map((story) => (
            <motion.div 
              key={story.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <StoryCard story={story} />
            </motion.div>
          ))}
        </div>

        {filteredStories.length === 0 && (
          <div className="text-center py-20">
            <h3 className="text-2xl font-display font-bold text-gray-500 mb-2">No stories found</h3>
            <p className="text-gray-600">Try adjusting your search or filters.</p>
            <Button 
              variant="outline" 
              className="mt-6"
              onClick={() => { setActiveCategory("all"); setSearchQuery(""); }}
            >
              Clear Filters
            </Button>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
