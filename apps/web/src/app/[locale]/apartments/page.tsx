import type { Metadata } from 'next'
import { localeAlternates, normLocale } from '@/lib/seo'
import ApartmentsClient from './ApartmentsClient'
import { publicApartments } from '@/lib/apartment-public'

export const dynamic = 'force-dynamic'

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return params.then(({ locale }) => {
    const es = locale === 'es'
    return {
      title: es ? 'Apartamentos en El Paso · CityBeat' : 'El Paso Apartments · CityBeat',
      description: es ? 'Explora comunidades de apartamentos en El Paso, sus amenidades, ubicación y contactos de arrendamiento.' : 'Explore El Paso apartment communities, amenities, locations and leasing contacts.',
      alternates: localeAlternates(locale, '/apartments'),
    }
  })
}

export default async function ApartmentsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return <ApartmentsClient locale={normLocale(locale)} catalog={await publicApartments()} />
}
