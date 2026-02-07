'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Navigation, Button, Card } from '@citybeat/ui'
import Link from 'next/link'

interface Campaign {
  id: string
  name: string
  adType: string
  billingCycle: string
  status: string
  amount: number
  createdAt: string
  impressions?: number
  clicks?: number
}

export default function CampaignsPage() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/campaigns')
        if (!response.ok) throw new Error('Failed to fetch campaigns')

        const data = (await response.json()) as { data: Campaign[] }
        setCampaigns(data.data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load campaigns')
      } finally {
        setIsLoading(false)
      }
    }

    fetchCampaigns()
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'paused':
        return 'bg-yellow-100 text-yellow-800'
      case 'pending':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getAdTypeLabel = (type: string) => {
    switch (type) {
      case 'newsletter':
        return 'Newsletter Sponsorship'
      case 'sponsored':
        return 'Sponsored Post'
      case 'banner':
        return 'Banner Advertisement'
      default:
        return type
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">My Campaigns</h1>
            <p className="text-gray-600">
              Manage your advertising campaigns and track performance
            </p>
          </div>
          <Link href="/newsletter">
            <Button className="bg-red-600 hover:bg-red-700">
              Create New Campaign
            </Button>
          </Link>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading campaigns...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <Card className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              No Campaigns Yet
            </h2>
            <p className="text-gray-600 mb-6">
              You have not created any advertising campaigns yet. Get started by
              choosing an ad type below.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-2 border-gray-200 hover:border-red-600 transition">
                <div className="text-center">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    Newsletter Sponsorship
                  </h3>
                  <p className="text-gray-600 mb-4 text-sm">
                    Reach readers in our daily newsletter
                  </p>
                  <Link href="/newsletter">
                    <Button className="w-full">Get Started</Button>
                  </Link>
                </div>
              </Card>

              <Card className="border-2 border-gray-200 hover:border-red-600 transition">
                <div className="text-center">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    Sponsored Posts
                  </h3>
                  <p className="text-gray-600 mb-4 text-sm">
                    Get featured in our editorial content
                  </p>
                  <Link href="/sponsored">
                    <Button className="w-full">Get Started</Button>
                  </Link>
                </div>
              </Card>

              <Card className="border-2 border-gray-200 hover:border-red-600 transition">
                <div className="text-center">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    Banner Ads
                  </h3>
                  <p className="text-gray-600 mb-4 text-sm">
                    Place ads throughout the website
                  </p>
                  <Link href="/banners">
                    <Button className="w-full">Get Started</Button>
                  </Link>
                </div>
              </Card>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {campaigns.map((campaign) => (
              <Card key={campaign.id} className="hover:shadow-lg transition">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-1">
                      {campaign.name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {getAdTypeLabel(campaign.adType)} •{' '}
                      {campaign.billingCycle.charAt(0).toUpperCase() +
                        campaign.billingCycle.slice(1)}
                    </p>
                  </div>

                  <span
                    className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(
                      campaign.status
                    )}`}
                  >
                    {campaign.status.charAt(0).toUpperCase() +
                      campaign.status.slice(1)}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 py-4 border-y border-gray-200">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Amount</p>
                    <p className="text-lg font-bold text-gray-900">
                      ${(campaign.amount / 100).toFixed(2)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-1">Impressions</p>
                    <p className="text-lg font-bold text-gray-900">
                      {(campaign.impressions || 0).toLocaleString()}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-1">Clicks</p>
                    <p className="text-lg font-bold text-gray-900">
                      {(campaign.clicks || 0).toLocaleString()}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-1">CTR</p>
                    <p className="text-lg font-bold text-gray-900">
                      {campaign.impressions && campaign.impressions > 0
                        ? (
                            ((campaign.clicks || 0) / campaign.impressions) *
                            100
                          ).toFixed(2)
                        : 0}
                      %
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    Created {new Date(campaign.createdAt).toLocaleDateString()}
                  </p>

                  <div className="flex gap-2">
                    {campaign.status === 'active' && (
                      <Button variant="secondary" size="sm">
                        Pause
                      </Button>
                    )}
                    {campaign.status === 'paused' && (
                      <Button variant="secondary" size="sm">
                        Resume
                      </Button>
                    )}
                    {campaign.status === 'pending' && (
                      <Button variant="secondary" size="sm" disabled>
                        Processing...
                      </Button>
                    )}
                    <Link href={`/campaigns/${campaign.id}`}>
                      <Button variant="secondary" size="sm">
                        View Details
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
