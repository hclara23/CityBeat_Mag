'use client'

import { useState } from 'react'

export function CheckoutButton({ productId, type, children, className }: { productId: string, type: string, children: React.ReactNode, className?: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCheckout = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          productId,
          type,
          returnUrl: window.location.href
        })
      })

      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        console.error(data.error)
        setError(data.error || 'Checkout could not start — please try again.')
        setLoading(false)
      }
    } catch (err) {
      console.error(err)
      setError('Network error — please check your connection and try again.')
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleCheckout}
        disabled={loading}
        className={className}
      >
        {loading ? 'Processing...' : children}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-400">{error}</p>
      )}
    </div>
  )
}
