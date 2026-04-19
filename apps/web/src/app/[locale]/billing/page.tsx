'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from '@/components/TranslationProvider'
import { Navigation, Button } from '@citybeat/ui'
import { AuthError } from '@citybeat/ui/auth'

interface Subscription {
  id: string
  stripe_subscription_id?: string
  stripe_customer_id?: string
  ad_type: string
  amount_total: number
  billing_cycle: string
  payment_status: string
  created_at: string
}

interface Invoice {
  id: string
  amount: number
  date: string
  status: string
  pdfUrl?: string
}

export default function BillingPage() {
  const router = useRouter()
  const locale = useLocale()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [managingPortal, setManagingPortal] = useState(false)

  useEffect(() => {
    const loadBillingData = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/billing')

        if (response.status === 401) {
          router.push(`/${locale}/login`)
          return
        }

        if (!response.ok) {
          throw new Error('Failed to load billing data')
        }

        const data = (await response.json()) as {
          subscriptions: Subscription[]
          invoices: Invoice[]
        }

        setSubscriptions(data.subscriptions)
        setInvoices(data.invoices)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load billing data')
      } finally {
        setIsLoading(false)
      }
    }

    loadBillingData()
  }, [locale, router])

  const handleManageSubscription = async (customerId: string) => {
    try {
      setManagingPortal(true)
      const response = await fetch('/api/customer-portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: customerId,
          returnUrl: `${window.location.origin}/${locale}/billing`,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to open customer portal')
      }

      const data = (await response.json()) as { url: string }
      window.location.href = data.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open subscription manager')
      setManagingPortal(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <Navigation />
        <div className="max-w-3xl mx-auto px-4 py-12">
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">Billing & Subscriptions</h1>

        {error && <AuthError message={error} />}

        {/* Active Subscriptions */}
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 mb-8">
          <h2 className="text-2xl font-bold mb-6">Active Subscriptions</h2>

          {subscriptions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No active subscriptions</p>
              <p className="text-sm text-gray-400 mt-2">
                You currently do not have any active advertising subscriptions.
              </p>
              <Button
                className="mt-4 bg-red-600 hover:bg-red-700"
                onClick={() => router.push(`/${locale}/ads`)}
              >
                Browse Plans
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {subscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className="border border-gray-200 rounded-lg p-4 flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-semibold text-gray-900 capitalize">
                      {sub.ad_type} - {sub.billing_cycle}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      ${(sub.amount_total / 100).toFixed(2)} per {sub.billing_cycle}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Started {new Date(sub.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      sub.payment_status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {sub.payment_status === 'completed' ? 'Active' : 'Pending'}
                    </span>

                    {sub.stripe_customer_id && (
                      <Button
                        variant="secondary"
                        onClick={() => handleManageSubscription(sub.stripe_customer_id!)}
                        disabled={managingPortal}
                      >
                        {managingPortal ? 'Loading...' : 'Manage'}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment Methods */}
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 mb-8">
          <h2 className="text-2xl font-bold mb-6">Payment Methods</h2>

          <div className="text-center py-8">
            <p className="text-gray-500">No payment methods on file</p>
            <p className="text-sm text-gray-400 mt-2">
              Add a payment method to manage subscriptions
            </p>
            <Button className="mt-4">Add Payment Method</Button>
          </div>
        </div>

        {/* Billing History */}
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
          <h2 className="text-2xl font-bold mb-6">Billing History</h2>

          {invoices.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No invoices yet</p>
              <p className="text-sm text-gray-400 mt-2">
                Your invoices will appear here once you have an active subscription
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      Invoice
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      Date
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      Amount
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-gray-200">
                      <td className="py-3 px-4 text-gray-900">{invoice.id}</td>
                      <td className="py-3 px-4 text-gray-600">
                        {new Date(invoice.date).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-gray-900 font-semibold">
                        ${(invoice.amount / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          invoice.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {invoice.pdfUrl && (
                          <a
                            href={invoice.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-red-600 hover:text-red-700 font-medium text-sm"
                          >
                            Download PDF
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Billing Info */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            Need help with your billing? Contact our support team at{' '}
            <a href="mailto:support@citybeatmag.co" className="font-semibold hover:underline">
              support@citybeatmag.co
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
