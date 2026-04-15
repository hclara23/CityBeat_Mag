'use client'

import React from "react";
import { MapPin, Calendar } from "lucide-react";
import { CityEvent } from "@/src/lib/types";
import { Button } from "../ui/Button";

export const EventCard: React.FC<{ event: CityEvent }> = ({ event }) => {
  return (
    <div className="group relative bg-brand-charcoal border border-white/5 rounded-xl overflow-hidden hover:border-brand-neon/50 transition-colors">
      <div className="aspect-video overflow-hidden">
        <img 
          src={event.image || "https://images.unsplash.com/photo-1514525253344-9f0aa3641772?q=80&w=2670&auto=format&fit=crop"} 
          alt={event.title} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      
      <div className="p-5">
        <div className="flex justify-between items-start mb-2">
          <span className="text-brand-neon text-xs font-bold uppercase tracking-wider">{event.category}</span>
          <span className="text-white font-mono text-sm">{event.price}</span>
        </div>
        
        <h3 className="text-xl font-display font-bold text-white mb-2 group-hover:text-brand-neon transition-colors">
          {event.title}
        </h3>
        
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Calendar size={14} />
            <span>{new Date(event.date).toLocaleDateString()} • {event.time}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <MapPin size={14} />
            <span>{event.venue}</span>
          </div>
        </div>
        
        <Button variant="outline" size="sm" className="w-full group-hover:bg-white group-hover:text-black transition-colors">
          Get Tickets
        </Button>
      </div>
    </div>
  );
}
