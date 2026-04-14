import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Calendar, MapPin, Filter } from "lucide-react";
import { PageTransition } from "../components/layout/PageTransition";
import { EventCard } from "../components/features/EventCard";
import { Button } from "../components/ui/Button";
import { fetchAPI } from "../lib/api";
import { CityEvent } from "../lib/types";

export function Events() {
  const [filter, setFilter] = useState("all");
  const [events, setEvents] = useState<CityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const eventsData = await fetchAPI<CityEvent[]>("/events");
        setEvents(eventsData);
      } catch (error) {
        console.error("Failed to fetch events", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredEvents = events.filter(e => filter === "all" || e.category.toLowerCase() === filter);

  if (loading) return <div className="min-h-screen bg-brand-dark flex items-center justify-center text-white">Loading...</div>;

  return (
    <PageTransition>
      <div className="pt-32 pb-20 container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
          <div>
            <h1 className="text-5xl md:text-7xl font-display font-bold text-white mb-4">Events</h1>
            <p className="text-xl text-gray-400 max-w-2xl">
              What's happening in the city this week.
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button variant={filter === "all" ? "neon" : "outline"} onClick={() => setFilter("all")}>All</Button>
            <Button variant={filter === "music" ? "neon" : "outline"} onClick={() => setFilter("music")}>Music</Button>
            <Button variant={filter === "art" ? "neon" : "outline"} onClick={() => setFilter("art")}>Art</Button>
            <Button variant={filter === "market" ? "neon" : "outline"} onClick={() => setFilter("market")}>Markets</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredEvents.map((event) => (
            <motion.div 
              key={event.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <EventCard event={event} />
            </motion.div>
          ))}
        </div>
      </div>
    </PageTransition>
  );
}
