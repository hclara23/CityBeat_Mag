import type { Metadata } from 'next'
import Link from 'next/link'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { DirectoryPlanComparison } from '@/components/citybeat/DirectoryPlanComparison'
import { withLocale, type Locale } from '@/components/citybeat/content'

export const metadata: Metadata = {
  title: 'Premium Business Listings · CityBeat',
  description: 'Turn your CityBeat business listing into a measurable local customer channel with full leads, richer content, and performance reporting.',
}

export default function PremiumPage({ params }: { params: { locale: string } }) {
  const locale: Locale = params.locale === 'es' ? 'es' : 'en'
  const es = locale === 'es'
  const outcomes = es
    ? ['Llamadas, clics web, indicaciones y solicitudes en un solo panel', 'Datos completos de cada prospecto', 'Contenido bilingüe, ofertas, servicios y botones de acción', 'Reporte mensual y resumen imprimible de resultados']
    : ['Calls, website clicks, directions, and leads in one dashboard', 'Complete contact details for every lead', 'Bilingual content, offers, services, and action buttons', 'Monthly reporting and a printable performance summary']
  return (
    <CityBeatShell locale={locale}>
      <main className="container-wide py-16">
        <section className="grid gap-10 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-neon">{es ? 'Crece con CityBeat' : 'Grow with CityBeat'}</p>
            <h1 className="mt-4 max-w-4xl font-display text-5xl font-black uppercase leading-[.92] text-white md:text-7xl">{es ? 'Convierte tu ficha en un canal de clientes medible.' : 'Turn your listing into a measurable customer channel.'}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/65">{es ? 'Reclamar es gratis y no requiere tarjeta. Premium agrega contenido, prospectos completos y pruebas claras de lo que CityBeat genera para tu negocio.' : 'Claiming is free and requires no card. Premium adds richer content, complete leads, and clear proof of what CityBeat delivers for your business.'}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={withLocale(locale, '/directory')} className="rounded-md bg-brand-neon px-5 py-3 text-xs font-black uppercase tracking-wider text-black">{es ? 'Reclamar gratis' : 'Claim free—no card'}</Link>
              <a href="#compare" className="rounded-md border border-white/20 px-5 py-3 text-xs font-black uppercase tracking-wider text-white">{es ? 'Comparar planes' : 'Compare plans'}</a>
            </div>
          </div>
          <div className="rounded-2xl border border-brand-neon/30 bg-brand-neon/[0.06] p-7">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-neon">{es ? 'Ejemplo de resultados' : 'What owners can measure'}</p>
            <p className="mt-3 font-display text-6xl font-black text-white">14</p>
            <p className="text-sm text-white/60">{es ? 'acciones de clientes en 30 días' : 'customer actions in 30 days'}</p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-center"><div className="rounded-lg bg-black/25 p-3"><strong className="block text-2xl text-white">6</strong><span className="text-xs text-white/45">{es ? 'clics web' : 'website clicks'}</span></div><div className="rounded-lg bg-black/25 p-3"><strong className="block text-2xl text-white">4</strong><span className="text-xs text-white/45">{es ? 'indicaciones' : 'directions'}</span></div><div className="rounded-lg bg-black/25 p-3"><strong className="block text-2xl text-white">3</strong><span className="text-xs text-white/45">{es ? 'acciones' : 'actions'}</span></div><div className="rounded-lg bg-black/25 p-3"><strong className="block text-2xl text-white">1</strong><span className="text-xs text-white/45">lead</span></div></div>
            <p className="mt-4 text-[10px] text-white/35">{es ? 'Ejemplo ilustrativo; los resultados reales varían.' : 'Illustrative example; actual results vary.'}</p>
          </div>
        </section>

        <section className="mt-16 grid gap-4 md:grid-cols-2">{outcomes.map((item) => <div key={item} className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm font-bold text-white/75"><span className="mr-2 text-brand-neon">✓</span>{item}</div>)}</section>
        <div id="compare" className="mt-16"><DirectoryPlanComparison locale={locale} ctaHref={withLocale(locale, '/directory')} /></div>
        <section className="mt-16 rounded-2xl border border-brand-gold/25 bg-brand-gold/[0.05] p-8 text-center"><h2 className="font-display text-3xl font-black uppercase text-white">{es ? 'Sin promesas infladas.' : 'No inflated promises.'}</h2><p className="mx-auto mt-3 max-w-3xl text-sm leading-relaxed text-white/60">{es ? 'Premium no garantiza una posición en Google ni un número de clientes. Te da una ficha más completa, mejores oportunidades de SEO, prospectos completos y medición transparente.' : 'Premium does not guarantee a Google position or a number of customers. It gives you a richer listing, stronger SEO opportunities, complete leads, and transparent measurement.'}</p></section>
      </main>
    </CityBeatShell>
  )
}
