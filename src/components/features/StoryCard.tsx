'use client'

import Link from "next/link";
import { motion } from "framer-motion";
import { Clock, ArrowUpRight } from "lucide-react";
import { Story } from "@/src/lib/types";
import { cn, formatDate } from "@/src/lib/utils";

interface StoryCardProps {
  story: Story;
  locale?: string;
  variant?: "default" | "featured" | "compact" | "sponsored";
  className?: string;
}

export function StoryCard({ story, locale = "en", variant = "default", className }: StoryCardProps) {
  const isFeatured = variant === "featured";
  const isSponsored = variant === "sponsored" || story.isSponsored;

  if (isFeatured) {
    return (
      <Link href={`/${locale}/article/${story.slug}`} className={cn("group block relative w-full overflow-hidden rounded-2xl aspect-[16/10]", className)}>
        <div className="absolute inset-0 bg-gray-900">
          <motion.img
            src={story.heroImage}
            alt={story.title}
            className="w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity duration-500"
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.6 }}
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        
        <div className="absolute bottom-0 left-0 p-8 w-full md:w-2/3">
          <div className="flex items-center gap-3 mb-3">
            <span className={cn("text-xs font-bold uppercase tracking-widest px-2 py-1 rounded bg-white/10 backdrop-blur-sm", story.category.color)}>
              {story.category.name}
            </span>
            <span className="text-gray-400 text-xs flex items-center gap-1">
              <Clock size={12} /> {story.readTime}
            </span>
          </div>
          
          <h2 className="text-3xl md:text-5xl font-display font-bold text-white mb-3 leading-tight group-hover:text-brand-neon transition-colors">
            {story.title}
          </h2>
          
          <p className="text-gray-300 text-lg line-clamp-2 mb-4 font-light">
            {story.dek}
          </p>
          
          <div className="flex items-center gap-3">
            <img src={story.author.avatar} alt={story.author.name} className="w-8 h-8 rounded-full border border-white/20" />
            <span className="text-sm text-white font-medium">By {story.author.name}</span>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/${locale}/article/${story.slug}`} className={cn("group flex flex-col gap-4", className)}>
      <div className="relative overflow-hidden rounded-xl aspect-[3/2] bg-gray-900">
        {isSponsored && (
          <div className="absolute top-2 right-2 z-10 bg-white/90 text-black text-[10px] font-bold uppercase px-2 py-0.5 rounded tracking-wider">
            Sponsored
          </div>
        )}
        <motion.img
          src={story.heroImage}
          alt={story.title}
          className="w-full h-full object-cover opacity-90 group-hover:opacity-75 transition-opacity duration-500"
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.4 }}
        />
      </div>
      
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className={cn("text-xs font-bold uppercase tracking-wider", story.category.color)}>
            {story.category.name}
          </span>
          <span className="text-gray-500 text-xs">{formatDate(story.date)}</span>
        </div>
        
        <h3 className="text-xl font-display font-bold text-white leading-tight group-hover:text-brand-neon transition-colors">
          {story.title}
        </h3>
        
        <p className="text-gray-400 text-sm line-clamp-2">
          {story.dek}
        </p>
        
        {isSponsored ? (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500 uppercase">Presented by</span>
            <span className="text-xs font-bold text-white">{story.sponsorName}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-1 opacity-60 group-hover:opacity-100 transition-opacity">
            <span className="text-xs text-white font-medium border-b border-transparent group-hover:border-brand-neon transition-all">Read Story</span>
            <ArrowUpRight size={12} className="text-brand-neon" />
          </div>
        )}
      </div>
    </Link>
  );
}
