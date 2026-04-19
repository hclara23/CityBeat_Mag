'use client'

import { useLocale, useTranslations } from '@/components/TranslationProvider'
import { Button, Card } from '@citybeat/ui'
import { AdsNavigation as Navigation } from '@/components/AdsNavigation'
import Link from 'next/link'

export default function Home() {
  const t = useTranslations('home')
  const locale = useLocale()

  const adProducts = [
    {
      id: 'newsletter',
      titleKey: 'newsletter.title',
      descKey: 'newsletter.description',
      priceKey: 'newsletter.price',
      periodKey: 'newsletter.period',
      featuresKey: 'newsletter.features',
      icon: '📧',
      href: `/${locale}/newsletter`,
      color: 'from-blue-500 to-blue-600',
    },
    {
      id: 'sponsored',
      titleKey: 'sponsored.title',
      descKey: 'sponsored.description',
      priceKey: 'sponsored.price',
      periodKey: 'sponsored.period',
      featuresKey: 'sponsored.features',
      icon: '📰',
      href: `/${locale}/sponsored`,
      color: 'from-green-500 to-green-600',
    },
    {
      id: 'banner',
      titleKey: 'banner.title',
      descKey: 'banner.description',
      priceKey: 'banner.price',
      periodKey: 'banner.period',
      featuresKey: 'banner.features',
      icon: '📍',
      href: `/${locale}/banners`,
      color: 'from-purple-500 to-purple-600',
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-white">
        <div className="max-w-6xl mx-auto px-4 py-20 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            {t('title')}
          </h1>
          <p className="text-xl md:text-2xl mb-8 opacity-90">
            {t('subtitle')}
          </p>
          <div className="flex flex-col md:flex-row gap-4 justify-center">
            <Button variant="secondary" size="lg" className="px-8">
              {t('cta1')}
            </Button>
            <Button variant="secondary" size="lg" className="px-8 border-2 border-white">
              {t('cta2')}
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-primary mb-2">50,000+</div>
              <p className="text-gray-600">{t('stats.readers')}</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">5</div>
              <p className="text-gray-600">{t('stats.coverage')}</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">2</div>
              <p className="text-gray-600">{t('stats.languages')}</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">24/7</div>
              <p className="text-gray-600">{t('stats.tracking')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ad Products */}
      <div className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            {t('solutions')}
          </h2>
          <p className="text-xl text-gray-600">
            {t('solutionsDesc')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {adProducts.map((product) => (
            <Card key={product.id} className="hover:shadow-xl transition-shadow flex flex-col">
              <div className={`bg-gradient-to-r ${product.color} text-white p-8 rounded-t-lg mb-6`}>
                <div className="text-5xl mb-4">{product.icon}</div>
                <h3 className="text-2xl font-bold">{t(product.titleKey)}</h3>
              </div>

              <div className="flex-1 px-6">
                <p className="text-gray-600 mb-6">{t(product.descKey)}</p>

                <div className="mb-8">
                  <div className="text-3xl font-bold text-primary mb-1">
                    {t(product.priceKey)}
                  </div>
                  <p className="text-sm text-gray-500">{t(product.periodKey)}</p>
                </div>

                <div className="space-y-3 mb-8">
                  {(t.raw(product.featuresKey) as string[]).map((feature, idx) => (
                    <div key={idx} className="flex items-start">
                      <span className="text-primary font-bold mr-3">✓</span>
                      <span className="text-sm text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-6 pb-6">
                <Link href={product.href} className="block">
                  <Button className="w-full" variant="primary">
                    {t('title')} {t(product.titleKey)}
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Why Choose Us */}
      <div className="bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              {t('whyChoose')}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">{t('localImpact')}</h3>
              <p className="text-gray-600 mb-6">{t('localImpactDesc')}</p>
              <ul className="space-y-3">
                {(t.raw('localFeatures') as string[]).map((feature, idx) => (
                  <li key={idx} className="flex items-start">
                    <span className="text-primary font-bold mr-3">•</span>
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">{t('bilingualReach')}</h3>
              <p className="text-gray-600 mb-6">{t('bilingualReachDesc')}</p>
              <ul className="space-y-3">
                {(t.raw('bilingualFeatures') as string[]).map((feature, idx) => (
                  <li key={idx} className="flex items-start">
                    <span className="text-primary font-bold mr-3">•</span>
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">{t('analytics')}</h3>
              <p className="text-gray-600 mb-6">{t('analyticsDesc')}</p>
              <ul className="space-y-3">
                {(t.raw('analyticsFeatures') as string[]).map((feature, idx) => (
                  <li key={idx} className="flex items-start">
                    <span className="text-primary font-bold mr-3">•</span>
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">{t('flexible')}</h3>
              <p className="text-gray-600 mb-6">{t('flexibleDesc')}</p>
              <ul className="space-y-3">
                {(t.raw('flexibleFeatures') as string[]).map((feature, idx) => (
                  <li key={idx} className="flex items-start">
                    <span className="text-primary font-bold mr-3">•</span>
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-4xl font-bold text-gray-900 mb-6">
          {t('ready')}
        </h2>
        <p className="text-xl text-gray-600 mb-8">
          {t('readyDesc')}
        </p>
        <div className="flex flex-col md:flex-row gap-4 justify-center">
          <Button size="lg" variant="primary" className="px-8">
            {t('browseAll')}
          </Button>
          <Button size="lg" variant="secondary" className="px-8">
            {t('contactSales')}
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-900 text-white py-12">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-gray-400">
            {t('copyright')}
          </p>
        </div>
      </div>
    </div>
  )
}
