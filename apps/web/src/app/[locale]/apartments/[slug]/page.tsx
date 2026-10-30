import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CityBeatShell } from '@/components/citybeat/CityBeatShell'
import { APARTMENT_COMMUNITIES, APARTMENT_MANAGER, APARTMENT_SOURCE, APARTMENT_VERIFIED, apartmentPhone, communityTypeLabel, getApartment } from '@/lib/apartments'
import { localeAlternates, normLocale, SITE_URL } from '@/lib/seo'

type Props = { params: Promise<{ locale: string; slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const community = getApartment(slug)
  if (!community) return {}
  return {
    title: `${community.name} · ${communityTypeLabel(community.type, normLocale(locale))} · El Paso · CityBeat`,
    description: community.summary[normLocale(locale)],
    alternates: localeAlternates(locale, `/apartments/${community.slug}`),
  }
}

export default async function ApartmentPage({ params }: Props) {
  const { locale: requestedLocale, slug } = await params
  const locale = normLocale(requestedLocale)
  const es = locale === 'es'
  const community = getApartment(slug)
  if (!community) notFound()
  const otherCommunities = APARTMENT_COMMUNITIES.filter(other => other.slug !== slug)
  const jsonLd = {
    '@context': 'https://schema.org', '@type': community.type === 'apartments' ? 'ApartmentComplex' : 'Residence',
    name: community.name, description: community.summary[locale], telephone: `+1${community.phone}`,
    url: `${SITE_URL}/${locale}/apartments/${community.slug}`, sameAs: community.website,
    address: { '@type': 'PostalAddress', streetAddress: community.address, addressLocality: 'El Paso', addressRegion: 'TX', postalCode: community.zip, addressCountry: 'US' },
  }
  return <CityBeatShell locale={locale}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    <div className="citybeat-app container-wide py-8 sm:py-12">
      <Link href={`/${locale}/apartments`} className="inline-flex min-h-11 items-center text-sm font-bold text-brand-neon">← {es ? 'Todos los apartamentos' : 'All apartments'}</Link>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-brand-ink p-6 sm:p-10">
            <p className="text-xs font-black uppercase tracking-[.2em] text-brand-neon">{communityTypeLabel(community.type, locale)} · El Paso</p>
            <h1 className="mt-4 break-words font-display text-4xl font-black tracking-tight sm:text-5xl">{community.name}</h1>
            <p className="mt-3 text-white/65">{community.address}, El Paso, TX {community.zip}</p>
            <p className="mt-6 text-base leading-7 text-white/80">{community.summary[locale]}</p>
          </div>
          {community.highlights[locale].length > 0 && <section className="mt-8 rounded-2xl border border-white/15 bg-brand-ink/90 p-6 sm:p-8">
            <h2 className="text-xl font-bold">{es ? 'Características de la comunidad' : 'Community highlights'}</h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">{community.highlights[locale].map(highlight => <li key={highlight} className="rounded-lg border border-white/10 px-4 py-3 text-sm text-white/80">{highlight}</li>)}</ul>
            <p className="mt-5 text-sm leading-6 text-white/60">{es ? 'Las características pueden variar según la vivienda. Consulta los detalles y las políticas vigentes con el equipo de arrendamiento.' : 'Features may vary by home. Ask the leasing team about current details and policies.'}</p>
          </section>}
          <section className="mt-8 rounded-2xl border border-white/15 bg-brand-ink/90 p-6 sm:p-8">
            <h2 className="text-xl font-bold">{es ? 'Administración y fuentes' : 'Management and sources'}</h2>
            <p className="mt-4 text-white/80">{es ? 'Administrada por' : 'Managed by'} <strong>{APARTMENT_MANAGER}</strong>.</p>
            <p className="mt-3 text-sm leading-6 text-white/60">{es ? 'La comunidad figura en el directorio oficial de RPM Living. La administración compartida no confirma el mismo propietario. Esta ficha informativa no representa una asociación pagada ni una propiedad verificada por CityBeat.' : 'This community appears in RPM Living’s official directory. Shared management does not confirm common ownership. This informational listing does not represent a paid partnership or CityBeat-verified ownership.'}</p>
            <ul className="mt-4 space-y-3 text-sm text-brand-neon underline">
              <li><a href={APARTMENT_SOURCE} target="_blank" rel="noopener noreferrer">{es ? 'Directorio de RPM Living: dirección, teléfono y administración' : 'RPM Living directory: address, phone and management'} ↗</a></li>
              <li><a href={community.detailSource || community.website} target="_blank" rel="noopener noreferrer">{es ? 'Sitio oficial de la comunidad' : 'Official community website'} ↗</a></li>
            </ul>
            <p className="mt-4 text-xs text-white/55">{es ? 'Datos revisados' : 'Records checked'}: {APARTMENT_VERIFIED}</p>
          </section>
        </div>
        <aside className="h-fit rounded-2xl border border-brand-neon/35 bg-brand-ink p-6 sm:p-8">
          <h2 className="text-2xl font-bold">{es ? 'Contacta a arrendamiento' : 'Contact leasing'}</h2>
          <p className="mt-3 text-sm leading-6 text-white/65">{es ? 'Consulta precios, disponibilidad, visitas y solicitudes directamente con la comunidad.' : 'Ask the community directly about prices, availability, tours and applications.'}</p>
          <a href={`tel:+1${community.phone}`} className="mt-6 block rounded-lg bg-brand-neon px-4 py-4 text-center font-bold text-black hover:bg-white">{es ? 'Llamar' : 'Call'} {apartmentPhone(community.phone)}</a>
          <a href={community.website} target="_blank" rel="noopener noreferrer" className="mt-3 block rounded-lg border border-brand-neon px-4 py-4 text-center font-bold text-brand-neon hover:bg-brand-neon/10">{es ? 'Visitar sitio oficial' : 'Visit official website'} ↗</a>
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${community.name}, ${community.address}, El Paso, TX ${community.zip}`)}`} target="_blank" rel="noopener noreferrer" className="mt-3 block rounded-lg border border-white/20 px-4 py-4 text-center font-bold hover:border-brand-neon">{es ? 'Ver ubicación' : 'View location'} ↗</a>
          <div className="mt-8 border-t border-white/10 pt-6"><h3 className="font-bold">{es ? '¿Administras esta comunidad?' : 'Manage this community?'}</h3><p className="mt-2 text-sm leading-6 text-white/65">{es ? 'Contacta a CityBeat para solicitar una corrección de esta ficha.' : 'Contact CityBeat to request a correction to this listing.'}</p><Link href={`/${locale}/contact`} className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-brand-neon underline">{es ? 'Solicitar actualización' : 'Request an update'}</Link></div>
        </aside>
      </div>
      <section className="mt-12 border-t border-white/10 pt-8">
        <h2 className="text-2xl font-bold">{es ? 'Más comunidades administradas por RPM Living' : 'More communities managed by RPM Living'}</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{otherCommunities.map(other => <li key={other.slug}><Link href={`/${locale}/apartments/${other.slug}`} className="block rounded-xl border border-white/15 bg-brand-ink px-5 py-4 hover:border-brand-neon hover:text-brand-neon">{other.name}<span className="mt-1 block text-xs text-white/60">{communityTypeLabel(other.type, locale)} · {other.zip}</span></Link></li>)}</ul>
      </section>
    </div>
  </CityBeatShell>
}
