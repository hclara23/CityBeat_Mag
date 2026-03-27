import Image from 'next/image'
import { Button } from '@/src/components/ui/Button'
import { Calendar, MapPin, Clock, ArrowRight } from "lucide-react"

export const metadata = {
  title: 'City Events | CityBeat',
  description: 'Discover the best events happening in our city.',
}

export default async function EventsPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params

  const events = [
    {
      id: 1,
      title: locale === 'es' ? "Festival de Jazz en el Parque" : "Jazz in the Park Festival",
      date: "2024-05-15",
      time: "18:00",
      location: locale === 'es' ? "Parque Central" : "Central Park",
      image: "https://images.unsplash.com/photo-1514525253361-bee8718a300a?auto=format&fit=crop&q=80&w=800",
      category: locale === 'es' ? "Música" : "Music"
    },
    {
      id: 2,
      title: locale === 'es' ? "Exposición de Arte Vanguardista" : "Avante-Garde Art Exhibition",
      date: "2024-05-20",
      time: "10:00",
      location: locale === 'es' ? "Galería Metropolitana" : "Metropolitan Gallery",
      image: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&q=80&w=800",
      category: locale === 'es' ? "Arte" : "Art"
    },
    {
      id: 3,
      title: locale === 'es' ? "Tour Gastronómico Nocturno" : "Night Street Food Tour",
      date: "2024-05-22",
      time: "20:00",
      location: locale === 'es' ? "Barrio Viejo" : "Old Quarter",
      image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=800",
      category: locale === 'es' ? "Comida" : "Food"
    }
  ]

  return (
    <main className="min-h-screen bg-brand-dark pt-32 pb-20">
      <div className="container mx-auto px-4">
        <header className="mb-16 text-center max-w-3xl mx-auto">
          <span className="inline-block px-3 py-1 rounded mb-4 text-xs font-bold uppercase tracking-widest bg-brand-neon text-black">
            {locale === 'es' ? 'Qué Hacer' : 'What\'s On'}
          </span>
          <h1 className="text-5xl md:text-7xl font-display font-bold text-white mb-6 leading-tight">
            {locale === 'es' ? 'Eventos de la Ciudad' : 'City Events'}
          </h1>
          <p className="text-xl text-gray-400 font-light">
            {locale === 'es' 
              ? 'Tu guía definitiva para la mejor música, arte y cultura local.' 
              : 'Your definitive guide to the best local music, art, and culture.'}
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-20">
          {events.map((event) => (
            <div key={event.id} className="group bg-brand-charcoal rounded-3xl overflow-hidden border border-white/5 flex flex-col md:flex-row shadow-2xl hover:border-brand-neon/30 transition-all duration-500">
              <div className="relative w-full md:w-2/5 aspect-[4/3] md:aspect-auto overflow-hidden">
                <Image 
                  src={event.image} 
                  alt={event.title} 
                  fill 
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                  unoptimized
                />
                <div className="absolute top-4 left-4">
                  <span className="px-3 py-1 bg-black/60 backdrop-blur-md text-brand-neon text-[10px] font-bold uppercase tracking-widest rounded-full border border-brand-neon/30">
                    {event.category}
                  </span>
                </div>
              </div>
              <div className="p-8 flex-1 flex flex-col">
                <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                  <span className="flex items-center gap-2">
                    <Calendar size={14} className="text-brand-neon" />
                    {new Date(event.date).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="flex items-center gap-2">
                    <Clock size={14} className="text-brand-neon" />
                    {event.time}
                  </span>
                </div>
                <h3 className="text-2xl font-display font-bold text-white mb-4 leading-tight group-hover:text-brand-neon transition-colors">
                  {event.title}
                </h3>
                <div className="flex items-start gap-2 text-gray-400 text-sm mb-8">
                  <MapPin size={16} className="text-brand-neon mt-1 flex-shrink-0" />
                  <span>{event.location}</span>
                </div>
                <div className="mt-auto">
                  <Button variant="outline" className="w-full justify-between group/btn">
                    {locale === 'es' ? 'Más Info' : 'More Info'}
                    <ArrowRight size={16} className="transition-transform group-hover/btn:translate-x-1" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-12 bg-brand-neon rounded-3xl text-black text-center relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-4xl font-display font-bold mb-4">
              {locale === 'es' ? '¿Organizas un evento?' : 'Hosting an event?'}
            </h2>
            <p className="text-lg font-medium opacity-80 mb-8 max-w-xl mx-auto">
              {locale === 'es'
                ? 'Promociona tu evento con nosotros y llega a miles de entusiastas de la cultura local.'
                : 'Promote your event with us and reach thousands of local culture enthusiasts.'}
            </p>
            <Button size="lg" className="bg-black text-white hover:bg-gray-800 transition-colors px-12">
              {locale === 'es' ? 'Publicar Evento' : 'Submit Event'}
            </Button>
          </div>
          {/* Decorative shapes */}
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full border-2 border-black/10" />
        </div>
      </div>
    </main>
  )
}
