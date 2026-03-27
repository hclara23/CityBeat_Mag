import { Metadata } from 'next'
import { Button } from '@/src/components/ui/Button'
import { NewsletterSignup } from '@/src/components/features/NewsletterSignup'
import { CheckCircle2, Megaphone, Target, BarChart3 } from "lucide-react"

export const metadata: Metadata = {
  title: 'Advertise with CityBeat',
  description: 'Reach our highly engaged audience through creative advertising partnerships.',
}

export default async function AdvertisePage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params

  const features = [
    {
      icon: <Target className="w-12 h-12 text-brand-neon" />,
      title: locale === 'es' ? 'Alcance Segmentado' : 'Targeted Reach',
      desc: locale === 'es' ? 'Llega a una audiencia urbana joven y comprometida.' : 'Reach a young, engaged urban audience.'
    },
    {
      icon: <Megaphone className="w-12 h-12 text-brand-neon" />,
      title: locale === 'es' ? 'Publicidad Nativa' : 'Native Advertising',
      desc: locale === 'es' ? 'Historias patrocinadas que se sienten orgánicas.' : 'Sponsored stories that feel organic and authentic.'
    },
    {
      icon: <BarChart3 className="w-12 h-12 text-brand-neon" />,
      title: locale === 'es' ? 'Datos y Métricas' : 'Data & Analytics',
      desc: locale === 'es' ? 'Reportes detallados de impresiones y clics.' : 'Detailed reporting on impressions and engagement.'
    }
  ]

  return (
    <main className="min-h-screen bg-brand-dark pt-32 pb-20">
      <div className="container mx-auto px-4 max-w-6xl">
        <header className="mb-20 text-center max-w-3xl mx-auto">
          <span className="inline-block px-3 py-1 rounded mb-4 text-xs font-bold uppercase tracking-widest bg-brand-neon text-black">
            {locale === 'es' ? 'Publicidad' : 'Advertising'}
          </span>
          <h1 className="text-5xl md:text-7xl font-display font-bold text-white mb-8 leading-tight">
            {locale === 'es' ? 'Conecta con tu ciudad.' : 'Connect with your city.'}
          </h1>
          <p className="text-xl text-gray-300 font-light leading-relaxed">
            {locale === 'es'
              ? 'Ofrecemos soluciones publicitarias innovadoras para marcas que quieren ser parte de la conversación local.'
              : 'We offer innovative advertising solutions for brands that want to be part of the local conversation.'}
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Button variant="neon" size="lg">
              {locale === 'es' ? 'Empezar' : 'Get Started'}
            </Button>
            <Button variant="outline" size="lg">
              {locale === 'es' ? 'Media Kit' : 'Download Media Kit'}
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-32">
          {features.map((f, i) => (
            <div key={i} className="p-8 bg-brand-charcoal rounded-3xl border border-white/5 hover:border-brand-neon/30 transition-all group">
              <div className="mb-6 transform group-hover:scale-110 transition-transform duration-500">{f.icon}</div>
              <h3 className="text-2xl font-display font-bold text-white mb-4">{f.title}</h3>
              <p className="text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-brand-neon text-black rounded-3xl p-12 md:p-20 overflow-hidden relative group">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="max-w-xl">
              <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">
                {locale === 'es' ? '¿Listo para colaborar?' : 'Ready to collaborate?'}
              </h2>
              <p className="text-lg font-medium opacity-80 mb-8">
                {locale === 'es'
                  ? 'Nuestro equipo de estrategia creativa te ayudará a diseñar una campaña que resuene con nuestra audiencia.'
                  : 'Our creative strategy team will help you design a campaign that resonates with our audience.'}
              </p>
              <ul className="space-y-4 mb-8">
                {[
                  locale === 'es' ? 'Contenido de marca personalizado' : 'Custom branded content',
                  locale === 'es' ? 'Colocación de anuncios premium' : 'Premium display ad placement',
                  locale === 'es' ? 'Patrocinios de boletines' : 'Newsletter sponsorships'
                ].map((item, j) => (
                  <li key={j} className="flex items-center gap-3 font-bold">
                    <CheckCircle2 size={20} /> {item}
                  </li>
                ))}
              </ul>
              <Button className="bg-black text-white px-10 py-6 text-lg hover:bg-gray-900 transition-colors">
                {locale === 'es' ? 'Contactar Ventas' : 'Contact Sales'}
              </Button>
            </div>
            <div className="hidden lg:block w-72 h-72 rounded-full bg-black/10 animate-pulse" />
          </div>
          {/* Decorative accents */}
          <div className="absolute -top-24 -right-24 w-64 h-64 border-4 border-black/10 rounded-full group-hover:scale-125 transition-transform duration-700" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 border-4 border-black/10 rounded-full group-hover:scale-110 transition-transform duration-700" />
        </div>
      </div>
      <NewsletterSignup />
    </main>
  )
}
