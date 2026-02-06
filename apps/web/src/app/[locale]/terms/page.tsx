'use client'

import { useTranslations } from '@/components/TranslationProvider'
import { Navigation } from '@citybeat/ui'

export default function TermsPage() {
  const t = useTranslations()

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>

        <div className="prose prose-lg max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-bold mt-6 mb-3">1. Acceptance of Terms</h2>
            <p className="text-gray-700">
              By accessing and using CityBeat Magazine, you accept and agree to be bound by the terms and provision
              of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mt-6 mb-3">2. Use License</h2>
            <p className="text-gray-700">
              Permission is granted to temporarily download one copy of the materials (information or software) on
              CityBeat Magazine for personal, non-commercial transitory viewing only. This is the grant of a license,
              not a transfer of title, and under this license you may not:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Modify or copy the materials</li>
              <li>Use the materials for any commercial purpose or for any public display</li>
              <li>Attempt to reverse compile, reverse engineer, disassemble, or otherwise reverse engineer any software</li>
              <li>Remove any copyright or proprietary notation from the materials</li>
              <li>Transfer the materials to another person or "mirror" the materials on any other server</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold mt-6 mb-3">3. Disclaimer</h2>
            <p className="text-gray-700">
              The materials on CityBeat Magazine's website are provided on an 'as is' basis. CityBeat Magazine makes
              no warranties, expressed or implied, and hereby disclaims and negates all other warranties including,
              without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose,
              or non-infringement of intellectual property or other violation of rights.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mt-6 mb-3">4. Limitations</h2>
            <p className="text-gray-700">
              In no event shall CityBeat Magazine or its suppliers be liable for any damages (including, without
              limitation, damages for loss of data or profit, or due to business interruption) arising out of the use
              or inability to use the materials on CityBeat Magazine, even if CityBeat Magazine or an authorized
              representative has been notified orally or in writing of the possibility of such damage.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mt-6 mb-3">5. Accuracy of Materials</h2>
            <p className="text-gray-700">
              The materials appearing on CityBeat Magazine could include technical, typographical, or photographic
              errors. CityBeat Magazine does not warrant that any of the materials on its website are accurate,
              complete, or current. CityBeat Magazine may make changes to the materials contained on its website
              at any time without notice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mt-6 mb-3">6. Links</h2>
            <p className="text-gray-700">
              CityBeat Magazine has not reviewed all of the sites linked to its website and is not responsible for
              the contents of any such linked site. The inclusion of any link does not imply endorsement by
              CityBeat Magazine of the site. Use of any such linked website is at the user's own risk.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mt-6 mb-3">7. Modifications</h2>
            <p className="text-gray-700">
              CityBeat Magazine may revise these terms of service for its website at any time without notice. By
              using this website, you are agreeing to be bound by the then current version of these terms of service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold mt-6 mb-3">8. Governing Law</h2>
            <p className="text-gray-700">
              These terms and conditions are governed by and construed in accordance with the laws of Texas, and you
              irrevocably submit to the exclusive jurisdiction of the courts in that location.
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
