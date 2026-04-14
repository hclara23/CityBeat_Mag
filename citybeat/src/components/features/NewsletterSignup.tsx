import { motion } from "motion/react";
import { Button } from "../ui/Button";

export function NewsletterSignup() {
  return (
    <section className="py-20 bg-brand-neon text-black relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-block py-1 px-2 border border-black/20 rounded text-xs font-bold uppercase tracking-wider mb-4">
              The Weekly Edit
            </span>
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-4 leading-tight">
              Don't miss the beat.
            </h2>
            <p className="text-lg font-medium opacity-80 mb-8">
              Get the curated list of the best stories, events, and hidden gems delivered to your inbox every Friday morning.
            </p>
            
            <form className="flex flex-col sm:flex-row gap-3">
              <input 
                type="email" 
                placeholder="Your email address" 
                className="flex-1 bg-white border-0 rounded-md px-4 py-3 text-black placeholder:text-gray-500 focus:ring-2 focus:ring-black/20 outline-none"
              />
              <Button variant="default" size="lg" className="bg-black text-white hover:bg-gray-800">
                Subscribe
              </Button>
            </form>
            <p className="text-xs mt-3 opacity-60">
              Join 25,000+ locals. Unsubscribe anytime.
            </p>
          </div>
          
          <div className="relative hidden md:block">
            <motion.div 
              className="absolute top-0 right-0 w-64 h-80 bg-white shadow-2xl rotate-3 rounded-lg border-4 border-black overflow-hidden z-10"
              whileHover={{ rotate: 0, scale: 1.05 }}
            >
              <div className="h-4 bg-black w-full"></div>
              <div className="p-6">
                <div className="h-4 w-32 bg-gray-200 mb-4"></div>
                <div className="h-2 w-full bg-gray-100 mb-2"></div>
                <div className="h-2 w-full bg-gray-100 mb-2"></div>
                <div className="h-2 w-2/3 bg-gray-100 mb-6"></div>
                <div className="h-32 w-full bg-gray-100 rounded"></div>
              </div>
            </motion.div>
            <div className="absolute top-4 right-4 w-64 h-80 bg-brand-magenta rounded-lg border-4 border-black -rotate-3"></div>
          </div>
        </div>
      </div>
    </section>
  );
}
