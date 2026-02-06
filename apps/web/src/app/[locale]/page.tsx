'use client'

import { useTranslations } from '@/components/TranslationProvider'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button, Card, Navigation } from '@citybeat/ui'

export default function Home() {
  const t = useTranslations()
  const params = useParams()
  const locale = params.locale as string

  const otherLocale = locale === 'en' ? 'es' : 'en'

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <nav className="container-wide py-4 flex items-center justify-between">
          <div className="text-2xl font-bold text-red-600">CityBeat</div>
          <div className="flex gap-4">
            {locale === 'en' && (
              <>
                <span className="text-gray-900 font-semibold">EN</span>
                <Link href={`/${otherLocale}`} className="text-gray-600 hover:text-gray-900">
                  ES
                </Link>
              </>
            )}
            {locale === 'es' && (
              <>
                <Link href={`/${otherLocale}`} className="text-gray-600 hover:text-gray-900">
                  EN
                </Link>
                <span className="text-gray-900 font-semibold">ES</span>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-r from-red-600 to-red-700 text-white py-20">
        <div className="container-wide">
          <h1 className="text-5xl font-bold mb-4">
            {t('home.title')}
          </h1>
          <p className="text-xl mb-8">
            {t('home.subtitle')}
          </p>
          <Button asChild size="lg" className="bg-white text-red-600 hover:bg-gray-100">
            <Link href={`/${locale}#subscribe`}>
              {t('home.subscribe')}
            </Link>
          </Button>
        </div>
      </section>

      {/* Featured Section */}
      <section className="container-wide py-16">
        <h2 className="text-3xl font-bold mb-8">
          {t('home.latestBriefs')}
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="hover:shadow-lg transition-shadow">
              <div className="h-48 bg-gradient-to-br from-gray-200 to-gray-300" />
              <div className="p-4">
                <h3 className="text-lg font-bold mb-2">
                  {t(`home.sampleBrief${i}`)}
                </h3>
                <p className="text-gray-600 mb-4">
                  {t(`home.sampleBriefDesc${i}`)}
                </p>
                <Link href={`/${locale}/briefs/${i}`} className="text-red-600 hover:text-red-700 font-semibold">
                  {t('home.readMore')} →
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Ads Section */}
      <section className="bg-gray-50 py-16 border-y border-gray-200">
        <div className="container-wide">
          <h2 className="text-3xl font-bold mb-8">
            {t('home.advertise')}
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card>
              <h3 className="text-xl font-bold mb-2">
                {t('home.newsletter')}
              </h3>
              <p className="text-gray-600 mb-4">
                {t('home.newsletterDesc')}
              </p>
              <Button asChild variant="primary">
                <Link href={`/${locale}/ads/newsletter`}>
                  {t('home.learnMore')}
                </Link>
              </Button>
            </Card>
            <Card>
              <h3 className="text-xl font-bold mb-2">
                {t('home.sponsored')}
              </h3>
              <p className="text-gray-600 mb-4">
                {t('home.sponsoredDesc')}
              </p>
              <Button asChild variant="primary">
                <Link href={`/${locale}/ads/sponsored`}>
                  {t('home.learnMore')}
                </Link>
              </Button>
            </Card>
            <Card>
              <h3 className="text-xl font-bold mb-2">
                {t('home.banners')}
              </h3>
              <p className="text-gray-600 mb-4">
                {t('home.bannersDesc')}
              </p>
              <Button asChild variant="primary">
                <Link href={`/${locale}/ads/banners`}>
                  {t('home.learnMore')}
                </Link>
              </Button>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container-wide">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-bold mb-4">CityBeat</h4>
              <p className="text-gray-400">
                {t('home.footerDesc')}
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4">{t('footer.categories')}</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <Link href={`/${locale}/briefs?category=news`} className="hover:text-white">
                    {t('categories.news')}
                  </Link>
                </li>
                <li>
                  <Link href={`/${locale}/briefs?category=culture`} className="hover:text-white">
                    {t('categories.culture')}
                  </Link>
                </li>
                <li>
                  <Link href={`/${locale}/briefs?category=events`} className="hover:text-white">
                    {t('categories.events')}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">{t('footer.advertise')}</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <Link href={`/${locale}/ads`} className="hover:text-white">
                    {t('footer.adsPortal')}
                  </Link>
                </li>
                <li>
                  <Link href={`/${locale}/ads#pricing`} className="hover:text-white">
                    {t('footer.pricing')}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">{t('footer.legal')}</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <Link href={`/${locale}/privacy`} className="hover:text-white">
                    {t('footer.privacy')}
                  </Link>
                </li>
                <li>
                  <Link href={`/${locale}/terms`} className="hover:text-white">
                    {t('footer.terms')}
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-gray-400">
            <p>&copy; 2024 CityBeat Magazine. {t('footer.rights')}</p>
          </div>
        </div>
      </footer>
    </main>
  )
}
