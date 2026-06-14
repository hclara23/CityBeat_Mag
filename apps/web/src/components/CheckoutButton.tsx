'use client'

import { useState } from 'react'

export function CheckoutButton({ productId, type, children, className }: { productId: string, type: string, children: React.ReactNode, className?: string }) {
  const [loading, setLoading] = useState(false)

  const handleCheckout = async () => {
    setLoading(true)
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
        alert('Checkout failed')
        setLoading(false)
      }
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  return (
    <button 
      onClick={handleCheckout} 
      disabled={loading}
      className={className}
    >
      {loading ? 'Processing...' : children}
    </button>
  )
}
