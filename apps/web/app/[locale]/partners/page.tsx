import { Metadata } from 'next'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'Our Partners | CityBeat',
  description: 'The brands and organizations that support us.',
}

export default async function PartnersPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params

  const partners = [
    { name: "Brand One", logo: "https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?auto=format&fit=crop&q=80&w=400" },
    { name: "Brand Two", logo: "https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?auto=format&fit=crop&q=80&w=400" },
    { name: "Brand Three", logo: "https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?auto=format&fit=crop&q=80&w=400" },
    { name: "Brand Four", logo: "https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?auto=format&fit=crop&q=80&w=400" }
  ]

  return (
    <main className="min-h-screen bg-brand-dark pt-32 pb-20 text-white">
      <div className="container mx-auto px-4 max-w-4xl text-center">
        <header className="mb-20">
          <span className="inline-block px-3 py-1 rounded mb-4 text-xs font-bold uppercase tracking-widest bg-brand-neon text-black">
            {locale === 'es' ? 'Comunidad' : 'Community'}
          </span>
          <h1 className="text-5xl md:text-7xl font-display font-bold mb-8">
            {locale === 'es' ? 'Nuestros Socios' : 'Our Partners'}
          </h1>
          <p className="text-xl text-gray-400 font-light max-w-2xl mx-auto">
            {locale === 'es' 
              ? 'Trabajamos con las mejores marcas y organizaciones locales para traer contenido de calidad a nuestra ciudad.' 
              : 'We work with the best local brands and organizations to bring high-quality content to our city.'}
          </p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-32">
          {partners.map((p, i) => (
            <div key={i} className="aspect-square bg-brand-charcoal rounded-3xl border border-white/5 flex items-center justify-center p-8 grayscale hover:grayscale-0 transition-all duration-500 group">
              <div className="relative w-full h-full">
                <Image 
                  src={p.logo} 
                  alt={p.name} 
                  fill 
                  className="object-contain opacity-40 group-hover:opacity-100 transition-opacity"
                  unoptimized
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
