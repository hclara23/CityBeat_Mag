'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Navigation, Button, Card } from '@citybeat/ui'
import Link from 'next/link'
import { NEWSLETTER_OPTIONS, type BillingOption } from '@/lib/pricing'

export default function NewsletterPage() {
  const router = useRouter()
  const [campaignName, setCampaignName] = useState('')
  const [selectedBilling, setSelectedBilling] = useState<BillingOption>(
    NEWSLETTER_OPTIONS[0]
  )
  const [description, setDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!campaignName.trim()) {
      setError('Campaign name is required')
      return
    }

    try {
      setIsLoading(true)
      setError('')

      const campaignResponse = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignName,
          adType: 'newsletter',
          billingCycle: selectedBilling.cycle,
          description,
        }),
      })

      if (!campaignResponse.ok) {
        throw new Error('Failed to create campaign')
      }

      const campaignData = (await campaignResponse.json()) as {
        data: { id: string }
      }

      const checkoutResponse = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaignData.data.id,
          adType: 'newsletter',
          billingCycle: selectedBilling.cycle,
        }),
      })

      if (!checkoutResponse.ok) {
        throw new Error('Failed to create checkout session')
      }

      const { url } = (await checkoutResponse.json()) as { url: string }
      router.push(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-12">
          <Link href="/campaigns" className="text-red-600 hover:text-red-700 mb-4 block">
            ← Back to Campaigns
          </Link>

          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Newsletter Sponsorship
          </h1>
          <p className="text-xl text-gray-600">
            Reach thousands of engaged readers in our daily newsletter
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Campaign Details
              </h2>

              <form onSubmit={handleCreateCampaign} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-semibold text-gray-900 mb-2">
                    Campaign Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="e.g., Holiday Sale Campaign"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
                    required
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    This is the name your audience will see
                  </p>
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-semibold text-gray-900 mb-2">
                    Campaign Description (Optional)
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your campaign, target audience, or any special notes"
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-4">
                    Billing Cycle
                  </label>
                  <div className="space-y-3">
                    {NEWSLETTER_OPTIONS.map((option) => (
                      <div key={option.cycle} className="relative">
                        <input
                          type="radio"
                          id={option.cycle}
                          name="billing"
                          value={option.cycle}
                          checked={selectedBilling.cycle === option.cycle}
                          onChange={() => setSelectedBilling(option)}
                          className="sr-only"
                        />
                        <label
                          htmlFor={option.cycle}
                          className={`block p-4 border-2 rounded-lg cursor-pointer transition ${
                            selectedBilling.cycle === option.cycle
                              ? 'border-red-600 bg-red-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold text-gray-900">
                                {option.cycle.charAt(0).toUpperCase() +
                                  option.cycle.slice(1)}{' '}
                                ({option.months} {option.months === 1 ? 'month' : 'months'})
                              </p>
                              {option.savings > 0 && (
                                <p className="text-sm text-green-600 mt-1">
                                  Save ${(option.savings / 100).toFixed(2)}
                                </p>
                              )}
                            </div>
                            <p className="text-2xl font-bold text-gray-900">
                              ${(option.price / 100).toFixed(2)}
                            </p>
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-200">
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading
                      ? 'Creating Campaign...'
                      : 'Proceed to Payment'}
                  </Button>
                </div>
              </form>
            </Card>
          </div>

          <div>
            <Card className="sticky top-4">
              <h3 className="text-lg font-bold text-gray-900 mb-6">
                Order Summary
              </h3>

              <div className="space-y-4 mb-6 pb-6 border-b border-gray-200">
                <div className="flex justify-between">
                  <span className="text-gray-600">Ad Type</span>
                  <span className="font-semibold text-gray-900">
                    Newsletter Sponsorship
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Campaign Name</span>
                  <span className="font-semibold text-gray-900">
                    {campaignName || 'Not set'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Billing Cycle</span>
                  <span className="font-semibold text-gray-900">
                    {selectedBilling.cycle.charAt(0).toUpperCase() +
                      selectedBilling.cycle.slice(1)}
                  </span>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="text-2xl font-bold text-gray-900">
                    ${(selectedBilling.price / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-600 mb-3">
                  Your campaign will be reviewed within 24 hours. You will receive a
                  confirmation email once it is approved.
                </p>
                <ul className="text-xs text-gray-600 space-y-2">
                  <li>✓ Reach our newsletter subscribers</li>
                  <li>✓ Premium placement included</li>
                  <li>✓ Campaign analytics dashboard</li>
                  <li>✓ 24/7 support</li>
                </ul>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
