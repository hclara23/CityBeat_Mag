import Link from 'next/link'

type Locale = 'en' | 'es'

const COPY = {
  en: {
    eyebrow: 'Know what each plan includes',
    title: 'Free control or Premium growth tools',
    intro: 'Claiming is free. Premium is optional and adds the tools that help a listing stand out, capture customers, and measure results.',
    freeName: 'Claimed Basic',
    freePrice: '$0 forever',
    freeSummary: 'Own and maintain the essential facts customers need.',
    freeFeatures: [
      'Verified owner access after approval',
      'Edit name, category, phone, website, address, service area, and hours',
      'Reply to reviews and download a review QR code',
      'Public bilingual page with local-business SEO markup',
      'Rolling 30-day headline analytics',
      'See new leads with contact details masked',
    ],
    paidName: 'Premium',
    paidPrice: '$19.99/month',
    paidAnnual: 'or $199/year',
    paidSummary: 'Everything in Basic, plus richer content, complete leads, and performance tools.',
    paidFeatures: [
      'Custom description, cover image, and gallery of up to 15 photos',
      'Full customer name, contact details, and message delivered immediately',
      'Services, products, offers, posts, social links, and action buttons',
      'Daily analytics, comparisons, history, and CSV export',
      'Access for up to 3 additional managers',
      'Larger Premium card shown before Basic listings',
      'Richer on-page content and structured data for stronger SEO opportunities',
    ],
    note: 'Premium does not guarantee a Google ranking or the top category position. Guaranteed top-of-category placement and the Featured badge belong to the Featured plan.',
    cta: 'Claim or compare plans',
  },
  es: {
    eyebrow: 'Conoce lo que incluye cada plan',
    title: 'Control gratis o herramientas Premium para crecer',
    intro: 'Reclamar tu ficha es gratis. Premium es opcional y agrega herramientas para destacar, captar clientes y medir resultados.',
    freeName: 'Básico reclamado',
    freePrice: '$0 para siempre',
    freeSummary: 'Administra la información esencial que necesitan tus clientes.',
    freeFeatures: [
      'Acceso de propietario verificado después de la aprobación',
      'Edita nombre, categoría, teléfono, sitio web, dirección, área de servicio y horario',
      'Responde reseñas y descarga un QR para solicitar reseñas',
      'Página pública bilingüe con datos SEO de negocio local',
      'Totales principales de analíticas de los últimos 30 días',
      'Ve nuevos prospectos con los datos de contacto ocultos',
    ],
    paidName: 'Premium',
    paidPrice: '$19.99/mes',
    paidAnnual: 'o $199/año',
    paidSummary: 'Todo lo de Básico, más contenido enriquecido, prospectos completos y herramientas de rendimiento.',
    paidFeatures: [
      'Descripción personalizada, imagen de portada y galería de hasta 15 fotos',
      'Nombre, contacto y mensaje completo del cliente, entregados de inmediato',
      'Servicios, productos, ofertas, publicaciones, redes sociales y botones de acción',
      'Analíticas diarias, comparativas, historial y exportación CSV',
      'Acceso para hasta 3 administradores adicionales',
      'Tarjeta Premium más grande, mostrada antes de las fichas Básicas',
      'Más contenido y datos estructurados para mejores oportunidades de SEO',
    ],
    note: 'Premium no garantiza una posición en Google ni el primer lugar de la categoría. La posición garantizada arriba de la categoría y la insignia Destacado pertenecen al plan Destacado.',
    cta: 'Reclamar o comparar planes',
  },
} as const

function FeatureList({ items, accent }: { items: readonly string[]; accent: 'free' | 'premium' }) {
  return (
    <ul className="mt-5 space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-white/75">
          <span className={`mt-0.5 font-black ${accent === 'premium' ? 'text-brand-neon' : 'text-white/45'}`} aria-hidden>
            ✓
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function DirectoryPlanComparison({
  locale,
  ctaHref,
  compact = false,
  className = '',
}: {
  locale: Locale
  ctaHref?: string
  compact?: boolean
  className?: string
}) {
  const t = COPY[locale]

  return (
    <section
      aria-labelledby="directory-plan-comparison-title"
      className={`rounded-2xl border border-white/10 bg-black/35 ${compact ? 'p-5' : 'p-6 sm:p-8'} ${className}`}
    >
      <div className="max-w-3xl">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-neon">{t.eyebrow}</p>
        <h2 id="directory-plan-comparison-title" className={`${compact ? 'text-xl' : 'text-2xl sm:text-3xl'} mt-2 font-display font-black uppercase tracking-tight text-white`}>
          {t.title}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-white/65">{t.intro}</p>
      </div>

      <div className={`mt-6 grid gap-4 ${compact ? 'lg:grid-cols-2' : 'md:grid-cols-2'}`}>
        <article className="rounded-xl border border-white/15 bg-white/[0.035] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">{t.freeName}</p>
              <p className="mt-1 text-2xl font-black text-white">{t.freePrice}</p>
            </div>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white/60">
              {locale === 'es' ? 'Esencial' : 'Essentials'}
            </span>
          </div>
          <p className="mt-3 text-sm text-white/60">{t.freeSummary}</p>
          <FeatureList items={t.freeFeatures} accent="free" />
        </article>

        <article className="relative overflow-hidden rounded-xl border border-brand-neon/50 bg-gradient-to-b from-brand-neon/[0.09] to-brand-ink/80 p-5 shadow-[0_0_28px_rgba(0,240,255,0.08)] sm:p-6">
          <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-brand-neon/10 blur-3xl" aria-hidden />
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-neon">{t.paidName}</p>
              <p className="mt-1 text-2xl font-black text-white">{t.paidPrice}</p>
              <p className="text-xs font-bold text-brand-neon/75">{t.paidAnnual}</p>
            </div>
            <span className="rounded-full bg-brand-neon px-3 py-1 text-[10px] font-black uppercase tracking-wider text-black">
              {locale === 'es' ? 'Más herramientas' : 'More tools'}
            </span>
          </div>
          <p className="relative mt-3 text-sm text-white/70">{t.paidSummary}</p>
          <div className="relative"><FeatureList items={t.paidFeatures} accent="premium" /></div>
        </article>
      </div>

      <div className="mt-5 flex flex-col gap-4 rounded-xl border border-brand-gold/20 bg-brand-gold/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-white/60">{t.note}</p>
        {ctaHref && (
          <Link href={ctaHref} className="inline-flex min-h-[42px] shrink-0 items-center justify-center rounded-md bg-brand-neon px-4 py-2 text-xs font-black uppercase tracking-wider text-black transition hover:bg-cyan-300">
            {t.cta} →
          </Link>
        )}
      </div>
    </section>
  )
}
