import type { Metadata } from 'next'
import { localeAlternates } from '@/lib/seo'
import LeaderboardClient from './LeaderboardClient'

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const isEs = params.locale === 'es'
  const title = isEs ? 'Tabla de colaboradores · CityBeat' : 'Contributor Leaderboard · CityBeat'
  const description = isEs
    ? 'Los mejores colaboradores de CityBeat: gana puntos dejando reseñas y subiendo fotos de negocios de El Paso.'
    : 'CityBeat’s top community contributors — earn points by leaving reviews and uploading photos of El Paso businesses.'
  return {
    title,
    description,
    alternates: localeAlternates(params.locale, '/leaderboard'),
    openGraph: {
      title,
      description,
      type: 'website',
      images: [{ url: `/api/og?title=${encodeURIComponent(isEs ? 'Colaboradores de CityBeat' : 'Top CityBeat Contributors')}&eyebrow=${encodeURIComponent(isEs ? 'Comunidad' : 'Community')}` }],
    },
  }
}

export default function LeaderboardPage() {
  return <LeaderboardClient />
}
