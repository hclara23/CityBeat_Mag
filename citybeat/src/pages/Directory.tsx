import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { PageTransition } from "../components/layout/PageTransition";
import { Search, MapPin, Phone, Globe, Tag } from "lucide-react";
import { cn } from "../lib/utils";

// Mock data for the directory
const DIRECTORY_DATA = [
  {
    id: "1",
    name: "The Rusty Spoon",
    category: "Restaurants",
    description: "Farm-to-table dining with a modern twist, featuring seasonal ingredients sourced from local farms.",
    address: "123 Main St, Downtown",
    phone: "(555) 123-4567",
    website: "https://example.com",
    image: "https://picsum.photos/seed/spoon/400/300",
    tags: ["Organic", "Dinner", "Cocktails"]
  },
  {
    id: "2",
    name: "Neon Nights",
    category: "Nightlife",
    description: "Premier underground electronic music club featuring international DJs and immersive light shows.",
    address: "456 Market St, Warehouse District",
    phone: "(555) 987-6543",
    website: "https://example.com",
    image: "https://picsum.photos/seed/neon/400/300",
    tags: ["Club", "Electronic", "Late Night"]
  },
  {
    id: "3",
    name: "Vintage Threads",
    category: "Shopping",
    description: "Curated vintage clothing from the 70s, 80s, and 90s. Sustainable fashion for the modern urbanite.",
    address: "789 Broadway, Arts District",
    phone: "(555) 456-7890",
    website: "https://example.com",
    image: "https://picsum.photos/seed/vintage/400/300",
    tags: ["Clothing", "Sustainable", "Vintage"]
  },
  {
    id: "4",
    name: "Metro Fix-It",
    category: "Services",
    description: "Reliable appliance repair and home services. Available 24/7 for emergency repairs.",
    address: "321 Industrial Way, Eastside",
    phone: "(555) 222-3333",
    website: "https://example.com",
    image: "https://picsum.photos/seed/fix/400/300",
    tags: ["Repair", "Home", "24/7"]
  },
  {
    id: "5",
    name: "City Art Gallery",
    category: "Arts & Culture",
    description: "Contemporary art from local and international artists. Rotating exhibitions every month.",
    address: "555 Arts Blvd, Cultural Center",
    phone: "(555) 888-9999",
    website: "https://example.com",
    image: "https://picsum.photos/seed/art/400/300",
    tags: ["Art", "Exhibitions", "Museum"]
  },
  {
    id: "6",
    name: "Brew & Bean",
    category: "Restaurants",
    description: "Artisanal coffee roaster and bakery. Perfect spot for remote work or a morning catch-up.",
    address: "890 Cafe Row, Westside",
    phone: "(555) 333-4444",
    website: "https://example.com",
    image: "https://picsum.photos/seed/coffee/400/300",
    tags: ["Coffee", "Bakery", "Breakfast"]
  },
  {
    id: "7",
    name: "The Velvet Lounge",
    category: "Nightlife",
    description: "Sophisticated speakeasy serving craft cocktails in an intimate, jazz-infused atmosphere.",
    address: "Hidden Alley, Downtown",
    phone: "(555) 777-8888",
    website: "https://example.com",
    image: "https://picsum.photos/seed/lounge/400/300",
    tags: ["Cocktails", "Jazz", "Speakeasy"]
  },
  {
    id: "8",
    name: "Urban Oasis Spa",
    category: "Services",
    description: "Luxury day spa offering massages, facials, and holistic wellness treatments.",
    address: "100 Serenity Ln, Uptown",
    phone: "(555) 555-1111",
    website: "https://example.com",
    image: "https://picsum.photos/seed/spa/400/300",
    tags: ["Spa", "Wellness", "Massage"]
  }
];

const CATEGORIES = ["All", "Restaurants", "Nightlife", "Shopping", "Services", "Arts & Culture"];

export function Directory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const filteredBusinesses = useMemo(() => {
    return DIRECTORY_DATA.filter((business) => {
      const matchesSearch = 
        business.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        business.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        business.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory = activeCategory === "All" || business.category === activeCategory;

      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, activeCategory]);

  return (
    <PageTransition>
      {/* SEO Meta Tags (Simulated via semantic HTML structure) */}
      <div className="container mx-auto px-4 py-32">
        <header className="max-w-4xl mx-auto text-center mb-16">
          <motion.h1 
            className="text-5xl md:text-7xl font-display font-bold text-white mb-6 tracking-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            City Directory
          </motion.h1>
          <motion.p 
            className="text-xl text-gray-400 font-light mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Discover the best local businesses, from hidden gems to city staples.
          </motion.p>

          {/* Search Bar */}
          <motion.div 
            className="relative max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-full text-white placeholder-gray-400 focus:outline-none focus:border-brand-neon focus:ring-1 focus:ring-brand-neon transition-all"
              placeholder="Search businesses, categories, or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </motion.div>
        </header>

        {/* Category Filters */}
        <motion.div 
          className="flex flex-wrap justify-center gap-3 mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 border",
                activeCategory === category
                  ? "bg-brand-neon text-black border-brand-neon"
                  : "bg-transparent text-gray-300 border-white/10 hover:border-white/30 hover:text-white"
              )}
            >
              {category}
            </button>
          ))}
        </motion.div>

        {/* Results Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence mode="popLayout">
            {filteredBusinesses.length > 0 ? (
              filteredBusinesses.map((business, index) => (
                <motion.article
                  key={business.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.3 }}
                  className="bg-brand-charcoal border border-white/5 rounded-2xl overflow-hidden hover:border-brand-neon/30 transition-colors group flex flex-col"
                >
                  <div className="relative h-48 overflow-hidden">
                    <img 
                      src={business.image} 
                      alt={business.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium text-brand-neon border border-white/10">
                      {business.category}
                    </div>
                  </div>
                  
                  <div className="p-6 flex flex-col flex-grow">
                    <h2 className="text-2xl font-display font-bold text-white mb-2 group-hover:text-brand-neon transition-colors">
                      {business.name}
                    </h2>
                    <p className="text-gray-400 text-sm mb-6 flex-grow">
                      {business.description}
                    </p>
                    
                    <div className="space-y-3 mt-auto">
                      <div className="flex items-start gap-3 text-sm text-gray-300">
                        <MapPin className="w-4 h-4 text-brand-neon shrink-0 mt-0.5" />
                        <address className="not-italic">{business.address}</address>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-300">
                        <Phone className="w-4 h-4 text-brand-neon shrink-0" />
                        <span>{business.phone}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-300">
                        <Globe className="w-4 h-4 text-brand-neon shrink-0" />
                        <a href={business.website} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                          Visit Website
                        </a>
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-white/5 flex flex-wrap gap-2">
                      {business.tags.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/5 text-xs text-gray-400">
                          <Tag className="w-3 h-3" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.article>
              ))
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="col-span-full text-center py-20"
              >
                <p className="text-2xl text-gray-400 font-display">No businesses found matching your criteria.</p>
                <button 
                  onClick={() => { setSearchQuery(""); setActiveCategory("All"); }}
                  className="mt-4 text-brand-neon hover:underline"
                >
                  Clear filters
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PageTransition>
  );
}
