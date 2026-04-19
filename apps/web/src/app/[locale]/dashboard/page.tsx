'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from '@/components/TranslationProvider'
import { Navigation, Button } from '@citybeat/ui'
import { AuthError } from '@citybeat/ui/auth'

interface Campaign {
  id: string
  name: string
  status: string
  created_at: string
  impressions: number
  clicks: number
}

export default function DashboardPage() {
  const router = useRouter()
  const locale = useLocale()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [stats, setStats] = useState({
    totalImpressions: 0,
    totalClicks: 0,
    activeCampaigns: 0,
    ctr: 0,
  })
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/dashboard')

        if (response.status === 401) {
          router.push(`/${locale}/login`)
          return
        }

        if (!response.ok) {
          throw new Error('Failed to load dashboard')
        }

        const data = (await response.json()) as {
          profile: any
          campaigns: Campaign[]
          stats: {
            totalImpressions: number
            totalClicks: number
            activeCampaigns: number
            ctr: number
          }
        }

        setProfile(data.profile)
        setCampaigns(data.campaigns)
        setStats(data.stats)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      } finally {
        setIsLoading(false)
      }
    }

    loadDashboard()
  }, [locale, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 py-12">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-bold">
              Welcome, {profile?.full_name || 'User'}
            </h1>
            <p className="text-gray-600 mt-2">
              {profile?.is_advertiser ? 'Advertiser Dashboard' : 'Dashboard'}
            </p>
          </div>
          {profile?.is_advertiser && (
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={() => router.push(`/${locale}/ads`)}
            >
              Create Campaign
            </Button>
          )}
        </div>

        {error && <AuthError message={error} />}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {/* Stats Cards */}
          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <p className="text-sm text-gray-600 mb-2">Total Impressions</p>
            <p className="text-3xl font-bold">{stats.totalImpressions.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-2">This month</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <p className="text-sm text-gray-600 mb-2">Total Clicks</p>
            <p className="text-3xl font-bold">{stats.totalClicks.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-2">This month</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <p className="text-sm text-gray-600 mb-2">Click-Through Rate</p>
            <p className="text-3xl font-bold">{stats.ctr.toFixed(2)}%</p>
            <p className="text-xs text-gray-500 mt-2">This month</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <p className="text-sm text-gray-600 mb-2">Active Campaigns</p>
            <p className="text-3xl font-bold">{stats.activeCampaigns}</p>
            <p className="text-xs text-gray-500 mt-2">Currently running</p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 mb-12">
          <h2 className="text-2xl font-bold mb-4">Recent Activity</h2>
          <div className="text-center py-12">
            <p className="text-gray-500">No activity data available yet</p>
            <p className="text-sm text-gray-400 mt-2">
              Analytics will appear here once your campaigns go live
            </p>
          </div>
        </div>

        {/* Campaigns Section */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Your Campaigns</h2>
            {profile?.is_advertiser && campaigns.length > 0 && (
              <Button
                className="bg-red-600 hover:bg-red-700"
                onClick={() => router.push(`/${locale}/ads`)}
              >
                New Campaign
              </Button>
            )}
          </div>

          {campaigns.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-12 border border-gray-200 text-center">
              <p className="text-gray-500">No campaigns yet</p>
              <p className="text-sm text-gray-400 mt-2">
                {profile?.is_advertiser
                  ? 'Create your first advertising campaign to get started'
                  : 'You are not an advertiser'}
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="bg-gray-50 rounded-lg p-6 border border-gray-200"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {campaign.name}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Created {new Date(campaign.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                      {campaign.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200">
                    <div>
                      <p className="text-xs text-gray-600">Impressions</p>
                      <p className="text-lg font-semibold">
                        {campaign.impressions.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Clicks</p>
                      <p className="text-lg font-semibold">
                        {campaign.clicks.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">CTR</p>
                      <p className="text-lg font-semibold">
                        {campaign.impressions > 0
                          ? ((campaign.clicks / campaign.impressions) * 100).toFixed(2)
                          : 0}
                        %
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
