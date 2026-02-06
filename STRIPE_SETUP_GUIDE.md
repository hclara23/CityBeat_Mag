# Stripe Integration Setup Guide

## Overview

CityBeat's advertising platform uses Stripe to handle payments for three types of ads:
- **Newsletter Sponsorships** - Monthly, quarterly, or annual subscriptions
- **Sponsored Posts** - Per-post or monthly billing
- **Category Banners** - Monthly, quarterly, or annual subscriptions

This guide covers Stripe account setup, product configuration, webhook configuration, and testing.

## 1. Stripe Account Setup

### Create a Stripe Account

1. Go to https://stripe.com
2. Click "Start now" to create an account
3. Fill in your business information
4. Verify your email address
5. Complete identity verification
6. Activate your Stripe account

### Access Your API Keys

1. Log in to your Stripe Dashboard: https://dashboard.stripe.com
2. Navigate to **Developers** → **API Keys** (left sidebar)
3. You'll see two sets of keys:
   - **Publishable Key** (starts with `pk_`)
   - **Secret Key** (starts with `sk_`)

Keep these keys secure! Never commit them to version control.

## 2. Environment Configuration

### Development Setup

Create `.env.local` in `apps/ads`:

```env
# Public (visible in browser)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here

# Secret (server-side only)
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_test_your_webhook_secret_here
```

Create `.env.local` in `services/worker`:

```env
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_test_your_webhook_secret_here
```

### Production Setup

Using Cloudflare Wrangler secrets:

```bash
# From services/worker directory

# Set Stripe secret key
wrangler secret put STRIPE_SECRET_KEY --env production
# Paste: sk_live_your_secret_key_here

# Set webhook secret
wrangler secret put STRIPE_WEBHOOK_SECRET --env production
# Paste: whsec_live_your_webhook_secret_here
```

In `wrangler.toml`:
```toml
[env.production.secrets]
STRIPE_SECRET_KEY = ""  # Set via wrangler secret put
STRIPE_WEBHOOK_SECRET = ""  # Set via wrangler secret put
```

For the Next.js ads portal, use Vercel environment variables:

```bash
# From Vercel dashboard or CLI
vercel env add STRIPE_SECRET_KEY
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
vercel env add STRIPE_WEBHOOK_SECRET
```

## 3. Product Configuration

### Option A: Dynamic Pricing (Current Implementation)

The current system creates prices on-the-fly during checkout without pre-creating Stripe products. This approach:
- ✅ Works for immediate deployment
- ✅ Flexible pricing without Stripe product updates
- ❌ Less historical data in Stripe dashboard
- ❌ Harder to track product performance

**No action needed** - the system works as-is.

### Option B: Pre-configured Products (Recommended for Production)

For better tracking and dashboard visibility, create products and prices in Stripe:

#### Newsletter Sponsorship Product

1. Go to **Products** in Stripe Dashboard
2. Click **Add product**
3. **Product Name:** `Newsletter Sponsorship`
4. **Type:** Service (one-time) or Recurring
5. Under **Pricing**, create prices:
   - **Monthly:** $50/month (recurring, billing period: monthly)
   - **Quarterly:** $135/quarter (recurring, billing period: 3 months)
   - **Annual:** $500/year (recurring, billing period: yearly)
6. Click **Save**
7. Note the **Product ID** (e.g., `prod_xxxxx`)

#### Sponsored Post Product

1. Click **Add product**
2. **Product Name:** `Sponsored Post`
3. **Type:** Service (one-time)
4. Under **Pricing**, create prices:
   - **Per Post:** $30 (one-time)
   - **Monthly:** $100/month (recurring, billing period: monthly)
5. Save and note Product ID

#### Category Banner Product

1. Click **Add product**
2. **Product Name:** `Category Banner`
3. **Type:** Service
4. Create prices:
   - **Monthly:** $25/month (recurring)
   - **Quarterly:** $65/quarter (recurring, 3 months)
   - **Annual:** $250/year (recurring)
5. Save and note Product ID

### Using Pre-configured Products

Update `apps/ads/src/app/api/checkout/route.ts` to use product IDs:

```typescript
// Map ad types to Stripe price IDs
const priceIds: Record<string, Record<string, string>> = {
  newsletter: {
    monthly: 'price_xxxxx',    // Replace with actual price ID
    quarterly: 'price_xxxxx',
    annual: 'price_xxxxx',
  },
  sponsored: {
    'per-post': 'price_xxxxx',
    monthly: 'price_xxxxx',
  },
  banner: {
    monthly: 'price_xxxxx',
    quarterly: 'price_xxxxx',
    annual: 'price_xxxxx',
  },
}

// Use in checkout session
const session = await stripe.checkout.sessions.create({
  line_items: [
    {
      price: priceIds[body.adType][billingCycle],
      quantity: 1,
    },
  ],
  // ... rest of configuration
})
```

## 4. Payment Methods Configuration

CityBeat currently accepts **credit card payments only**.

### Configured Payment Methods
- ✅ Visa
- ✅ Mastercard
- ✅ American Express
- ✅ Discover
- ✅ Diners Club
- ✅ JCB

To modify payment methods:

1. Go to **Settings** → **Payment methods**
2. Toggle payment methods on/off
3. To enable ACH (bank transfers): Enable in Payment methods section
4. To enable PayPal: Go to **Settings** → **Connected accounts**

### Current Implementation

In `apps/ads/src/app/api/checkout/route.ts`:

```typescript
const session = await stripe.checkout.sessions.create({
  payment_method_types: ['card'],  // Only card payments
  // ... configuration
})
```

To add other payment methods:

```typescript
const session = await stripe.checkout.sessions.create({
  payment_method_types: ['card', 'us_bank_account'],  // Add bank transfers
  // ... configuration
})
```

## 5. Webhook Configuration

### Webhook Events Handled

The system processes these Stripe events:
- `checkout.session.completed` - Payment successful
- `charge.refunded` - Refund issued
- `invoice.payment_succeeded` - Subscription payment successful

### Set Up Webhook Endpoint

**Webhook URL:** `https://api.citybeatmag.co/webhooks/stripe`

#### In Stripe Dashboard:

1. Go to **Developers** → **Webhooks** (left sidebar)
2. Click **Add endpoint**
3. **URL:** `https://api.citybeatmag.co/webhooks/stripe`
4. **Version:** Use default API version
5. **Events to send:**
   - `checkout.session.completed`
   - `charge.refunded`
   - `invoice.payment_succeeded`
6. Click **Add endpoint**
7. You'll see a **Signing secret** - this is your `STRIPE_WEBHOOK_SECRET`
8. Click the webhook to reveal the signing secret
9. Click "Reveal" and copy the secret (starts with `whsec_`)

#### Testing Webhook Locally

Use Stripe CLI to forward webhooks to your local development environment:

```bash
# Install Stripe CLI
# macOS: brew install stripe/stripe-cli/stripe
# Linux: curl -s https://packages.stripe.dev/stripe.gpg | sudo apt-key add -
# Windows: Download from https://stripe.com/docs/stripe-cli

# Log in to your Stripe account
stripe login

# Forward webhooks to local development
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Run your development server in another terminal
npm run dev
```

This will show webhook events as they occur:
```
Ready! Your webhook signing secret is whsec_test_xxxx [...]
```

### Webhook Handler Implementation

**File:** `services/worker/src/handlers/stripe.ts`

```typescript
export async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  // Verify webhook signature
  const isValid = await verifyStripeSignature(
    body,
    signature!,
    env.STRIPE_WEBHOOK_SECRET
  )

  if (!isValid) {
    return new Response('Signature invalid', { status: 401 })
  }

  const event = JSON.parse(body)

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object, env)
      break

    case 'charge.refunded':
      await handleChargeRefunded(event.data.object, env)
      break

    case 'invoice.payment_succeeded':
      await handleInvoicePaymentSucceeded(event.data.object, env)
      break
  }

  return new Response(JSON.stringify({ received: true }))
}
```

## 6. Checkout Flow

### User Journey

```
1. Advertiser visits ads.citybeatmag.co
   ↓
2. Selects ad type (Newsletter, Sponsored, Banner)
   ↓
3. Chooses billing cycle (Monthly, Quarterly, Annual, Per-post)
   ↓
4. Fills checkout form:
   - Email address
   - Company name
   - Contact name
   - Phone number
   - Website (optional)
   ↓
5. Clicks "Continue to Payment"
   ↓
6. Client sends POST to /api/checkout with:
   - adType, billingCycle, email, companyName, contactName, phone, website
   ↓
7. Server creates Stripe checkout session
   ↓
8. Redirects to Stripe Checkout page (stripe.com)
   ↓
9. Advertiser completes payment
   ↓
10. Stripe confirms payment
   ↓
11. Redirect to success page with session_id
   ↓
12. Webhook: checkout.session.completed event
   ↓
13. Server saves to Supabase, sends confirmation email
```

### API Endpoint: POST /api/checkout

**Request:**
```json
{
  "adType": "newsletter|sponsored|banner",
  "billingCycle": "monthly|quarterly|annual|per-post",
  "email": "advertiser@company.com",
  "companyName": "Company Inc",
  "contactName": "John Doe",
  "phone": "+15551234567",
  "website": "https://company.com"  // optional
}
```

**Response:**
```json
{
  "sessionId": "cs_test_xxxxx",
  "url": "https://checkout.stripe.com/pay/cs_test_xxxxx"
}
```

**Error Response:**
```json
{
  "error": "Missing required fields|Invalid ad type|Invalid billing cycle"
}
```

### API Endpoint: GET /api/session

Retrieve checkout session details:

```typescript
// GET /api/session?session_id=cs_test_xxxxx
// Response: { session: { ...session details } }
```

## 7. Testing

### Test Cards

Use these card numbers in test mode:

| Card | Number | Expiry | CVC |
|------|--------|--------|-----|
| Visa | 4242 4242 4242 4242 | Any future date | Any 3 digits |
| Mastercard | 5555 5555 5555 4444 | Any future date | Any 3 digits |
| AmEx | 3782 822463 10005 | Any future date | Any 4 digits |
| Declined | 4000 0000 0000 0002 | Any future date | Any 3 digits |

### Test Payment Flow

1. **Start Development:**
   ```bash
   cd apps/ads
   npm run dev
   ```

2. **Visit Checkout:**
   - Go to http://localhost:3000/en/newsletter
   - Click "Purchase"

3. **Fill Form:**
   - Email: test@example.com
   - Company: Test Company
   - Contact: John Doe
   - Phone: +15551234567

4. **Complete Payment:**
   - Use test card: 4242 4242 4242 4242
   - Any future expiry
   - Any 3-digit CVC
   - Any ZIP code

5. **Verify Success:**
   - Should redirect to success page
   - Check Stripe Dashboard for payment
   - Check Supabase `ad_purchases` table
   - Check email to test@example.com

### Test Webhook Locally

```bash
# Terminal 1: Start webhook listener
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Terminal 2: Start development server
npm run dev

# Terminal 3: Trigger test event
stripe trigger checkout.session.completed
```

### Test in Production

1. Deploy to Vercel/Cloudflare
2. Create real test payment with actual card (in Stripe test mode)
3. Check live dashboard for payment
4. Verify webhook in Stripe Dashboard → Webhooks → Click endpoint
5. Check "Recent deliveries" tab

## 8. Monitoring and Maintenance

### Stripe Dashboard Monitoring

Check these regularly:

1. **Payments Dashboard:**
   - Recent transactions
   - Payment success rate
   - Revenue by product
   - Refund rates

2. **Customers:**
   - Customer list
   - Subscription status
   - Payment history

3. **Webhooks:**
   - Webhook deliveries
   - Failed events (retry)
   - Signature verification

### Common Issues and Solutions

**Issue: "Invalid API key"**
- Verify you're using the correct key type (test vs live)
- Ensure key is not expired
- Check wrangler secret configuration

**Issue: "Webhook signature invalid"**
- Verify webhook secret matches Stripe Dashboard
- Check webhook URL is correct
- Ensure body is not modified

**Issue: "Payment method type not supported"**
- Ensure payment method is enabled in Payment methods settings
- Check `payment_method_types` array in checkout creation

**Issue: Webhook events not triggering**
- Verify webhook URL is publicly accessible
- Check Stripe Dashboard webhook deliveries for errors
- Use Stripe CLI to test locally: `stripe trigger checkout.session.completed`

## 9. Best Practices

### Security
- ✅ Always use HTTPS for webhook endpoint
- ✅ Verify webhook signatures on every event
- ✅ Store API keys in environment variables, never in code
- ✅ Use different keys for test and production
- ✅ Rotate API keys periodically

### Billing
- ✅ Monitor API usage in Stripe Dashboard
- ✅ Set up billing alerts
- ✅ Review pricing periodically
- ✅ Consider volume discounts for high-volume merchants

### User Experience
- ✅ Provide clear pricing information
- ✅ Show billing cycle in checkout
- ✅ Send confirmation emails
- ✅ Offer easy refund/cancellation process
- ✅ Support multiple payment methods (cards at minimum)

### Compliance
- ✅ PCI DSS: Let Stripe handle card processing (never store raw card data)
- ✅ Privacy: Clearly state data collection purposes
- ✅ Tax: Collect tax ID if required in your jurisdiction
- ✅ Terms: Display Stripe's terms in checkout

## 10. Migration from Test to Production

### Step-by-Step Checklist

- [ ] Upgrade Stripe account to live mode
- [ ] Get live API keys (pk_live_, sk_live_)
- [ ] Create live products (optional, if using pre-configured products)
- [ ] Set up production webhook endpoint
- [ ] Get live webhook signing secret
- [ ] Update environment variables:
  - `STRIPE_SECRET_KEY` (live key)
  - `STRIPE_WEBHOOK_SECRET` (live signing secret)
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (live key)
- [ ] Deploy to production
- [ ] Test with real payment (small amount)
- [ ] Monitor Stripe Dashboard for live transactions
- [ ] Verify webhook deliveries
- [ ] Disable test mode

### Test Transaction

Before going fully live:
1. Process a small real payment ($1-5)
2. Verify in Stripe Dashboard
3. Verify database entry in Supabase
4. Verify confirmation email sent
5. Test webhook delivery in webhook endpoint logs

## Support Resources

- **Stripe Documentation:** https://stripe.com/docs
- **Stripe API Reference:** https://stripe.com/docs/api
- **Stripe Testing:** https://stripe.com/docs/testing
- **GitHub Issues:** https://github.com/[org]/citybeat-mag/issues
- **Stripe Support:** https://support.stripe.com

## Changelog

### Version 1.0 (Current)
- ✅ Stripe account setup guide
- ✅ Dynamic price checkout implementation
- ✅ Webhook handling for payment completion
- ✅ Email notifications on payment
- ✅ Supabase payment recording
- ✅ Test card support

### Future Enhancements
- [ ] Pre-configured products and prices in Stripe
- [ ] Subscription management portal
- [ ] Multiple currency support
- [ ] Invoice generation and email
- [ ] Refund processing with email notification
- [ ] Analytics dashboard with payment metrics
- [ ] Installment/payment plan support
