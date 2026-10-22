import type { Metadata } from 'next'
import Link from 'next/link'
import { getPremiumProof } from '@/lib/premium-proof-server'
import { proofTiles } from '@/lib/premium-proof'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { DirectoryPlanComparison } from '@/components/citybeat/DirectoryPlanComparison'
import { withLocale, type Locale } from '@/components/citybeat/content'
import { localeAlternates } from '@/lib/seo'

// Tile labels live beside the page rather than in the pure module, which must
// stay free of presentation so it can be unit-tested as a decision.
const PROOF_LABELS: Record<'en' | 'es', Record<string, string>> = {
  en: { website: 'website clicks', directions: 'directions', calls: 'calls', leads: 'leads' },
  es: { website: 'clics web', directions: 'indicaciones', calls: 'llamadas', leads: 'prospectos' },
}

export async function generateMetadata(props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const params = await props.params;
  const es = params.locale === 'es'
  const title = es ? 'Fichas de negocios Premium · CityBeat' : 'Premium Business Listings · CityBeat'
  const description = es
    ? 'Convierte tu ficha de CityBeat en un canal de clientes medible con prospectos completos, contenido enriquecido y reportes de resultados.'
    : 'Turn your CityBeat business listing into a measurable local customer channel with full leads, richer content, and performance reporting.'
  const alternates = localeAlternates(params.locale, '/premium')
  return { title, description, alternates,
    openGraph: { title, description, url: alternates.canonical, type: 'website', images: ['/api/og'] },
    twitter: { card: 'summary_large_image', title, description, images: ['/api/og'] } }
}

export default async function PremiumPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const locale: Locale = params.locale === 'es' ? 'es' : 'en'
  const es = locale === 'es'
  // Day-cached and failure-tolerant: returns null rather than throwing, and the
  // panel below is omitted entirely when it does.
  const proof = await getPremiumProof()
  const outcomes = es
    ? ['Llamadas, clics web, indicaciones y solicitudes en un solo panel', 'Datos completos de cada prospecto', 'Contenido bilingüe, ofertas, servicios y botones de acción', 'Reporte mensual y resumen imprimible de resultados']
    : ['Calls, website clicks, directions, and leads in one dashboard', 'Complete contact details for every lead', 'Bilingual content, offers, services, and action buttons', 'Monthly reporting and a printable performance summary']
  return (
    <CityBeatShell locale={locale}>
      <div className="container-wide py-16">
        <section className={`grid gap-10 lg:items-center ${proof ? 'lg:grid-cols-[1.1fr_.9fr]' : ''}`}>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-neon">{es ? 'Crece con CityBeat' : 'Grow with CityBeat'}</p>
            <h1 className="mt-4 max-w-4xl font-display text-5xl font-black uppercase leading-[.92] text-white md:text-7xl">{es ? 'Convierte tu ficha en un canal de clientes medible.' : 'Turn your listing into a measurable customer channel.'}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/65">{es ? 'Reclamar es gratis y no requiere tarjeta. Premium agrega contenido, prospectos completos y pruebas claras de lo que CityBeat genera para tu negocio.' : 'Claiming is free and requires no card. Premium adds richer content, complete leads, and clear proof of what CityBeat delivers for your business.'}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={withLocale(locale, '/directory')} className="rounded-md bg-brand-neon px-5 py-3 text-xs font-black uppercase tracking-wider text-black">{es ? 'Reclamar gratis' : 'Claim free—no card'}</Link>
              <a href="#compare" className="rounded-md border border-white/20 px-5 py-3 text-xs font-black uppercase tracking-wider text-white">{es ? 'Comparar planes' : 'Compare plans'}</a>
            </div>
          </div>
          {/* Real numbers from a real paid listing, or nothing at all. This panel
              used to show invented figures (14 actions: 6/4/3/1) behind a
              disclaimer admitting they were only indicative — honest about being
              fiction, but the page's whole argument is that Premium gives you
              REAL measurement, so illustrating that with fiction undercut the
              very product being sold. The figures
              are now the median of the sampled paid listings, anonymised, and
              the panel is omitted when the data cannot carry the claim. */}
          {proof && (
            <div className="rounded-2xl border border-brand-neon/30 bg-brand-neon/[0.06] p-7">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-neon">{es ? 'Resultados reales' : 'Real results'}</p>
              <p className="mt-3 font-display text-6xl font-black text-white">{proof.actions}</p>
              <p className="text-sm text-white/60">{es ? `acciones de clientes en ${proof.windowDays} días` : `customer actions in ${proof.windowDays} days`}</p>
              {proofTiles(proof).length > 0 && (
                <div className="mt-6 grid grid-cols-2 gap-3 text-center">
                  {proofTiles(proof).map((tile) => (
                    <div key={tile.key} className="rounded-lg bg-black/25 p-3">
                      <strong className="block text-2xl text-white">{tile.value}</strong>
                      <span className="text-xs text-white/45">{PROOF_LABELS[es ? 'es' : 'en'][tile.key]}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-4 rounded border border-white/20 p-3 text-sm font-semibold text-white/80">
                {es
                  ? `Cifras reales de una ficha Premium de CityBeat: la mediana de ${proof.sampleSize} negocios de paga, sin identificar a ninguno. Los resultados varían según el negocio y la categoría.`
                  : `Real figures from a CityBeat Premium listing — the median of ${proof.sampleSize} paying businesses, shown without identifying any of them. Results vary by business and category.`}
              </p>
            </div>
          )}
        </section>

        <section className="mt-16 grid gap-4 md:grid-cols-2">{outcomes.map((item) => <div key={item} className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm font-bold text-white/75"><span className="mr-2 text-brand-neon">✓</span>{item}</div>)}</section>
        <div id="compare" className="mt-16"><DirectoryPlanComparison locale={locale} ctaHref={withLocale(locale, '/directory')} /></div>
        <section className="mt-16 rounded-2xl border border-brand-gold/25 bg-brand-gold/[0.05] p-8 text-center"><h2 className="font-display text-3xl font-black uppercase text-white">{es ? 'Sin promesas infladas.' : 'No inflated promises.'}</h2><p className="mx-auto mt-3 max-w-3xl text-sm leading-relaxed text-white/60">{es ? 'Premium no garantiza una posición en Google ni un número de clientes. Te da una ficha más completa, mejores oportunidades de SEO, prospectos completos y medición transparente.' : 'Premium does not guarantee a Google position or a number of customers. It gives you a richer listing, stronger SEO opportunities, complete leads, and transparent measurement.'}</p></section>
      </div>
    </CityBeatShell>
  )
}
