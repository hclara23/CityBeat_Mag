import assert from 'node:assert/strict'
import test from 'node:test'
import {
  blocksReplacementSubscription,
  normalizeDirectoryCategory,
  normalizeSalesEmail,
  oneTimeCheckoutDefaults,
  recurringAuthorizationMessage,
  recurringCheckoutDefaults,
  recurringCustomerParams,
  recurringEmailError,
  reusableStripeCustomer,
  resolveDirectoryCategory,
  salesCheckoutKind,
} from './sales-checkout'
import {
  SALES_PRODUCT_ORDER,
  SALES_PRODUCTS,
  getSalesProduct,
  legacySalesProductId,
  resolveSalesProductRequest,
  salesProductAmount,
} from './sales-products'
import {
  buildSalesOrderRecord,
  createSalesOrderAccess,
  salesOrderAccessExpired,
  salesOrderCheckoutUrls,
  salesOrderHandoffMatches,
  salesOrderStripeMetadata,
  salesOrderTokenMatches,
} from './sales-orders'
import {
  buildSalesDirectoryListingRecord,
  directoryClaimPendingTier,
  isSalesCreatedDirectoryListing,
  salesDirectoryCheckoutIsManaged,
  salesDirectoryClaimStatus,
  salesDirectoryHandoffMatches,
  salesDirectoryListingUrl,
} from './sales-directory'
import {
  getSalesIntakeSchema,
  initialSalesIntakeValues,
  intakeCompletion,
  isAllowedIntakeImage,
  missingSalesIntakeFields,
  sanitizeSalesIntakeValues,
} from './sales-intake'
import { buildSalesFulfillmentRecord, salesFulfillmentTarget } from './sales-fulfillment'

test('sales checkout classifies only custom sales as one-time payments', () => {
  assert.equal(salesCheckoutKind('custom'), 'custom')
  assert.equal(salesCheckoutKind('directory'), 'directory')
  assert.equal(salesCheckoutKind('unknown'), 'directory')
  assert.equal(salesCheckoutKind(undefined), 'directory')
})

test('recurring checkout requires and normalizes a valid customer email', () => {
  assert.equal(normalizeSalesEmail('  Owner@Business.COM '), 'owner@business.com')
  assert.equal(recurringEmailError('directory', ''), 'Client email is required for recurring billing')
  assert.equal(
    recurringEmailError('directory', 'owner-at-business.com'),
    'Enter a valid client email for recurring billing'
  )
  assert.equal(recurringEmailError('directory', 'owner@business.com'), null)
  assert.equal(recurringEmailError('custom', ''), null)
})

test('directory categories accept canonical or custom values without unsafe whitespace', () => {
  assert.equal(normalizeDirectoryCategory('  Arts   &\nCulture  '), 'Arts & Culture')
  assert.equal(normalizeDirectoryCategory('Mobile Pet Grooming'), 'Mobile Pet Grooming')
  assert.equal(normalizeDirectoryCategory('x'.repeat(100)).length, 80)
  assert.equal(normalizeDirectoryCategory(null), '')
  assert.equal(
    resolveDirectoryCategory({
      requestedCategory: '',
      listingCategory: 'Restaurant',
    }),
    'Restaurant'
  )
  assert.equal(
    resolveDirectoryCategory({
      requestedCategory: 'Custom Fabrication',
      listingCategory: 'Home Services',
    }),
    'Custom Fabrication'
  )
})

test('sales-created directory listings are public, claimable, and bound to the creating rep', () => {
  const listing = buildSalesDirectoryListingRecord({
    businessName: 'Mesa Studio',
    category: 'Design',
    contactEmail: 'owner@example.com',
    contactPhone: '915-555-0100',
    locale: 'en',
    sellerUserId: 'rep_123',
    productId: 'directory_basic_free',
    now: new Date('2026-07-30T12:00:00.000Z'),
  })
  assert.equal(listing.tier, 'basic')
  assert.equal(listing.plan, 'basic')
  assert.equal(listing.claim_status, 'unclaimed')
  assert.equal(listing.is_published, true)
  assert.equal(listing.email, 'owner@example.com')
  assert.equal(listing.sales_created_by, 'rep_123')

  const url = salesDirectoryListingUrl({
    origin: 'https://citybeatmag.co/internal/path',
    locale: 'en',
    listingId: 'listing 123',
  })
  assert.equal(url, 'https://citybeatmag.co/en/directory/listing%20123')
  assert.equal(
    salesDirectoryHandoffMatches({
      listing,
      listingId: 'listing 123',
      sellerUserId: 'rep_123',
      listingUrl: url,
      requestOrigin: 'https://citybeatmag.co',
      locale: 'en',
    }),
    true
  )
  assert.equal(
    salesDirectoryHandoffMatches({
      listing,
      listingId: 'listing 123',
      sellerUserId: 'rep_other',
      listingUrl: url,
      requestOrigin: 'https://citybeatmag.co',
      locale: 'en',
    }),
    false
  )
  assert.equal(
    salesDirectoryHandoffMatches({
      listing,
      listingId: 'listing 123',
      sellerUserId: 'rep_123',
      listingUrl: 'https://evil.example/en/directory/listing%20123',
      requestOrigin: 'https://citybeatmag.co',
      locale: 'en',
    }),
    false
  )
  assert.equal(
    salesDirectoryClaimStatus({ soldBy: 'rep_123', listingPreexisting: false }),
    'unclaimed'
  )
  assert.equal(
    salesDirectoryClaimStatus({ soldBy: 'rep_123', listingPreexisting: true }),
    'pending_approval'
  )
  assert.equal(salesDirectoryClaimStatus({ ownerId: 'owner_123' }), 'pending_approval')
  assert.equal(isSalesCreatedDirectoryListing(listing), true)
  assert.equal(isSalesCreatedDirectoryListing({ source: 'crawler' }), false)
  assert.equal(salesDirectoryCheckoutIsManaged(listing), true)
  assert.equal(
    salesDirectoryCheckoutIsManaged({ ...listing, claim_status: 'approved' }),
    false
  )
  assert.equal(
    salesDirectoryCheckoutIsManaged({
      ...listing,
      claim_status: 'approved',
      requested_product_id: 'directory_premium_monthly',
    }),
    true
  )
  assert.equal(
    directoryClaimPendingTier({
      pending_tier: 'premium',
      stripe_subscription_id: 'sub_123',
    }),
    'premium'
  )
  assert.equal(directoryClaimPendingTier({ pending_tier: 'premium' }), 'basic')
  assert.equal(
    directoryClaimPendingTier({
      pending_tier: 'featured',
      stripe_subscription_id: 'sub_456',
    }),
    'featured'
  )
})

test('all non-terminal Stripe subscription states block replacement billing', () => {
  for (const status of ['incomplete', 'trialing', 'active', 'past_due', 'unpaid', 'paused']) {
    assert.equal(blocksReplacementSubscription(status), true, status)
  }
  assert.equal(blocksReplacementSubscription('canceled'), false)
  assert.equal(blocksReplacementSubscription('incomplete_expired'), false)
  assert.equal(blocksReplacementSubscription(undefined), true)
  assert.equal(blocksReplacementSubscription('unexpected_future_status'), true)
})

test('saved Stripe customers are reused only for the same normalized listing email', () => {
  assert.equal(
    reusableStripeCustomer({
      customerId: 'cus_ABC123',
      listingEmail: 'Owner@Business.com',
      contactEmail: 'owner@business.com',
    }),
    'cus_ABC123'
  )
  assert.equal(
    reusableStripeCustomer({
      customerId: 'cus_ABC123',
      listingEmail: 'previous@business.com',
      contactEmail: 'new@business.com',
    }),
    null
  )
  assert.equal(
    reusableStripeCustomer({
      customerId: 'not-a-stripe-customer',
      listingEmail: 'owner@business.com',
      contactEmail: 'owner@business.com',
    }),
    null
  )
})

test('recurring customer parameters prefill a matched saved card or a first-time email', () => {
  assert.deepEqual(
    recurringCustomerParams({
      customerId: 'cus_RETURNING123',
      listingEmail: 'owner@business.com',
      contactEmail: 'owner@business.com',
    }),
    {
      customer: 'cus_RETURNING123',
      customer_update: { address: 'auto', name: 'auto' },
    }
  )
  assert.deepEqual(
    recurringCustomerParams({
      customerId: 'cus_DIFFERENT123',
      listingEmail: 'old@business.com',
      contactEmail: ' NEW@BUSINESS.COM ',
    }),
    { customer_email: 'new@business.com' }
  )
})

test('recurring authorization copy states the price, cadence, and cancellation boundary', () => {
  assert.equal(
    recurringAuthorizationMessage('$19.99 / mo', 'month'),
    'By subscribing, you authorize CityBeat to charge this payment method $19.99 / mo each month until canceled.'
  )
  assert.equal(
    recurringAuthorizationMessage('$199 / yr', 'year'),
    'By subscribing, you authorize CityBeat to charge this payment method $199 / yr each year until canceled.'
  )
})

test('Stripe session defaults separate automatic renewals from one-time card charges', () => {
  assert.deepEqual(recurringCheckoutDefaults('$19.99 / mo', 'month'), {
    mode: 'subscription',
    payment_method_types: ['card'],
    payment_method_collection: 'always',
    billing_address_collection: 'auto',
    locale: 'auto',
    custom_text: {
      submit: {
        message:
          'By subscribing, you authorize CityBeat to charge this payment method $19.99 / mo each month until canceled.',
      },
    },
  })
  assert.deepEqual(oneTimeCheckoutDefaults(), {
    mode: 'payment',
    payment_method_types: ['card'],
    billing_address_collection: 'auto',
    locale: 'auto',
  })
  assert.equal('payment_method_collection' in oneTimeCheckoutDefaults(), false)
})

test('sales catalog exposes every approved product with server-owned prices', () => {
  assert.equal(SALES_PRODUCT_ORDER.length, 12)
  assert.equal(new Set(SALES_PRODUCT_ORDER).size, SALES_PRODUCT_ORDER.length)
  assert.equal(SALES_PRODUCTS.directory_basic_free.unitAmount, 0)
  assert.equal(SALES_PRODUCTS.directory_basic_free.billing, 'free')
  assert.equal(SALES_PRODUCTS.directory_founding_annual.unitAmount, 9900)
  assert.equal(SALES_PRODUCTS.directory_premium_monthly.unitAmount, 1999)
  assert.equal(SALES_PRODUCTS.ad_newsletter_sponsorship.unitAmount, 5000)
  assert.equal(SALES_PRODUCTS.ad_sponsored_story.unitAmount, 3000)
  assert.equal(SALES_PRODUCTS.ad_category_banner.unitAmount, 2500)
  assert.equal(SALES_PRODUCTS.event_featured.unitAmount, 2500)
  assert.equal(SALES_PRODUCTS.job_posting_30_day.unitAmount, 5000)
  assert.equal(getSalesProduct('made_up_product'), null)
})

test('legacy directory and custom selections map to canonical product ids', () => {
  assert.equal(legacySalesProductId('directory', 'founding_annual'), 'directory_founding_annual')
  assert.equal(legacySalesProductId('directory', 'featured_monthly'), 'directory_featured_monthly')
  assert.equal(legacySalesProductId('custom', undefined), 'custom_one_time')
  assert.equal(legacySalesProductId('unknown', 'unknown'), 'directory_premium_monthly')
  assert.equal(resolveSalesProductRequest({ productId: 'event_featured' })?.id, 'event_featured')
  assert.equal(resolveSalesProductRequest({ productId: 'made_up_product' }), null)
  assert.equal(resolveSalesProductRequest({}), null)
  assert.equal(resolveSalesProductRequest({ kind: 'directory', plan: 'premium_annual' })?.id, 'directory_premium_annual')
})

test('only custom quotes accept a bounded salesperson-entered amount', () => {
  assert.equal(salesProductAmount(SALES_PRODUCTS.directory_basic_free, 999), 0)
  assert.equal(salesProductAmount(SALES_PRODUCTS.event_featured, 999), 2500)
  assert.equal(salesProductAmount(SALES_PRODUCTS.custom_one_time, '149.95'), 14995)
  assert.equal(salesProductAmount(SALES_PRODUCTS.custom_one_time, 0), null)
  assert.equal(salesProductAmount(SALES_PRODUCTS.custom_one_time, 100001), null)
})

test('sales order access tokens are hashed, isolated, and expire', () => {
  const access = createSalesOrderAccess()
  const other = createSalesOrderAccess()
  assert.equal(access.token.length >= 40, true)
  assert.equal(access.tokenHash.includes(access.token), false)
  assert.equal(salesOrderTokenMatches(access.token, access.tokenHash), true)
  assert.equal(salesOrderTokenMatches(other.token, access.tokenHash), false)
  assert.equal(salesOrderTokenMatches(access.token, 'invalid'), false)
  assert.equal(salesOrderAccessExpired('2026-08-01T00:00:00.000Z', new Date('2026-07-21T00:00:00.000Z')), false)
  assert.equal(salesOrderAccessExpired('2026-07-20T00:00:00.000Z', new Date('2026-07-21T00:00:00.000Z')), true)
})

test('sales order snapshot and Stripe metadata preserve product and rep attribution', () => {
  const product = SALES_PRODUCTS.job_posting_30_day
  const access = createSalesOrderAccess()
  const record = buildSalesOrderRecord({
    product,
    amount: 5000,
    businessName: 'Mesa Studio',
    contactEmail: 'owner@example.com',
    locale: 'en',
    sellerUserId: 'rep_123',
    tokenHash: access.tokenHash,
    now: new Date('2026-07-21T12:00:00.000Z'),
  })
  assert.equal(record.product_id, 'job_posting_30_day')
  assert.equal(record.payment_status, 'pending')
  assert.equal(record.fulfillment_status, 'awaiting_payment')
  assert.equal(record.sold_by, 'rep_123')
  assert.equal(record.intake_expires_at, '2026-08-20T12:00:00.000Z')

  assert.deepEqual(
    salesOrderStripeMetadata({
      orderId: 'order_123',
      product,
      sellerUserId: 'rep_123',
      contactEmail: 'owner@example.com',
      businessName: 'Mesa Studio',
    }),
    {
      sales_order_id: 'order_123',
      product_id: 'job_posting_30_day',
      product_family: 'jobs',
      intake_kind: 'job',
      sold_by: 'rep_123',
      payout_user_id: 'rep_123',
      contact_email: 'owner@example.com',
      companyName: 'Mesa Studio',
    }
  )
})

test('new directory sales retain the custom category for customer intake prefill', () => {
  const product = SALES_PRODUCTS.directory_premium_monthly
  const access = createSalesOrderAccess()
  const record = buildSalesOrderRecord({
    product,
    amount: product.unitAmount!,
    businessName: 'Borderland Mobile Grooming',
    contactEmail: 'owner@example.com',
    contactPhone: '915-555-0100',
    locale: 'en',
    sellerUserId: 'rep_123',
    listingId: 'order_123',
    listingPreexisting: false,
    directoryCategory: 'Mobile Pet Grooming',
    tokenHash: access.tokenHash,
    now: new Date('2026-07-30T12:00:00.000Z'),
  })

  assert.equal(record.listing_id, 'order_123')
  assert.equal(record.listing_preexisting, false)
  assert.equal(record.directory_category, 'Mobile Pet Grooming')
  assert.deepEqual(initialSalesIntakeValues('directory', record), {
    business_name: 'Borderland Mobile Grooming',
    primary_category: 'Mobile Pet Grooming',
    phone: '915-555-0100',
  })
})

test('checkout success URL enters the order-specific fulfillment wizard', () => {
  const urls = salesOrderCheckoutUrls({
    origin: 'https://citybeatmag.co',
    locale: 'es',
    orderId: 'order 123',
    token: 'secret/value',
    billing: 'subscription',
  })
  assert.equal(
    urls.successUrl,
    'https://citybeatmag.co/es/fulfill/order%20123?access=secret%2Fvalue&session_id={CHECKOUT_SESSION_ID}'
  )
  assert.equal(
    urls.cancelUrl,
    'https://citybeatmag.co/es/checkout/result?status=cancel&billing=subscription&order_id=order%20123'
  )
})

test('payment-link handoff is bound to the active order and signed-in seller', () => {
  const order = {
    id: 'order_123',
    sold_by: 'rep_123',
    checkout_status: 'ready',
    checkout_url: 'https://checkout.stripe.com/c/pay/cs_test_123',
  }
  assert.equal(
    salesOrderHandoffMatches({
      order,
      sellerUserId: 'rep_123',
      checkoutUrl: order.checkout_url,
      orderId: 'order_123',
    }),
    true
  )
  assert.equal(salesOrderHandoffMatches({ order, sellerUserId: 'rep_other', checkoutUrl: order.checkout_url }), false)
  assert.equal(
    salesOrderHandoffMatches({ order, sellerUserId: 'rep_123', checkoutUrl: 'https://checkout.stripe.com/c/pay/other' }),
    false
  )
  assert.equal(
    salesOrderHandoffMatches({
      order: { ...order, checkout_url: 'https://evil.example/checkout' },
      sellerUserId: 'rep_123',
      checkoutUrl: 'https://evil.example/checkout',
    }),
    false
  )
  assert.equal(
    salesOrderHandoffMatches({
      order: { ...order, checkout_status: 'completed' },
      sellerUserId: 'rep_123',
      checkoutUrl: order.checkout_url,
    }),
    false
  )
  assert.equal(
    salesOrderHandoffMatches({
      order: { ...order, checkout_expires_at: '2026-07-21T10:00:00.000Z' },
      sellerUserId: 'rep_123',
      checkoutUrl: order.checkout_url,
      now: new Date('2026-07-21T10:00:00.000Z'),
    }),
    false
  )
})

test('every product intake kind has a focused multi-section schema', () => {
  for (const kind of ['directory', 'job', 'event', 'newsletter_sponsorship', 'category_banner', 'sponsored_story', 'custom']) {
    const schema = getSalesIntakeSchema(kind)
    assert.ok(schema, kind)
    assert.equal(schema.sections.length >= 2, true, kind)
    assert.equal(schema.sections.every((section) => section.fields.length > 0), true, kind)
  }
  assert.equal(getSalesIntakeSchema('unknown'), null)
})

test('intake sanitizer keeps only schema fields and rejects unsafe asset URLs', () => {
  const schema = getSalesIntakeSchema('directory')!
  assert.deepEqual(
    sanitizeSalesIntakeValues(schema, {
      business_name: '  Mesa Studio  ',
      short_description: 'x'.repeat(1300),
      website: 'javascript:alert(1)',
      logo_url: 'https://storage.example/logo.png',
      gallery_urls: ['https://storage.example/1.png', 'javascript:bad', 42],
      admin_only: 'do not keep',
    }),
    {
      business_name: 'Mesa Studio',
      short_description: 'x'.repeat(1200),
      website: '',
      logo_url: 'https://storage.example/logo.png',
      gallery_urls: ['https://storage.example/1.png'],
    }
  )
})

test('intake sanitizer rejects invalid structured values and impossible pay ranges', () => {
  const job = getSalesIntakeSchema('job')!
  const values = sanitizeSalesIntakeValues(job, {
    job_category: 'not_a_category',
    employment_type: 'full_time',
    pay_min: '-1',
    pay_max: 'not-a-number',
    application_email: 'not-an-email',
    application_deadline: '2026-02-30',
  })
  assert.deepEqual(values, {
    job_category: '',
    employment_type: 'full_time',
    pay_min: '',
    pay_max: '',
    application_email: '',
    application_deadline: '',
  })

  const reversed = sanitizeSalesIntakeValues(job, { pay_min: '75000', pay_max: '60000' })
  assert.equal(missingSalesIntakeFields(job, reversed).includes('pay_max'), true)
})

test('required intake completion advances from prefill to complete', () => {
  const schema = getSalesIntakeSchema('job')!
  const prefill = initialSalesIntakeValues('job', {
    business_name: 'Mesa Studio',
    contact_email: 'jobs@example.com',
  })
  assert.equal(prefill.company_name, 'Mesa Studio')
  assert.equal(prefill.application_email, 'jobs@example.com')
  assert.equal(missingSalesIntakeFields(schema, prefill).includes('job_title'), true)
  assert.equal(intakeCompletion(schema, prefill) < 100, true)

  const completed = { ...prefill }
  for (const section of schema.sections) {
    for (const field of section.fields) {
      if (!field.required) continue
      completed[field.id] = field.type === 'images'
        ? ['https://storage.example/image.webp']
        : field.type === 'select'
          ? field.options?.[0]?.value || ''
          : field.type === 'email'
            ? 'valid@example.com'
            : field.type === 'url' || field.type === 'image'
              ? 'https://storage.example/image.webp'
              : field.type === 'date'
                ? '2026-08-15'
                : field.type === 'time'
                  ? '12:30'
                  : field.type === 'number'
                    ? '100'
                    : 'complete'
    }
  }
  assert.deepEqual(missingSalesIntakeFields(schema, completed), [])
  assert.equal(intakeCompletion(schema, completed), 100)
})

test('customer image validation limits file type and size before upload', () => {
  assert.equal(isAllowedIntakeImage({ type: 'image/webp', size: 1024 }), null)
  assert.match(isAllowedIntakeImage({ type: 'application/pdf', size: 1024 }) || '', /Invalid image type/)
  assert.match(isAllowedIntakeImage({ type: 'image/jpeg', size: 11 * 1024 * 1024 }) || '', /too large/)
})

test('each intake kind maps to a deterministic operational destination', () => {
  const expected = {
    directory: ['directory_listings', 'listing_123'],
    job: ['jobs', 'order_123'],
    event: ['events', 'order_123'],
    category_banner: ['ad_banners', 'order_123'],
    sponsored_story: ['sponsored_stories', 'order_123'],
    newsletter_sponsorship: ['ad_campaigns', 'order_123'],
    custom: ['sales_fulfillment_briefs', 'order_123'],
  } as const
  for (const [intakeKind, [collection, id]] of Object.entries(expected)) {
    const target = salesFulfillmentTarget({
      orderId: 'order_123',
      intakeKind: intakeKind as keyof typeof expected,
      listingId: 'listing_123',
    })
    assert.equal(target.collection, collection)
    assert.equal(target.id, id)
    assert.equal(target.status, 'in_review')
  }
  assert.deepEqual(salesFulfillmentTarget({ orderId: 'order_123', intakeKind: 'directory' }), {
    collection: 'directory_listings',
    id: 'order_123',
    status: 'in_review',
  })
})

test('job fulfillment retains complete paid-intake details without publishing early', () => {
  const record = buildSalesFulfillmentRecord({
    orderId: 'order_123',
    order: {
      product_id: 'job_posting_30_day',
      intake_kind: 'job',
      payment_status: 'paid',
      sold_by: 'rep_123',
      contact_email: 'jobs@example.com',
    },
    values: {
      job_title: 'Managing Editor',
      company_name: 'Mesa Studio',
      job_category: 'professional',
      employment_type: 'full_time',
      workplace_type: 'hybrid',
      location: 'El Paso, TX',
      pay_min: '60000',
      pay_max: '75000',
      pay_period: 'year',
      benefits: 'Health and PTO',
      schedule: 'Monday-Friday',
      summary: 'Lead the newsroom.',
      responsibilities: 'Edit and publish.',
      qualifications: 'Five years experience.',
      apply_url: 'https://example.com/jobs/editor',
      application_email: 'jobs@example.com',
      application_deadline: '2026-08-15',
      company_logo_url: 'https://storage.example/logo.webp',
    },
    now: new Date('2026-07-21T12:00:00.000Z'),
  })
  assert.equal(record.status, 'pending_review')
  assert.equal(record.is_paid, true)
  assert.equal(record.is_active, false)
  assert.equal(record.pay_min, 60000)
  assert.equal(record.sales_order_id, 'order_123')
  assert.equal(record.fulfillment_status, 'in_review')
})

test('directory fulfillment enriches the paid listing without hiding its claimable page', () => {
  const record = buildSalesFulfillmentRecord({
    orderId: 'order_123',
    order: {
      product_id: 'directory_premium_monthly',
      intake_kind: 'directory',
      payment_status: 'paid',
      sold_by: 'rep_123',
      contact_email: 'owner@example.com',
      directory_plan_id: 'premium_monthly',
      stripe_subscription_id: 'sub_123',
      stripe_customer_id: 'cus_123',
      listing_preexisting: false,
    },
    values: {
      business_name: 'Mesa Studio',
      primary_category: 'Design',
      short_description: 'Local design studio',
      street_address: '100 Mesa St',
      city: 'El Paso',
      state: 'TX',
      postal_code: '79901',
      phone: '915-555-0100',
      website: 'https://example.com',
      business_hours: 'Mon-Fri 9-5',
      cover_image_url: 'https://storage.example/cover.webp',
      logo_url: 'https://storage.example/logo.webp',
      gallery_urls: ['https://storage.example/one.webp'],
      instagram_url: 'https://instagram.com/mesa',
    },
  })
  assert.equal(record.claim_status, undefined)
  assert.equal(record.is_published, undefined)
  assert.equal(record.tier, 'basic')
  assert.equal(record.pending_tier, 'premium')
  assert.equal(record.plan, 'premium_monthly')
  assert.equal(record.stripe_subscription_id, 'sub_123')
  assert.equal(record.address, '100 Mesa St, El Paso, TX, 79901')
  assert.deepEqual(record.gallery_urls, ['https://storage.example/one.webp'])
})

test('catalog cadence is explicit for every fixed and custom product', () => {
  const free = SALES_PRODUCT_ORDER.filter((id) => SALES_PRODUCTS[id].billing === 'free')
  const recurring = SALES_PRODUCT_ORDER.filter((id) => SALES_PRODUCTS[id].billing === 'subscription')
  const oneTime = SALES_PRODUCT_ORDER.filter((id) => SALES_PRODUCTS[id].billing === 'one_time')
  assert.deepEqual(free, ['directory_basic_free'])
  assert.deepEqual(recurring, [
    'directory_founding_annual',
    'directory_founding_monthly',
    'directory_premium_annual',
    'directory_premium_monthly',
    'directory_featured_monthly',
    'ad_newsletter_sponsorship',
    'ad_category_banner',
  ])
  assert.deepEqual(oneTime, ['ad_sponsored_story', 'event_featured', 'job_posting_30_day', 'custom_one_time'])
  assert.equal(recurring.every((id) => SALES_PRODUCTS[id].interval === 'month' || SALES_PRODUCTS[id].interval === 'year'), true)
  assert.equal(oneTime.every((id) => SALES_PRODUCTS[id].interval === null), true)
})

test('intake field identifiers are unique within every product brief', () => {
  for (const kind of ['directory', 'job', 'event', 'newsletter_sponsorship', 'category_banner', 'sponsored_story', 'custom']) {
    const schema = getSalesIntakeSchema(kind)!
    const ids = schema.sections.flatMap((section) => section.fields.map((field) => field.id))
    assert.equal(new Set(ids).size, ids.length, kind)
    assert.equal(ids.every((id) => /^[a-z][a-z0-9_]*$/.test(id)), true, kind)
  }
})

test('access expiration rejects the exact boundary and malformed dates', () => {
  const now = new Date('2026-07-21T12:00:00.000Z')
  assert.equal(salesOrderAccessExpired('2026-07-21T12:00:00.001Z', now), false)
  assert.equal(salesOrderAccessExpired('2026-07-21T12:00:00.000Z', now), true)
  assert.equal(salesOrderAccessExpired('not-a-date', now), true)
  assert.equal(salesOrderAccessExpired(undefined, now), true)
})

test('advertising and event fulfillment records stay inactive or pending review', () => {
  const baseOrder = {
    payment_status: 'paid',
    sold_by: 'rep_123',
    contact_email: 'owner@example.com',
    business_name: 'Mesa Studio',
  }
  const banner = buildSalesFulfillmentRecord({
    orderId: 'banner_order',
    order: { ...baseOrder, product_id: 'ad_category_banner', intake_kind: 'category_banner' },
    values: {
      campaign_name: 'Summer', requested_category: 'Dining', preferred_start_date: '2026-08-01',
      target_url: 'https://example.com', headline: 'Dinner downtown', description: 'Book tonight',
      call_to_action: 'Reserve', banner_image_url: 'https://storage.example/banner.webp', alt_text: 'Dinner table',
    },
  })
  assert.equal(banner.status, 'pending_review')
  assert.equal(banner.is_active, false)
  assert.equal(banner.placement, 'directory')

  const newsletter = buildSalesFulfillmentRecord({
    orderId: 'newsletter_order',
    order: { ...baseOrder, product_id: 'ad_newsletter_sponsorship', intake_kind: 'newsletter_sponsorship', stripe_subscription_id: 'sub_123' },
    values: {
      campaign_name: 'Summer', campaign_objective: 'traffic', preferred_start_date: '2026-08-01',
      target_url: 'https://example.com', headline: 'Visit us', body_copy: 'A short message',
      call_to_action: 'Learn more', logo_url: 'https://storage.example/logo.webp', creative_url: 'https://storage.example/creative.webp',
    },
  })
  assert.equal(newsletter.status, 'pending_review')
  assert.equal(newsletter.is_active, false)
  assert.equal(newsletter.stripe_subscription_id, 'sub_123')

  const event = buildSalesFulfillmentRecord({
    orderId: 'event_order',
    order: { ...baseOrder, product_id: 'event_featured', intake_kind: 'event' },
    values: {
      event_title: 'Art Walk', event_category: 'Arts', start_date: '2026-08-01', start_time: '18:00',
      timezone: 'America/Denver', event_format: 'in_person', venue_name: 'Downtown', venue_address: '100 Main',
      price_info: 'Free', event_description: 'A local art walk', organizer_name: 'Arts Council',
      contact_email: 'events@example.com', event_image_url: 'https://storage.example/event.webp',
    },
  })
  assert.equal(event.status, 'pending')
  assert.equal(event.featured, true)
  assert.equal(event.start_date, '2026-08-01T18:00:00')
})
