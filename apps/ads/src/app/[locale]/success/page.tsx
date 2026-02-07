'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Navigation, Button, Card } from '@citybeat/ui'
import Link from 'next/link'

interface OrderDetails {
  campaignId: string
  campaignName: string
  adType: string
  billingCycle: string
  amount: number
  status: string
  createdAt: string
}

export default function SuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const campaignId = searchParams.get('campaign_id')
  const sessionId = searchParams.get('session_id')

  const [order, setOrder] = useState<OrderDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!campaignId) {
      setError('Invalid order information')
      setIsLoading(false)
      return
    }

    const fetchOrderDetails = async () => {
      try {
        const response = await fetch(`/api/campaigns/${campaignId}`)
        if (!response.ok) throw new Error('Failed to fetch order details')

        const data = (await response.json()) as { data: OrderDetails }
        setOrder(data.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load order details')
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrderDetails()
  }, [campaignId])

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="text-center py-12">
            <p className="text-gray-500">Loading order details...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-2xl mx-auto px-4 py-12">
          <Card className="text-center py-12 border-red-200 bg-red-50">
            <h2 className="text-2xl font-bold text-red-900 mb-4">Order Error</h2>
            <p className="text-red-800 mb-6">{error || 'Unable to load order details'}</p>
            <div className="flex gap-4 justify-center">
              <Link href="/campaigns">
                <Button variant="secondary">Back to Campaigns</Button>
              </Link>
              <Button onClick={() => router.refresh()}>
                Retry
              </Button>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Success Header */}
        <Card className="text-center py-12 bg-green-50 border-green-200 mb-8">
          <div className="mb-4 text-5xl">✓</div>
          <h1 className="text-3xl font-bold text-green-900 mb-2">
            Payment Successful
          </h1>
          <p className="text-green-800">
            Your campaign has been created and is pending review
          </p>
        </Card>

        {/* Order Details */}
        <Card className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Campaign Details
          </h2>

          <div className="space-y-6">
            <div className="border-b border-gray-200 pb-6">
              <p className="text-sm text-gray-600 mb-1">Campaign Name</p>
              <p className="text-lg font-semibold text-gray-900">
                {order.campaignName}
              </p>
            </div>

            <div className="border-b border-gray-200 pb-6">
              <p className="text-sm text-gray-600 mb-1">Campaign Type</p>
              <p className="text-lg font-semibold text-gray-900">
                {getAdTypeLabel(order.adType)}
              </p>
            </div>

            <div className="border-b border-gray-200 pb-6">
              <p className="text-sm text-gray-600 mb-1">Billing Cycle</p>
              <p className="text-lg font-semibold text-gray-900">
                {order.billingCycle.charAt(0).toUpperCase() +
                  order.billingCycle.slice(1)}
              </p>
            </div>

            <div className="border-b border-gray-200 pb-6">
              <p className="text-sm text-gray-600 mb-1">Amount Paid</p>
              <p className="text-2xl font-bold text-gray-900">
                ${(order.amount / 100).toFixed(2)}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-1">Order Status</p>
              <p className="inline-block px-4 py-2 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </p>
            </div>
          </div>
        </Card>

        {/* Next Steps */}
        <Card className="mb-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4">What is Next?</h3>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-semibold">
                1
              </div>
              <div>
                <p className="font-semibold text-gray-900">Review Pending</p>
                <p className="text-sm text-gray-600">
                  Your campaign is being reviewed by our team. This typically takes 24 hours.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-semibold">
                2
              </div>
              <div>
                <p className="font-semibold text-gray-900">Confirmation Email</p>
                <p className="text-sm text-gray-600">
                  You will receive an email once your campaign is approved and live.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-semibold">
                3
              </div>
              <div>
                <p className="font-semibold text-gray-900">Track Performance</p>
                <p className="text-sm text-gray-600">
                  Access your campaign dashboard to monitor impressions, clicks, and engagement.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Support Info */}
        <Card className="bg-gray-100 mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-2">Need Help?</h3>
          <p className="text-gray-700 mb-4">
            If you have any questions about your campaign or account, our support team is here to help.
          </p>
          <div className="flex gap-4">
            <a href="mailto:support@citybeatmag.co" className="text-red-600 hover:text-red-700 font-semibold">
              support@citybeatmag.co
            </a>
            <span className="text-gray-400">•</span>
            <a href="tel:+1234567890" className="text-red-600 hover:text-red-700 font-semibold">
              (123) 456-7890
            </a>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center">
          <Link href="/campaigns">
            <Button className="px-8">View All Campaigns</Button>
          </Link>
          <Link href={`/campaigns/${campaignId}`}>
            <Button variant="secondary" className="px-8">
              View Campaign Details
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
