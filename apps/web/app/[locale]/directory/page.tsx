import { Metadata } from 'next'
import { Button } from '@/src/components/ui/Button'
import { Search, MapPin, Phone, Globe } from "lucide-react"

export const metadata: Metadata = {
  title: 'City Directory | CityBeat',
  description: 'The curated guide to the best spots in our city.',
}

export default async function DirectoryPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params

  const categories = [
    { name: locale === 'es' ? "Restaurantes" : "Restaurants", count: 42 },
    { name: locale === 'es' ? "Bares y Vida Nocturna" : "Bars & Nightlife", count: 28 },
    { name: locale === 'es' ? "Tiendas" : "Shopping", count: 15 },
    { name: locale === 'es' ? "Salud" : "Health", count: 34 }
  ]

  const listings = [
    {
      name: "Café Horizonte",
      category: locale === 'es' ? "Café" : "Coffee Shop",
      address: "Calle de la Luna 15",
      phone: "+34 912 345 678",
      website: "cafehorizonte.com"
    },
    {
      name: "Neo Bar",
      category: locale === 'es' ? "Vinos" : "Wine Bar",
      address: "Avenida Central 32",
      phone: "+34 912 987 654",
      website: "neobar.com"
    }
  ]

  return (
    <main className="min-h-screen bg-brand-dark pt-32 pb-20 text-white">
      <div className="container mx-auto px-4 max-w-6xl">
        <header className="mb-12">
          <span className="inline-block px-3 py-1 rounded mb-4 text-xs font-bold uppercase tracking-widest bg-brand-neon text-black">
            {locale === 'es' ? 'Guía Local' : 'Local Guide'}
          </span>
          <h1 className="text-5xl md:text-7xl font-display font-bold mb-8">
            {locale === 'es' ? 'Directorio' : 'Directory'}
          </h1>
          
          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
            <input 
              type="text" 
              placeholder={locale === 'es' ? 'Buscar lugares...' : 'Search places...'} 
              className="w-full bg-brand-charcoal border border-white/10 rounded-2xl py-5 pl-12 pr-6 focus:ring-2 focus:ring-brand-neon focus:border-transparent outline-none transition-all text-lg"
            />
          </div>
        </header>

        <div className="flex flex-wrap gap-4 mb-16">
          {categories.map((cat, i) => (
            <button key={i} className="px-6 py-3 rounded-full bg-brand-charcoal border border-white/5 hover:border-brand-neon transition-all flex items-center gap-3">
              <span className="font-bold uppercase tracking-wider text-xs">{cat.name}</span>
              <span className="text-brand-neon font-mono text-[10px]">{cat.count}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {listings.map((item, j) => (
            <div key={j} className="p-8 bg-brand-charcoal rounded-3xl border border-white/5 hover:border-brand-neon/30 transition-all group">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-neon mb-4 inline-block">
                {item.category}
              </span>
              <h3 className="text-2xl font-display font-bold mb-6 group-hover:text-brand-neon transition-colors">
                {item.name}
              </h3>
              <ul className="space-y-4 text-gray-400 text-sm mb-8">
                <li className="flex items-center gap-3">
                  <MapPin size={16} className="text-brand-neon" /> {item.address}
                </li>
                <li className="flex items-center gap-3">
                  <Phone size={16} className="text-brand-neon" /> {item.phone}
                </li>
                <li className="flex items-center gap-3">
                  <Globe size={16} className="text-brand-neon" /> {item.website}
                </li>
              </ul>
              <Button variant="outline" className="w-full">
                {locale === 'es' ? 'Ver Perfil' : 'View Profile'}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
