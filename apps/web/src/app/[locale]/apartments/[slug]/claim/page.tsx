import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getApartment } from '@/lib/apartments'
import { localeAlternates, normLocale } from '@/lib/seo'
import ApartmentClaimClient from './ApartmentClaimClient'

type Props = { params: Promise<{ locale: string; slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const community = getApartment(slug)
  if (!community) return {}
  return {
    title: `${normLocale(locale) === 'es' ? 'Reclamar propiedad' : 'Claim property'} · ${community.name} · CityBeat`,
    alternates: localeAlternates(locale, `/apartments/${slug}/claim`),
    robots: { index: false, follow: true },
  }
}

export default async function ApartmentClaimPage({ params }: Props) {
  const { locale, slug } = await params
  const community = getApartment(slug)
  if (!community) notFound()
  return <ApartmentClaimClient community={community} locale={normLocale(locale)} />
}
