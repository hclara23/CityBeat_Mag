// Multi-item checkout consolidation. Given a basket of CityBeat products, decide
// the ONE Stripe Checkout session that charges them together — respecting the
// hard Stripe rules a single session imposes:
//   • A session is `payment` (one-time) OR `subscription` (recurring), not both.
//   • All recurring items in a subscription must share ONE billing interval.
//   • One-time items ARE allowed alongside recurring ones in a subscription —
//     they ride the FIRST invoice only (charged once, then don't recur).
//
// So the rule is: all one-time → payment mode; any recurring → subscription mode
// (one-time add-ons fold into the first invoice); recurring items of MIXED
// intervals (e.g. a monthly + an annual plan) can't be one session — the caller
// must split or normalize.
//
// Pure + unit-tested; the checkout route consumes toStripeLineItems() and the
// webhook fulfills each planned line item. Prices come from SALES_PRODUCTS (the
// single source of truth) so a cart can never quote a price checkout won't charge.

import { SALES_PRODUCTS, getSalesProduct, salesProductAmount, type SalesProduct, type SalesProductId } from './sales-products'

export type CartItem = { productId: string; customAmount?: number | null }

/**
 * Whether a product may go into the SELF-SERVE one-checkout basket. Directory
 * plans attach to a specific listing (they use the per-listing Claim flow) and the
 * "custom" SKU is a rep-quoted name-your-price line — both are barred so a buyer
 * can't self-serve them here. Free products aren't purchasable. This is the single
 * source of truth the checkout route, the cart provider, and the concierge all use.
 */
export function isSelfServeCartEligible(product: SalesProduct | null | undefined): boolean {
  if (!product) return false
  if (product.family === 'directory' || product.family === 'custom') return false
  if (product.billing === 'free') return false
  return true
}

export function isSelfServeCartEligibleId(productId: string): boolean {
  return isSelfServeCartEligible(getSalesProduct(productId))
}

export interface CheckoutLineItem {
  productId: SalesProductId
  name: string
  amount: number // cents (per unit)
  recurring: { interval: 'month' | 'year' } | null
}

export type CartPlan =
  | { ok: false; reason: string }
  | {
      ok: true
      mode: 'payment' | 'subscription'
      lineItems: CheckoutLineItem[]
      hasRecurring: boolean
      total: number // sum of item amounts, cents (first-invoice total)
      warnings: string[]
    }

export const MAX_CART_ITEMS = 10

/**
 * Resolve + consolidate a basket into a single Stripe Checkout session plan, or
 * an error the caller can act on (e.g. 'mixed_recurring_intervals' → split).
 */
export function planCart(items: CartItem[]): CartPlan {
  if (!Array.isArray(items) || items.length === 0) return { ok: false, reason: 'empty_cart' }
  if (items.length > MAX_CART_ITEMS) return { ok: false, reason: 'too_many_items' }

  const resolved: CheckoutLineItem[] = []
  const seen = new Set<string>()
  for (const it of items) {
    const p = getSalesProduct(it?.productId)
    if (!p) return { ok: false, reason: `unknown_product:${it?.productId}` }
    if (p.billing === 'free') return { ok: false, reason: `free_product_not_purchasable:${p.id}` }
    // A subscription product can only appear once (you can't hold two of the same
    // recurring plan); one-time products likewise collapse to one line here.
    if (seen.has(p.id)) return { ok: false, reason: `duplicate_product:${p.id}` }
    seen.add(p.id)

    const amount = salesProductAmount(p, it.customAmount)
    if (amount == null || amount < 1) return { ok: false, reason: `invalid_amount:${p.id}` }

    resolved.push({
      productId: p.id,
      name: SALES_PRODUCTS[p.id].name,
      amount,
      recurring: p.billing === 'subscription' && p.interval ? { interval: p.interval } : null,
    })
  }

  const recurring = resolved.filter((r) => r.recurring)
  const total = resolved.reduce((s, r) => s + r.amount, 0)
  const warnings: string[] = []

  if (recurring.length === 0) {
    return { ok: true, mode: 'payment', lineItems: resolved, hasRecurring: false, total, warnings }
  }

  const intervals = new Set(recurring.map((r) => r.recurring!.interval))
  if (intervals.size > 1) {
    // A monthly + an annual plan cannot be one Stripe subscription.
    return { ok: false, reason: 'mixed_recurring_intervals' }
  }

  const oneTime = resolved.filter((r) => !r.recurring)
  if (oneTime.length > 0) {
    warnings.push('one_time_items_billed_on_first_invoice')
  }
  return { ok: true, mode: 'subscription', lineItems: resolved, hasRecurring: true, total, warnings }
}

/**
 * Stripe Checkout `line_items` (dynamic price_data) for a valid plan. Recurring
 * items carry `recurring`; one-time items don't — in a subscription session that
 * charges the one-time ones on the first invoice only. Each line carries the
 * product id in product_data.metadata so the webhook can fulfill per line.
 */
export function toStripeLineItems(plan: Extract<CartPlan, { ok: true }>) {
  return plan.lineItems.map((li) => ({
    quantity: 1,
    price_data: {
      currency: 'usd',
      unit_amount: li.amount,
      product_data: { name: li.name, metadata: { product_id: li.productId } },
      ...(li.recurring ? { recurring: { interval: li.recurring.interval } } : {}),
    },
  }))
}
