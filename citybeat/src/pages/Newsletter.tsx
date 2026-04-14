import { motion } from "motion/react";
import { PageTransition } from "../components/layout/PageTransition";
import { NewsletterSignup } from "../components/features/NewsletterSignup";
import { formatDate } from "../lib/utils";
import { useEffect, useState } from "react";
import { fetchAPI } from "../lib/api";
import { NewsletterIssue } from "../lib/types";

export function Newsletter() {
  const [newsletters, setNewsletters] = useState<NewsletterIssue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await fetchAPI<NewsletterIssue[]>("/newsletters");
        setNewsletters(data);
      } catch (error) {
        console.error("Failed to fetch newsletters", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);
  
  if (loading) return <div className="min-h-screen bg-brand-dark flex items-center justify-center text-white">Loading...</div>;

  return (
    <PageTransition>
      <div className="pt-32 pb-20 container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-brand-neon font-mono text-sm uppercase tracking-widest mb-4 block">The Weekly Edit</span>
          <h1 className="text-5xl md:text-7xl font-display font-bold text-white mb-6">
            Your City, Curated.
          </h1>
          <p className="text-xl text-gray-400 leading-relaxed">
            Join 25,000+ locals who start their weekend with our Friday morning dispatch. No spam, just the good stuff.
          </p>
        </div>

        <NewsletterSignup />

        <div className="mt-20">
          <h2 className="text-3xl font-display font-bold text-white mb-8 text-center">Past Issues</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {newsletters.map((issue) => (
              <motion.a 
                href="#" 
                key={issue.id}
                className="group flex gap-4 bg-brand-charcoal p-4 rounded-xl border border-white/5 hover:border-brand-neon/50 transition-colors"
                whileHover={{ scale: 1.02 }}
              >
                <div className="w-24 h-32 flex-shrink-0 bg-gray-800 rounded overflow-hidden">
                  <img src={issue.coverImage} alt={issue.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                </div>
                <div className="flex flex-col justify-center">
                  <span className="text-xs text-brand-neon font-mono mb-1">{formatDate(issue.date)}</span>
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-brand-neon transition-colors">{issue.title}</h3>
                  <p className="text-sm text-gray-400 line-clamp-2">{issue.previewText}</p>
                </div>
              </motion.a>
            ))}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
