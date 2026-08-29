'use client'

import { CartDrawer } from './cart/CartDrawer'
import { ChatWidget } from './ChatWidget'

// Site-wide floating UI (cart drawer + concierge). The CartProvider now lives in
// CityBeatShell wrapping the whole page, so these just consume it.
export function SiteOverlays() {
  return (
    <>
      <CartDrawer />
      <ChatWidget />
    </>
  )
}
