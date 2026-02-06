'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
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

export default function CampaignDetailPage() {
  const router = useRouter()
  const params = useParams()
  const campaignId = params.id as string

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    const fetchCampaign = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/campaigns/${campaignId}`)
        if (!response.ok) throw new Error('Failed to fetch campaign')

        const data = (await response.json()) as { data: Campaign }
        setCampaign(data.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load campaign')
      } finally {
        setIsLoading(false)
      }
    }

    fetchCampaign()
  }, [campaignId])

  const handlePause = async () => {
    if (!campaign) return
    try {
      setActionLoading(true)
      const response = await fetch(`/api/campaigns/${campaignId}/pause`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to pause campaign')

      setCampaign({ ...campaign, status: 'paused' })
      setSuccessMessage('Campaign paused successfully')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause campaign')
    } finally {
      setActionLoading(false)
    }
  }

  const handleResume = async () => {
    if (!campaign) return
    try {
      setActionLoading(true)
      const response = await fetch(`/api/campaigns/${campaignId}/resume`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to resume campaign')

      setCampaign({ ...campaign, status: 'active' })
      setSuccessMessage('Campaign resumed successfully')
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume campaign')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!campaign) return
    if (!confirm('Are you sure you want to delete this campaign?')) return

    try {
      setActionLoading(true)
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete campaign')

      router.push('/campaigns')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete campaign')
    } finally {
      setActionLoading(false)
    }
  }

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

  const getAdTypeDescription = (type: string) => {
    switch (type) {
      case 'newsletter':
        return 'Reach thousands of readers in our daily newsletter'
      case 'sponsored':
        return 'Get featured in our editorial content with native advertising'
      case 'banner':
        return 'Display ads throughout our website'
      default:
        return ''
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="text-center py-12">
            <p className="text-gray-500">Loading campaign details...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-6xl mx-auto px-4 py-12">
          <Card className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Campaign Not Found
            </h2>
            <p className="text-gray-600 mb-6">
              The campaign you're looking for doesn't exist.
            </p>
            <Link href="/campaigns">
              <Button>Back to Campaigns</Button>
            </Link>
          </Card>
        </div>
      </div>
    )
  }

  const ctr =
    campaign.impressions && campaign.impressions > 0
      ? (((campaign.clicks || 0) / campaign.impressions) * 100).toFixed(2)
      : 0

  const costPerClick =
    (campaign.clicks || 0) > 0
      ? ((campaign.amount / 100) / (campaign.clicks || 1)).toFixed(2)
      : '0.00'

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link href="/campaigns" className="text-red-600 hover:text-red-700 mb-4">
            ← Back to Campaigns
          </Link>

          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                {campaign.name}
              </h1>
              <p className="text-lg text-gray-600">
                {getAdTypeDescription(campaign.adType)}
              </p>
            </div>

            <span
              className={`px-6 py-3 rounded-full text-lg font-semibold ${getStatusColor(
                campaign.status
              )}`}
            >
              {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800">{successMessage}</p>
          </div>
        )}

        {/* Campaign Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <div className="mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase">
                Campaign Type
              </p>
            </div>
            <p className="text-xl font-bold text-gray-900 mb-1">
              {getAdTypeLabel(campaign.adType)}
            </p>
            <p className="text-sm text-gray-600">
              {campaign.billingCycle.charAt(0).toUpperCase() +
                campaign.billingCycle.slice(1)}{' '}
              billing
            </p>
          </Card>

          <Card>
            <div className="mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase">
                Campaign Amount
              </p>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              ${(campaign.amount / 100).toFixed(2)}
            </p>
            <p className="text-sm text-gray-600">Total investment</p>
          </Card>

          <Card>
            <div className="mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase">
                Created Date
              </p>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {new Date(campaign.createdAt).toLocaleDateString()}
            </p>
            <p className="text-sm text-gray-600">
              {new Date(campaign.createdAt).toLocaleDateString('en-US', {
                weekday: 'long',
              })}
            </p>
          </Card>
        </div>

        {/* Performance Metrics */}
        <Card className="mb-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Performance Metrics
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-2">Total Impressions</p>
              <p className="text-2xl font-bold text-gray-900">
                {(campaign.impressions || 0).toLocaleString()}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-2">Total Clicks</p>
              <p className="text-2xl font-bold text-gray-900">
                {(campaign.clicks || 0).toLocaleString()}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-2">Click-Through Rate</p>
              <p className="text-2xl font-bold text-gray-900">{ctr}%</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-2">Cost Per Click</p>
              <p className="text-2xl font-bold text-gray-900">
                ${costPerClick}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-2">Cost Per 1K Impressions</p>
              <p className="text-2xl font-bold text-gray-900">
                ${(campaign.impressions && campaign.impressions > 0
                  ? ((campaign.amount / 100) / (campaign.impressions / 1000)).toFixed(2)
                  : '0.00')}
              </p>
            </div>
          </div>
        </Card>

        {/* Campaign Details */}
        <Card className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Campaign Details
          </h2>

          <div className="space-y-6">
            <div className="border-b border-gray-200 pb-6">
              <p className="text-sm text-gray-500 mb-2">Campaign Name</p>
              <p className="text-lg font-semibold text-gray-900">
                {campaign.name}
              </p>
            </div>

            <div className="border-b border-gray-200 pb-6">
              <p className="text-sm text-gray-500 mb-2">Status</p>
              <div className="flex items-center gap-2">
                <span
                  className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(
                    campaign.status
                  )}`}
                >
                  {campaign.status.charAt(0).toUpperCase() +
                    campaign.status.slice(1)}
                </span>
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-500 mb-2">Campaign Period</p>
              <p className="text-lg font-semibold text-gray-900">
                {campaign.billingCycle.charAt(0).toUpperCase() +
                  campaign.billingCycle.slice(1)}{' '}
                Billing
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Started{' '}
                {new Date(campaign.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4">
          {campaign.status === 'active' && (
            <Button
              variant="secondary"
              onClick={handlePause}
              disabled={actionLoading}
            >
              {actionLoading ? 'Pausing...' : 'Pause Campaign'}
            </Button>
          )}

          {campaign.status === 'paused' && (
            <Button
              onClick={handleResume}
              disabled={actionLoading}
            >
              {actionLoading ? 'Resuming...' : 'Resume Campaign'}
            </Button>
          )}

          {campaign.status !== 'completed' && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={actionLoading}
            >
              {actionLoading ? 'Deleting...' : 'Delete Campaign'}
            </Button>
          )}

          <Link href="/campaigns" className="ml-auto">
            <Button variant="secondary">Back to List</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
