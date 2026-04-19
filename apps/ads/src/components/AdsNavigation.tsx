'use client'

import { Navigation } from '@citybeat/ui'
import { useLocale } from '@/components/TranslationProvider'

export function AdsNavigation() {
  const locale = useLocale()

  return (
    <Navigation
      brand="CityBeat Ads"
      items={[
        { label: 'Home', href: `/${locale}` },
        { label: 'Campaigns', href: `/${locale}/campaigns` },
        { label: 'Orders', href: `/${locale}/orders` },
      ]}
    />
  )
}
