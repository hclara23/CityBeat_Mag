'use client'

import { Button, Card, Navigation } from '@citybeat/ui'
import Link from 'next/link'

export default function Home() {
  const adProducts = [
    {
      id: 'newsletter',
      title: 'Newsletter Sponsorship',
      icon: '📧',
      description: 'Reach engaged subscribers in our daily newsletter',
      features: [
        'Featured sponsorship placement',
        'Sent to 5,000+ subscribers daily',
        'Month-long campaign',
        'Click tracking and analytics',
      ],
      price: '$500',
      period: '/month',
      href: '/en/newsletter',
      color: 'from-blue-500 to-blue-600',
    },
    {
      id: 'sponsored',
      title: 'Sponsored Posts',
      icon: '📰',
      description: 'Feature your content directly in our news feed',
      features: [
        'Custom content placement',
        'Appears alongside editorial posts',
        'Flexible package options',
        'Advanced analytics included',
      ],
      price: '$750+',
      period: '/post',
      href: '/en/sponsored',
      color: 'from-green-500 to-green-600',
    },
    {
      id: 'banner',
      title: 'Category Banners',
      icon: '📍',
      description: 'High-visibility placement on category pages',
      features: [
        'Above-the-fold positioning',
        'Multiple category options',
        'Responsive design',
        'Monthly billing available',
      ],
      price: '$300+',
      period: '/month',
      href: '/en/banners',
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
            Advertise With CityBeat
          </h1>
          <p className="text-xl md:text-2xl mb-8 opacity-90">
            Reach thousands of engaged readers across El Paso County and surrounding areas
          </p>
          <div className="flex flex-col md:flex-row gap-4 justify-center">
            <Button variant="secondary" size="lg" className="px-8">
              Contact Sales
            </Button>
            <Button variant="secondary" size="lg" className="px-8 border-2 border-white">
              Learn More
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
              <p className="text-gray-600">Monthly readers</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">5</div>
              <p className="text-gray-600">Coverage areas</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">2</div>
              <p className="text-gray-600">Languages (EN/ES)</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">24/7</div>
              <p className="text-gray-600">Campaign tracking</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ad Products */}
      <div className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Advertising Solutions
          </h2>
          <p className="text-xl text-gray-600">
            Choose the perfect advertising format for your business
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {adProducts.map((product) => (
            <Card key={product.id} className="hover:shadow-xl transition-shadow flex flex-col">
              <div className={`bg-gradient-to-r ${product.color} text-white p-8 rounded-t-lg mb-6`}>
                <div className="text-5xl mb-4">{product.icon}</div>
                <h3 className="text-2xl font-bold">{product.title}</h3>
              </div>

              <div className="flex-1 px-6">
                <p className="text-gray-600 mb-6">{product.description}</p>

                <div className="mb-8">
                  <div className="text-3xl font-bold text-primary mb-1">
                    {product.price}
                  </div>
                  <p className="text-sm text-gray-500">{product.period}</p>
                </div>

                <div className="space-y-3 mb-8">
                  {product.features.map((feature, idx) => (
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
                    View {product.title}
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
              Why Advertise With CityBeat?
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Local Impact</h3>
              <p className="text-gray-600 mb-6">
                We focus exclusively on El Paso County and surrounding areas. Your message reaches people who live and work in your community.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <span className="text-primary font-bold mr-3">•</span>
                  <span className="text-gray-700">El Paso County focus</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary font-bold mr-3">•</span>
                  <span className="text-gray-700">Multi-area coverage</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary font-bold mr-3">•</span>
                  <span className="text-gray-700">Regional reach</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Bilingual Reach</h3>
              <p className="text-gray-600 mb-6">
                All content is available in English and Spanish. Reach the entire community regardless of language preference.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <span className="text-primary font-bold mr-3">•</span>
                  <span className="text-gray-700">English content</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary font-bold mr-3">•</span>
                  <span className="text-gray-700">Spanish content</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary font-bold mr-3">•</span>
                  <span className="text-gray-700">Bilingual interface</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Transparent Analytics</h3>
              <p className="text-gray-600 mb-6">
                Track every impression, click, and interaction. Real-time dashboards show exactly how your advertising is performing.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <span className="text-primary font-bold mr-3">•</span>
                  <span className="text-gray-700">Real-time tracking</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary font-bold mr-3">•</span>
                  <span className="text-gray-700">Click-through rates</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary font-bold mr-3">•</span>
                  <span className="text-gray-700">Engagement metrics</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Flexible Options</h3>
              <p className="text-gray-600 mb-6">
                Whether you want a one-time sponsored post or ongoing sponsorship, we have a solution for your budget.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <span className="text-primary font-bold mr-3">•</span>
                  <span className="text-gray-700">Pay per post</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary font-bold mr-3">•</span>
                  <span className="text-gray-700">Monthly subscriptions</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary font-bold mr-3">•</span>
                  <span className="text-gray-700">Custom packages</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-4xl font-bold text-gray-900 mb-6">
          Ready to Get Started?
        </h2>
        <p className="text-xl text-gray-600 mb-8">
          Choose an advertising option above to begin. Questions? Contact our sales team.
        </p>
        <div className="flex flex-col md:flex-row gap-4 justify-center">
          <Button size="lg" variant="primary" className="px-8">
            Browse All Options
          </Button>
          <Button size="lg" variant="secondary" className="px-8">
            Contact Sales
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-900 text-white py-12">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-gray-400">
            © 2024 CityBeat Magazine. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
