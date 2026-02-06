'use client'

import { useState } from 'react'
import { useTranslations } from '@/components/TranslationProvider'
import { Button, Input, Card } from '@citybeat/ui'

interface CheckoutFormProps {
  adType: 'newsletter' | 'sponsored' | 'banner'
  billingCycle: 'monthly' | 'per-post'
  price: number
  onSubmit: (data: any) => void
  onCancel: () => void
  loading?: boolean
}

export function CheckoutForm({
  adType,
  price,
  onSubmit,
  onCancel,
  loading = false,
}: CheckoutFormProps) {
  const t = useTranslations('checkout')
  const tErrors = useTranslations('errors')
  const tCommon = useTranslations('common')
  const tNewsletter = useTranslations('newsletter')
  const tSponsored = useTranslations('sponsored')
  const tBanners = useTranslations('banners')

  const [formData, setFormData] = useState({
    advertiserEmail: '',
    companyName: '',
    contactName: '',
    phone: '',
    website: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate
    const newErrors: Record<string, string> = {}
    if (!formData.advertiserEmail) newErrors.advertiserEmail = tErrors('emailRequired')
    if (!formData.companyName) newErrors.companyName = tErrors('companyNameRequired')
    if (!formData.contactName) newErrors.contactName = tErrors('contactNameRequired')
    if (!formData.phone) newErrors.phone = tErrors('phoneRequired')

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="max-w-md w-full">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {t('title')}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              name="advertiserEmail"
              label={t('email')}
              placeholder={t('emailPlaceholder')}
              value={formData.advertiserEmail}
              onChange={handleChange}
              error={errors.advertiserEmail}
            />

            <Input
              type="text"
              name="companyName"
              label={t('companyName')}
              placeholder={t('companyPlaceholder')}
              value={formData.companyName}
              onChange={handleChange}
              error={errors.companyName}
            />

            <Input
              type="text"
              name="contactName"
              label={t('contactName')}
              placeholder={t('contactPlaceholder')}
              value={formData.contactName}
              onChange={handleChange}
              error={errors.contactName}
            />

            <Input
              type="tel"
              name="phone"
              label={t('phone')}
              placeholder={t('phonePlaceholder')}
              value={formData.phone}
              onChange={handleChange}
              error={errors.phone}
            />

            <Input
              type="url"
              name="website"
              label={`${t('website')} ${t('websiteOptional')}`}
              placeholder={t('websitePlaceholder')}
              value={formData.website}
              onChange={handleChange}
            />

            <div className="bg-blue-50 border border-blue-200 rounded p-3 my-4">
              <p className="text-sm text-blue-900">
                <strong>Total: ${price / 100}</strong> for{' '}
                <strong>
                  {adType === 'newsletter'
                    ? tNewsletter('title')
                    : adType === 'sponsored'
                      ? tSponsored('title')
                      : tBanners('title')}
                </strong>
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={onCancel}
                disabled={loading}
                className="flex-1"
              >
                {tCommon('cancel')}
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? t('processingPayment') : t('continueToPayment')}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  )
}
