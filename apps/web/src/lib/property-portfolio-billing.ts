import { randomUUID } from 'crypto'
import type Stripe from 'stripe'
import type { Firestore } from 'firebase-admin/firestore'
import { PROPERTY_PORTFOLIO_MONTHLY_CENTS as PRICE, PROPERTY_PORTFOLIO_PROMO as PROMO } from './property-companies'
import { ownsPortfolio, ownsPortfolioListing, requirePortfolio } from './property-portfolio-policy'

const stamp = () => new Date().toISOString()
const idOf = (value: any): string | null => typeof value === 'string' ? value : value?.id || null
const terminal = (status: string) => ['canceled', 'incomplete_expired'].includes(status)
export function validPortfolioPrice(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0]
  return subscription.items.data.length === 1 && item.price.unit_amount === PRICE && item.price.currency === 'usd' &&
    item.price.recurring?.interval === 'month' && item.price.recurring.interval_count === 1 && !subscription.discount &&
    Number.isInteger(item.quantity) && Number(item.quantity) > 0 && Number(item.quantity) <= 200
}
export function propertyPortfolioBilling(db: Firestore, stripe: Stripe, origin: string) {
  const ref = (company: string) => db.collection('property_accounts').doc(company)
  async function owned(company: string, uid: string) {
    const data = (await ref(company).get()).data()
    requirePortfolio(ownsPortfolio(data, uid), 'corporate_access_required', 403)
    return data!
  }
  async function checkout(company: string, user: { id: string; email?: string }, locale: string, confirmedTotal: number) {
    const initial = await owned(company, user.id)
    let replace = false
    if (initial.stripe_subscription_id) {
      const sub = await stripe.subscriptions.retrieve(initial.stripe_subscription_id)
      requirePortfolio(terminal(sub.status), 'subscription_exists')
      replace = true
    }
    if (initial.checkout_attempt?.session_id && !replace) {
      const session = await stripe.checkout.sessions.retrieve(initial.checkout_attempt.session_id)
      if (session.status === 'open' && session.url) return { url: session.url }
      requirePortfolio(session.status !== 'complete', 'payment_confirming')
      replace = session.status === 'expired'
    }
    if (initial.checkout_attempt && !initial.checkout_attempt.session_id && initial.checkout_attempt.expires <= Date.now() / 1000 && !replace) {
      // Recover an unknown create outcome before rotating its idempotency key.
      // The dedicated customer is persisted before a Checkout session is created.
      if (initial.stripe_customer_id) {
        const sessions = await stripe.checkout.sessions.list({ customer: initial.stripe_customer_id, limit: 100 })
        const previous = sessions.data.find(s => s.metadata?.checkout_attempt === initial.checkout_attempt.id)
        requirePortfolio(previous || !sessions.has_more, 'billing_review_required')
        if (previous?.status === 'open' && previous.url) return { url: previous.url }
        requirePortfolio(previous?.status !== 'complete', 'payment_confirming')
      }
      replace = true
    }
    const attempt = await db.runTransaction(async tx => {
      const doc = await tx.get(ref(company)), account = doc.data()!
      requirePortfolio(ownsPortfolio(account, user.id), 'corporate_access_required', 403)
      requirePortfolio(account.stripe_subscription_id === initial.stripe_subscription_id, 'billing_changed')
      const ids: string[] = account.listing_ids || []
      requirePortfolio(ids.length > 0 && ids.length <= 200 && confirmedTotal === ids.length * PRICE, 'confirm_monthly_total', 400)
      const listings = await Promise.all(ids.map(id => tx.get(db.collection('directory_listings').doc(id))))
      for (const listing of listings) requirePortfolio(ownsPortfolioListing({ ...account, id: company }, listing.data(), listing.id), 'property_access_required', 403)
      if (account.checkout_attempt && (!replace || account.checkout_attempt.id !== initial.checkout_attempt?.id)) {
        requirePortfolio(account.checkout_attempt.expires > Date.now() / 1000, 'checkout_expired')
        return account.checkout_attempt
      }
      const attempt = { id: randomUUID(), ids, locale: locale === 'es' ? 'es' : 'en', expires: Math.floor(Date.now() / 1000) + 23 * 3600, session_id: null }
      tx.set(ref(company), { checkout_attempt: attempt, updated_at: stamp() }, { merge: true })
      return attempt
    })
    const customer = initial.stripe_customer_id || (await stripe.customers.create({ email: user.email,
      metadata: { property_account_id: company, owner_id: user.id } }, { idempotencyKey: `property-customer:${company}:${user.id}` })).id
    await ref(company).set({ stripe_customer_id: customer }, { merge: true })
    const metadata = { property_account_id: company, owner_id: user.id, promo_id: PROMO, checkout_attempt: attempt.id }
    const session = await stripe.checkout.sessions.create({ customer, mode: 'subscription', payment_method_types: ['card'],
      locale: attempt.locale, expires_at: attempt.expires, client_reference_id: company, metadata,
      subscription_data: { metadata },
      line_items: [{ quantity: attempt.ids.length, price_data: { currency: 'usd', unit_amount: PRICE,
        recurring: { interval: 'month' }, product_data: { name: 'CityBeat property portfolio — active-subscription founders rate' } } }],
      custom_text: { submit: { message: attempt.locale === 'es' ? '$9.99 USD por propiedad al mes, con renovación automática. La tarifa permanece fija mientras la suscripción siga activa. Cancele en Facturación.' : '$9.99 USD per property each month, automatically renewed. Your rate stays locked while the subscription remains active. Cancel in Billing.' } },
      success_url: `${origin}/${attempt.locale}/property-management/${company}?payment=received#portfolio`,
      cancel_url: `${origin}/${attempt.locale}/property-management/${company}#portfolio`,
    }, { idempotencyKey: `property-checkout:${company}:${attempt.id}` })
    await db.runTransaction(async tx => {
      const current = (await tx.get(ref(company))).data()!
      requirePortfolio(current.checkout_attempt?.id === attempt.id && ownsPortfolio(current, user.id), 'billing_changed')
      tx.set(ref(company), { stripe_customer_id: customer, checkout_attempt: { ...current.checkout_attempt, session_id: session.id }, updated_at: stamp() }, { merge: true })
    })
    return { url: session.url }
  }
  async function portal(company: string, uid: string, locale: string) {
    const account = await owned(company, uid)
    requirePortfolio(account.stripe_customer_id, 'billing_not_started')
    const setting = db.collection('billing_settings').doc('property_portfolio')
    let configuration = (await setting.get()).data()?.portal_configuration
    if (!configuration) {
      const created = await stripe.billingPortal.configurations.create({
        business_profile: { headline: 'CityBeat property portfolio billing' },
        features: { payment_method_update: { enabled: true }, invoice_history: { enabled: true },
          subscription_cancel: { enabled: true, mode: 'at_period_end', proration_behavior: 'none' },
          subscription_update: { enabled: false, default_allowed_updates: [], products: [] } },
      }, { idempotencyKey: 'citybeat-property-portfolio-portal-v1' })
      configuration = created.id
      await setting.set({ portal_configuration: configuration }, { merge: true })
    }
    const session = await stripe.billingPortal.sessions.create({ customer: account.stripe_customer_id, configuration,
      locale: locale === 'es' ? 'es' : 'en', return_url: `${origin}/${locale === 'es' ? 'es' : 'en'}/property-management/${company}#portfolio` })
    return { url: session.url }
  }
  async function quoteAddition(company: string, uid: string) {
    const account = await owned(company, uid)
    requirePortfolio(account.stripe_subscription_id && !account.pending_enrollment, 'billing_changed')
    const sub = await stripe.subscriptions.retrieve(account.stripe_subscription_id)
    requirePortfolio(sub.status === 'active' && !sub.cancel_at_period_end && !sub.pending_update && validPortfolioPrice(sub), 'active_subscription_required')
    const ids: string[] = account.listing_ids || [], old: string[] = account.billed_listing_ids || []
    requirePortfolio(ids.length > old.length && old.every(id => ids.includes(id)) && sub.items.data[0].quantity === old.length, 'no_new_properties')
    const date = Math.floor(Date.now() / 1000)
    const preview = await stripe.invoices.retrieveUpcoming({ subscription: sub.id,
      subscription_items: [{ id: sub.items.data[0].id, quantity: ids.length }],
      subscription_proration_behavior: 'always_invoice', subscription_proration_date: date })
    requirePortfolio(!preview.lines.has_more && !preview.discount && !preview.automatic_tax?.enabled, 'billing_review_required')
    const amount = preview.lines.data.filter(line => line.proration && line.period.start === date).reduce((sum, line) => sum + line.amount, 0)
    requirePortfolio(amount >= 0, 'billing_review_required')
    const quote = { id: randomUUID(), ids, subscription: sub.id, item: sub.items.data[0].id, date, due_cents: amount,
      monthly_cents: ids.length * PRICE, expires: date + 600 }
    await db.runTransaction(async tx => {
      const current = (await tx.get(ref(company))).data()!
      requirePortfolio(ownsPortfolio(current, uid) && !current.pending_enrollment && current.stripe_subscription_id === sub.id && JSON.stringify(current.listing_ids) === JSON.stringify(ids), 'billing_changed')
      tx.set(ref(company), { enrollment_quote: quote }, { merge: true })
    })
    return { quote: { id: quote.id, due_cents: amount, monthly_cents: quote.monthly_cents, added: ids.length - old.length, expires: quote.expires } }
  }
  async function enroll(company: string, uid: string, quoteId: string, due: number, monthly: number) {
    const quote = await db.runTransaction(async tx => {
      const account = (await tx.get(ref(company))).data()!
      requirePortfolio(ownsPortfolio(account, uid), 'corporate_access_required', 403)
      const quote = account.pending_enrollment || account.enrollment_quote
      requirePortfolio(quote && quote.id === quoteId && quote.due_cents === due && quote.monthly_cents === monthly, 'confirm_monthly_total', 400)
      requirePortfolio(account.pending_enrollment || quote.expires > Date.now() / 1000, 'quote_expired')
      const docs = await Promise.all(quote.ids.map((id: string) => tx.get(db.collection('directory_listings').doc(id))))
      for (const doc of docs) requirePortfolio(ownsPortfolioListing({ ...account, id: company }, doc.data(), doc.id), 'property_access_required', 403)
      tx.set(ref(company), { pending_enrollment: quote, updated_at: stamp() }, { merge: true })
      return quote
    })
    const sub = await stripe.subscriptions.update(quote.subscription, { items: [{ id: quote.item, quantity: quote.ids.length }],
      proration_date: quote.date, proration_behavior: 'always_invoice', payment_behavior: 'pending_if_incomplete', expand: ['latest_invoice'],
    }, { idempotencyKey: `property-enroll:${company}:${quote.id}` })
    const invoice = typeof sub.latest_invoice === 'object' ? sub.latest_invoice : null
    return { ok: true, url: invoice?.status === 'open' ? invoice.hosted_invoice_url : null, confirming: true }
  }
  return { checkout, portal, quoteAddition, enroll }
}

/** Signed webhook entrypoint calls this before single-listing fulfillment.
 * Always retrieve current Stripe state: delivery order never determines access.
 */
export async function handlePropertyPortfolioEvent(event: Stripe.Event, stripe: Stripe, db: Firestore) {
  const object = event.data.object as any
  let subscriptionId: string | null = null, blockedInvoice: string | null = null, wonInvoice: string | null = null
  if (event.type.startsWith('customer.subscription.')) {
    if (object.metadata?.promo_id !== PROMO) return false
    subscriptionId = object.id
  } else if (event.type === 'checkout.session.completed') {
    if (object.metadata?.promo_id !== PROMO) return false
    subscriptionId = idOf(object.subscription)
  } else if (['invoice.payment_succeeded', 'invoice.payment_failed', 'invoice.paid'].includes(event.type)) {
    subscriptionId = idOf(object.subscription || object.parent?.subscription_details?.subscription)
  } else if (['charge.refunded', 'charge.dispute.created', 'charge.dispute.closed'].includes(event.type)) {
    const charge = event.type === 'charge.refunded' ? object : await stripe.charges.retrieve(idOf(object.charge)!)
    if (charge.invoice) {
      const invoice = await stripe.invoices.retrieve(idOf(charge.invoice)!)
      subscriptionId = idOf(invoice.subscription)
      if (charge.refunded || (event.type.includes('dispute') && object.status !== 'won')) blockedInvoice = invoice.id
      if (event.type === 'charge.dispute.closed' && object.status === 'won') wonInvoice = invoice.id
    }
  }
  if (!subscriptionId) return false
  const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['latest_invoice.charge'] })
  if (sub.metadata.promo_id !== PROMO) return false
  const company = sub.metadata.property_account_id
  requirePortfolio(company && /^[a-z0-9-]+$/.test(company), 'invalid_billing_account')
  const accountRef = db.collection('property_accounts').doc(company)
  const invoice = typeof sub.latest_invoice === 'object' ? sub.latest_invoice : null
  const charge = invoice && typeof invoice.charge === 'object' ? invoice.charge : null
  await db.runTransaction(async tx => {
    const account = (await tx.get(accountRef)).data()
    requirePortfolio(account && account.status === 'approved' && account.owner_id === sub.metadata.owner_id, 'billing_owner_mismatch')
    // A retired subscription cannot change a replacement subscription's access.
    if (account.stripe_subscription_id && account.stripe_subscription_id !== sub.id && account.checkout_attempt?.id !== sub.metadata.checkout_attempt) return
    requirePortfolio(account.checkout_attempt?.id === sub.metadata.checkout_attempt || account.stripe_subscription_id === sub.id, 'billing_attempt_mismatch')
    requirePortfolio(idOf(sub.customer) === account.stripe_customer_id, 'billing_customer_mismatch')
    requirePortfolio(validPortfolioPrice(sub), 'billing_price_mismatch')
    const blocked: string[] = [...new Set([...(account.blocked_invoice_ids || []), ...(blockedInvoice ? [blockedInvoice] : [])])].filter(id => id !== wonInvoice)
    const won: string[] = [...new Set([...(account.resolved_dispute_invoice_ids || []), ...(wonInvoice ? [wonInvoice] : [])])].filter(id => id !== blockedInvoice)
    const current: string[] = account.billed_listing_ids || []
    const pending: string[] = account.pending_enrollment?.ids || account.checkout_attempt?.ids || []
    const quantity = sub.items.data[0].quantity!
    const paid = sub.status === 'active' && invoice?.status === 'paid' && !blocked.includes(invoice.id) && !charge?.refunded && (!charge?.disputed || won.includes(invoice.id))
    const paidPeriodReversed = invoice && invoice.id === account.paid_invoice_id && (charge?.refunded || (charge?.disputed && !won.includes(invoice.id)) || invoice.status === 'void' || invoice.status === 'uncollectible')
    const retained = sub.status === 'active' && account.paid_period_end > Date.now() / 1000 && !blocked.includes(account.paid_invoice_id) && !paidPeriodReversed
    const roster = paid && pending.length === quantity ? pending : current
    requirePortfolio(!paid || roster.length === quantity, 'billing_quantity_mismatch')
    const enabled = paid || (retained && current.length === quantity)
    const ids = [...new Set([...current, ...roster])]
    const docs = await Promise.all(ids.map(id => tx.get(db.collection('directory_listings').doc(id))))
    for (const doc of docs) requirePortfolio(ownsPortfolioListing({ ...account, id: company }, doc.data(), doc.id), 'billing_property_mismatch')
    for (const doc of docs) {
      const active = enabled && roster.includes(doc.id)
      tx.set(doc.ref, { tier: active ? 'premium' : 'basic', plan: active ? 'property_portfolio_founders' : 'basic',
        property_portfolio_paid: active, stripe_subscription_id: sub.id,
        ...(doc.data()?.property_custom ? { is_published: active } : {}), updated_at: stamp() }, { merge: true })
    }
    tx.set(accountRef, { stripe_subscription_id: sub.id, billing_status: sub.status,
      billed_listing_ids: enabled ? roster : current, cancel_at_period_end: sub.cancel_at_period_end,
      blocked_invoice_ids: blocked, resolved_dispute_invoice_ids: won, ...(paid ? { paid_invoice_id: invoice!.id, paid_period_end: sub.current_period_end } : {}),
      ...((paid && account.pending_enrollment?.ids.length === quantity) || (event.type === 'customer.subscription.pending_update_expired' && !sub.pending_update && current.length === quantity) ? { pending_enrollment: null, enrollment_quote: null } : {}), updated_at: stamp() }, { merge: true })
    tx.set(db.collection('subscriptions').doc(sub.id), { advertiser_id: account.owner_id, property_account_id: company,
      stripe_customer_id: idOf(sub.customer), stripe_subscription_id: sub.id, status: sub.status,
      promo_id: PROMO, quantity, monthly_cents: quantity * PRICE, updated_at: stamp() }, { merge: true })
    tx.create(db.collection('directory_audit_log').doc(), { action: 'synced_property_portfolio_billing', company_id: company,
      stripe_event_id: event.id, subscription_id: sub.id, paid: enabled, quantity, created_at: stamp() })
  })
  return true
}
