'use client'

import { useLocale } from '@/components/TranslationProvider'
import { isSelfServeCartEligibleId } from '@/lib/cart'
import { useCart } from './CartProvider'

// Drop-in "Add to cart" for any self-serve product surface (ads hub, product detail
// pages). Adds the product to the shared basket and opens the drawer; if it's
// already in the basket it just opens the drawer. Renders nothing for a product
// that isn't cart-eligible, so it's safe to place unconditionally.
export function AddToCartButton({
  productId,
  className,
  variant = 'solid',
  label,
  inCartLabel,
}: {
  productId: string
  className?: string
  variant?: 'solid' | 'outline'
  /** Optional fuller copy for prominent placements (defaults to a compact "+ Cart"). */
  label?: string
  inCartLabel?: string
}) {
  const locale = useLocale()
  const isEs = locale === 'es'
  const { add, open, items } = useCart()

  if (!isSelfServeCartEligibleId(productId)) return null

  const inCart = items.some((i) => i.productId === productId)

  const onClick = () => {
    // Add if new (no-op if already in the basket), then ALWAYS reveal the drawer —
    // opening is the visible confirmation, so it must not hinge on add()'s return.
    add(productId)
    open()
  }

  const base =
    variant === 'outline'
      ? 'border border-white/25 text-white hover:bg-white/10'
      : 'bg-white text-black hover:bg-white/90'

  const idleText = label ?? (isEs ? '+ Carrito' : '+ Cart')
  const doneText = inCartLabel ?? (isEs ? 'En el carrito ✓' : 'In cart ✓')

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={inCart ? (isEs ? 'Ver carrito' : 'View cart') : isEs ? 'Agregar al carrito' : 'Add to cart'}
      className={
        className ??
        `rounded-md px-4 py-2 text-xs font-black uppercase tracking-wider transition ${base}`
      }
    >
      {inCart ? doneText : idleText}
    </button>
  )
}
