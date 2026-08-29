'use client'

import { CartProvider } from './cart/CartProvider'
import { CartDrawer } from './cart/CartDrawer'
import { ChatWidget } from './ChatWidget'

// One client island for the site-wide floating UI. The CartProvider must wrap BOTH
// the chat widget (the concierge can add products to the basket) and the drawer, so
// they share a single cart. Mounted once by CityBeatShell.
export function SiteOverlays() {
  return (
    <CartProvider>
      <CartDrawer />
      <ChatWidget />
    </CartProvider>
  )
}
