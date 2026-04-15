import { Metadata } from 'next'
import Image from 'next/image'
import { Button } from '@/src/components/ui/Button'
import { NewsletterSignup } from '@/src/components/features/NewsletterSignup'

export const metadata: Metadata = {
  title: 'About CityBeat Magazine',
  description: 'The heartbeat of our city. Culture, news, and community.',
}

export default async function AboutPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params

  return (
    <main className="min-h-screen bg-brand-dark pt-32 pb-20">
      <div className="container mx-auto px-4 max-w-4xl">
        <header className="mb-16">
          <span className="inline-block px-3 py-1 rounded mb-4 text-xs font-bold uppercase tracking-widest bg-brand-neon text-black">
            {locale === 'es' ? 'Sobre Nosotros' : 'About Us'}
          </span>
          <h1 className="text-5xl md:text-7xl font-display font-bold text-white mb-8 leading-tight">
            {locale === 'es' 
              ? 'El latido de nuestra ciudad.' 
              : 'The heartbeat of our city.'}
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 font-light leading-relaxed">
            {locale === 'es'
              ? 'CityBeat es una publicación independiente dedicada a capturar la esencia de la vida urbana a través de historias profundas, fotografía vibrante y una perspectiva comunitaria única.'
              : 'CityBeat is an independent publication dedicated to capturing the essence of urban life through deep storytelling, vibrant photography, and a unique community perspective.'}
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-20 animate-in fade-in slide-in-from-bottom-5 duration-700">
          <div className="relative aspect-[4/5] rounded-2xl overflow-hidden border border-white/10 group">
            <Image 
              src="https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&q=80&w=800" 
              alt="City Scene" 
              fill 
              className="object-cover transition-transform duration-700 group-hover:scale-110"
              unoptimized
            />
          </div>
          <div className="flex flex-col justify-center space-y-8">
            <div className="space-y-4">
              <h2 className="text-3xl font-display font-bold text-white">
                {locale === 'es' ? 'Nuestra Misión' : 'Our Mission'}
              </h2>
              <p className="text-gray-400 leading-relaxed text-lg">
                {locale === 'es'
                  ? 'Nuestro objetivo es amplificar las voces diversas de nuestra comunidad, explorando la intersección entre cultura, política y vida cotidiana en el entorno urbano moderno.'
                  : 'We aim to amplify the diverse voices of our community, exploring the intersection of culture, politics, and daily life in the modern urban environment.'}
              </p>
            </div>
            <div className="space-y-4">
              <h2 className="text-3xl font-display font-bold text-white">
                {locale === 'es' ? 'Nuestro Equipo' : 'Our Team'}
              </h2>
              <p className="text-gray-400 leading-relaxed text-lg">
                {locale === 'es'
                  ? 'Somos un colectivo de periodistas, fotógrafos y diseñadores apasionados por la ciudad y comprometidos con el periodismo de calidad.'
                  : 'We are a collective of journalists, photographers, and designers passionate about the city and committed to high-quality journalism.'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-brand-charcoal rounded-3xl p-12 border border-white/5 text-center">
          <h2 className="text-4xl font-display font-bold text-white mb-6">
            {locale === 'es' ? 'Únete a la Conversación' : 'Join the Conversation'}
          </h2>
          <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
            {locale === 'es'
              ? 'Suscríbete a nuestro boletín semanal para recibir las mejores historias directamente en tu bandeja de entrada.'
              : 'Subscribe to our weekly newsletter to get the best stories delivered straight to your inbox.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="neon" size="lg">
              {locale === 'es' ? 'Suscribirse' : 'Subscribe Now'}
            </Button>
            <Button variant="outline" size="lg">
              {locale === 'es' ? 'Contáctanos' : 'Contact Us'}
            </Button>
          </div>
        </div>
      </div>
      <NewsletterSignup />
    </main>
  )
}
