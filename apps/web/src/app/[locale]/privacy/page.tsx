'use client'

import { useTranslations } from '@/components/TranslationProvider'
import { Navigation } from '@citybeat/ui'

export default function PrivacyPage() {
  const t = useTranslations()

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>

        <div className="prose prose-lg max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-bold mt-6 mb-3">1. Information We Collect</h2>
            <p className="text-gray-700">
              CityBeat Magazine collects information you voluntarily provide when subscribing to our newsletter,
              creating an advertiser account, or contacting us. This includes name, email address, phone number,
              and payment information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mt-6 mb-3">2. How We Use Your Information</h2>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Send you our newsletter and editorial content</li>
              <li>Process payments for advertising services</li>
              <li>Communicate with you about your account</li>
              <li>Improve our services and user experience</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mt-6 mb-3">3. Data Security</h2>
            <p className="text-gray-700">
              We implement industry-standard security measures to protect your personal information from unauthorized
              access, alteration, disclosure, or destruction.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mt-6 mb-3">4. Third-Party Services</h2>
            <p className="text-gray-700">
              We use third-party services including Stripe for payment processing, Sanity for content management,
              and Supabase for data storage. These services have their own privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mt-6 mb-3">5. Contact Us</h2>
            <p className="text-gray-700">
              If you have questions about this privacy policy, please contact us at contact@citybeatmag.co
            </p>
          </section>

          <p className="text-sm text-gray-500 mt-12">
            Last updated: February 2024
          </p>
        </div>
      </div>
    </div>
  )
}
