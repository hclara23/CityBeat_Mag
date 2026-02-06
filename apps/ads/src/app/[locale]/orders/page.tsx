'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Navigation, Button, Card } from '@citybeat/ui'
import Link from 'next/link'

interface Order {
  id: string
  campaignName: string
  campaignId: string
  adType: string
  amount: number
  billingCycle: string
  status: string
  createdAt: string
  nextBillingDate?: string
  invoiceUrl?: string
}

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'completed'>('all')

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/orders')
        if (!response.ok) throw new Error('Failed to fetch orders')

        const data = (await response.json()) as { data: Order[] }
        setOrders(data.data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load orders')
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrders()
  }, [])

  const filteredOrders = orders.filter((order) => {
    if (filter === 'all') return true
    return order.status === filter
  })

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const totalSpent = orders.reduce((sum, order) => sum + order.amount, 0)
  const activeOrders = orders.filter((o) => o.status === 'active').length

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Order History</h1>
          <p className="text-gray-600">
            View and manage all your advertising orders and invoices
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <p className="text-sm text-gray-600 mb-2">Total Orders</p>
            <p className="text-3xl font-bold text-gray-900">
              {orders.length}
            </p>
          </Card>

          <Card>
            <p className="text-sm text-gray-600 mb-2">Active Campaigns</p>
            <p className="text-3xl font-bold text-gray-900">
              {activeOrders}
            </p>
          </Card>

          <Card>
            <p className="text-sm text-gray-600 mb-2">Total Spent</p>
            <p className="text-3xl font-bold text-gray-900">
              ${(totalSpent / 100).toFixed(2)}
            </p>
          </Card>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Filters */}
        <Card className="mb-8">
          <div className="flex gap-4 flex-wrap">
            {(['all', 'pending', 'active', 'completed'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  filter === status
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </Card>

        {/* Orders Table */}
        {isLoading ? (
          <Card className="text-center py-12">
            <p className="text-gray-500">Loading orders...</p>
          </Card>
        ) : filteredOrders.length === 0 ? (
          <Card className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">No Orders Found</h2>
            <p className="text-gray-600 mb-6">
              {filter === 'all'
                ? "You haven't created any advertising campaigns yet."
                : `No ${filter} campaigns at this time.`}
            </p>
            <Link href="/campaigns">
              <Button>Create New Campaign</Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <Card key={order.id} className="hover:shadow-lg transition">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  {/* Order Info */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">
                          {order.campaignName}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {getAdTypeLabel(order.adType)} •{' '}
                          {order.billingCycle.charAt(0).toUpperCase() +
                            order.billingCycle.slice(1)}
                        </p>
                      </div>
                      <span
                        className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(
                          order.status
                        )}`}
                      >
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </div>

                    {/* Order Details Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Amount</p>
                        <p className="font-semibold text-gray-900">
                          ${(order.amount / 100).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Order Date</p>
                        <p className="font-semibold text-gray-900">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      {order.nextBillingDate && (
                        <div>
                          <p className="text-gray-600">Next Billing</p>
                          <p className="font-semibold text-gray-900">
                            {new Date(order.nextBillingDate).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-gray-600">Order ID</p>
                        <p className="font-semibold text-gray-900 font-mono text-xs">
                          {order.id.slice(0, 8)}...
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 md:flex-col">
                    <Link href={`/campaigns/${order.campaignId}`}>
                      <Button variant="secondary" size="sm" className="w-full">
                        View Campaign
                      </Button>
                    </Link>
                    {order.invoiceUrl && (
                      <a href={order.invoiceUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="secondary" size="sm" className="w-full">
                          Download Invoice
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Invoice Management Info */}
        <Card className="mt-8 bg-blue-50 border-blue-200">
          <h3 className="text-lg font-bold text-blue-900 mb-2">Invoice Management</h3>
          <p className="text-blue-800 mb-4">
            All invoices are automatically generated and sent to your email. You can also
            download them directly from your order details.
          </p>
          <p className="text-sm text-blue-700">
            For billing inquiries, contact{' '}
            <a href="mailto:billing@citybeatmag.co" className="font-semibold underline">
              billing@citybeatmag.co
            </a>
          </p>
        </Card>
      </div>
    </div>
  )
}
