'use client'

import { useState } from 'react'
import { useTranslations } from '@/components/TranslationProvider'
import { Button, Card } from '@citybeat/ui'
import { loadStripe } from '@stripe/js'

interface PricingCardProps {
  title: string
  price: number | string
  description: string
  features: string[]
  adType: 'newsletter' | 'sponsored' | 'banner'
  billingCycle: 'monthly' | 'per-post'
  onSelect: (adType: string) => void
}

export function PricingCard({
  title,
  price,
  description,
  features,
  adType,
  billingCycle,
  onSelect,
}: PricingCardProps) {
  const t = useTranslations('common')
  const [selected, setSelected] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleCheckout = async () => {
    setLoading(true)
    try {
      // In a real implementation, this would open a modal to collect user info first
      // For now, we'll show the selection and assume email collection happens before
      onSelect(adType)
    } catch (error) {
      console.error('Checkout error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card
      className={`h-full transition-all ${
        selected ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md'
      }`}
    >
      <div className="flex flex-col h-full">
        <div className="flex-1">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-600 text-sm mb-4">{description}</p>

          <div className="mb-6">
            <span className="text-4xl font-bold text-primary">
              ${typeof price === 'number' ? price.toFixed(0) : price}
            </span>
            <span className="text-gray-600 ml-2">
              {billingCycle === 'monthly' ? t('month') : t('post')}
            </span>
          </div>

          <ul className="space-y-3 mb-6">
            {features.map((feature, idx) => (
              <li key={idx} className="flex items-start">
                <span className="text-primary font-bold mr-3">✓</span>
                <span className="text-gray-700 text-sm">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => {
              setSelected(!selected)
              if (!selected) {
                handleCheckout()
              }
            }}
            disabled={loading}
            variant={selected ? 'primary' : 'secondary'}
            className="w-full"
          >
            {loading ? t('processing') : selected ? t('selected') : t('selectPlan')}
          </Button>

          {selected && (
            <Button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full"
            >
              {loading ? t('proceedingToCheckout') : t('proceedToCheckout')}
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
