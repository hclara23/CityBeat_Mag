'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { planCart, isSelfServeCartEligibleId, type CartItem, type CartPlan } from '@/lib/cart'

// Client-side basket so a visitor can gather several products and pay for them in
// ONE Stripe Checkout (see /api/cart/checkout). Persisted to localStorage so the
// basket survives navigation and the AI concierge (which can add to it) and the
// drawer share one source of truth. Purely a staging area — the server re-prices
// everything from SALES_PRODUCTS at checkout, so a tampered localStorage can never
// change what a buyer is charged.

const STORAGE_KEY = 'cb_cart_v1'
const OPEN_EVENT = 'cb_cart_open'

export interface CartContextValue {
  items: CartItem[]
  count: number
  plan: CartPlan
  add: (productId: string, customAmount?: number | null) => boolean
  remove: (productId: string) => void
  clear: () => void
  open: () => void
  isOpen: boolean
  setOpen: (v: boolean) => void
}

const CartContext = createContext<CartContextValue | null>(null)

function sanitize(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: CartItem[] = []
  for (const it of raw) {
    const productId = String((it as any)?.productId || '')
    if (!productId || seen.has(productId)) continue
    // Drop anything that isn't a real, self-serve-eligible product so a stale or
    // hand-edited basket can't wedge the drawer.
    if (!isSelfServeCartEligibleId(productId)) continue
    seen.add(productId)
    const customAmount = typeof (it as any)?.customAmount === 'number' ? (it as any).customAmount : null
    out.push({ productId, customAmount })
    if (out.length >= 10) break
  }
  return out
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isOpen, setOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Load once on mount.
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      setItems(sanitize(raw))
    } catch {
      /* ignore */
    }
    setHydrated(true)
  }, [])

  // Mirror items into a ref so add() can decide truthfully & synchronously whether
  // it added — React's setState updater runs asynchronously, so reading a flag set
  // inside it would report stale (the drawer wouldn't open on the first click).
  const itemsRef = useRef<CartItem[]>([])

  // Persist after hydration (never clobber storage with the empty initial state).
  useEffect(() => {
    itemsRef.current = items
    if (!hydrated) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      /* ignore */
    }
  }, [items, hydrated])

  // Let non-descendant callers (e.g. the chat widget in a sibling subtree) pop the
  // drawer open via a window event, without threading context across the tree.
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(OPEN_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_EVENT, onOpen)
  }, [])

  const add = useCallback((productId: string, customAmount?: number | null): boolean => {
    if (!isSelfServeCartEligibleId(productId)) return false
    // Decide against the ref (current committed state) so the return value is
    // reliable the instant we're called.
    const cur = itemsRef.current
    if (cur.some((i) => i.productId === productId)) return false // already in — one of each
    if (cur.length >= 10) return false
    const item: CartItem = { productId, customAmount: typeof customAmount === 'number' ? customAmount : null }
    itemsRef.current = [...cur, item] // keep the ref current for a rapid second add()
    setItems((prev) => (prev.some((i) => i.productId === productId) ? prev : [...prev, item]))
    return true
  }, [])

  const remove = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId))
  }, [])

  const clear = useCallback(() => setItems([]), [])
  const open = useCallback(() => setOpen(true), [])

  const plan = useMemo(() => planCart(items), [items])

  const value: CartContextValue = {
    items,
    count: items.length,
    plan,
    add,
    remove,
    clear,
    open,
    isOpen,
    setOpen,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}

// Fire-and-forget open from anywhere (no provider access needed).
export function openCartDrawer() {
  try {
    window.dispatchEvent(new Event(OPEN_EVENT))
  } catch {
    /* ignore */
  }
}
