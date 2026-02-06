# Stripe Products Migration Guide

## Overview

CityBeat's Stripe integration supports two approaches for billing:

1. **Dynamic Pricing (Current)** - Prices created on-the-fly during checkout
2. **Pre-configured Products (Recommended for Production)** - Products and prices pre-created in Stripe

The checkout endpoint automatically detects which approach to use based on environment variables.

## Dynamic Pricing (Current Implementation)

**Status**: ✅ Working and deployed
**Approach**: Prices created with `price_data` during each checkout session
**Metadata**: Prices include `product_data` with name and description
**Stripe Dashboard**: Prices visible but products are created dynamically
**Historical Data**: Limited (no persistent product records)
**Setup Effort**: None - already configured
**Best For**: Rapid deployment, testing, flexible pricing

### How It Works

```typescript
// Current implementation
const lineItem = {
  price_data: {
    currency: 'usd',
    product_data: {
      name: 'Newsletter Advertisement',
      description: 'Monthly billing cycle',
    },
    unit_amount: 5000,  // $50.00
    recurring: {
      interval: 'month',
      interval_count: 1,
    },
  },
  quantity: 1,
}
```

## Pre-configured Products (Recommended for Production)

**Status**: ✅ Code support added, not yet configured
**Approach**: Products and prices created once in Stripe, referenced by ID during checkout
**Metadata**: Rich product information stored in Stripe
**Stripe Dashboard**: Full product history and analytics
**Historical Data**: Complete tracking from day one
**Setup Effort**: ~30 minutes (create products, get price IDs, update env vars)
**Best For**: Production deployments, analytics, audit trails

### How It Works

```typescript
// Pre-configured approach
const lineItem = {
  price: 'price_1O9zX4L0Z9Z9Z9Z9',  // Pre-created price ID
  quantity: 1,
}
```

## Migration Checklist

### Phase 1: Prepare in Stripe Dashboard

- [ ] Log into Stripe Dashboard: https://dashboard.stripe.com
- [ ] Navigate to **Products**

#### Create Newsletter Sponsorship Product

1. Click **Add product**
2. **Product name**: `Newsletter Sponsorship`
3. **Type**: Service
4. Under **Pricing**, add three prices:
   - **Monthly**: $50/month
     - Billing period: Monthly
     - Recurring: Yes
     - Copy Price ID (format: `price_xxxxx`)
   - **Quarterly**: $135 per 3 months
     - Billing period: Every 3 months
     - Recurring: Yes
     - Copy Price ID
   - **Annual**: $500/year
     - Billing period: Yearly
     - Recurring: Yes
     - Copy Price ID
5. Click **Save**

#### Create Sponsored Post Product

1. Click **Add product**
2. **Product name**: `Sponsored Post`
3. **Type**: Service
4. Under **Pricing**, add two prices:
   - **Per Post**: $30 (one-time)
     - Recurring: No
     - Copy Price ID
   - **Monthly**: $100/month
     - Billing period: Monthly
     - Recurring: Yes
     - Copy Price ID
5. Click **Save**

#### Create Category Banner Product

1. Click **Add product**
2. **Product name**: `Category Banner`
3. **Type**: Service
4. Under **Pricing**, add three prices:
   - **Monthly**: $25/month
     - Billing period: Monthly
     - Recurring: Yes
     - Copy Price ID
   - **Quarterly**: $65 per 3 months
     - Billing period: Every 3 months
     - Recurring: Yes
     - Copy Price ID
   - **Annual**: $250/year
     - Billing period: Yearly
     - Recurring: Yes
     - Copy Price ID
5. Click **Save**

### Phase 2: Update Environment Variables

Update `.env.local` in `apps/ads/`:

```env
# Pre-configured Stripe Price IDs
STRIPE_PRICE_NEWSLETTER_MONTHLY=price_xxxxx
STRIPE_PRICE_NEWSLETTER_QUARTERLY=price_xxxxx
STRIPE_PRICE_NEWSLETTER_ANNUAL=price_xxxxx
STRIPE_PRICE_SPONSORED_PERPOST=price_xxxxx
STRIPE_PRICE_SPONSORED_MONTHLY=price_xxxxx
STRIPE_PRICE_BANNER_MONTHLY=price_xxxxx
STRIPE_PRICE_BANNER_QUARTERLY=price_xxxxx
STRIPE_PRICE_BANNER_ANNUAL=price_xxxxx
```

### Phase 3: Deploy and Verify

1. **Test Locally**
   ```bash
   cd apps/ads
   npm run dev
   # Try creating a checkout session
   # Monitor console for which pricing method is used
   ```

2. **Deploy to Staging**
   ```bash
   # Update Vercel environment variables
   vercel env add STRIPE_PRICE_NEWSLETTER_MONTHLY
   # Repeat for all 8 price variables

   vercel deploy --prod
   ```

3. **Verify in Production**
   - Go to ads.citybeatmag.co/[locale]/newsletter
   - Try creating checkout
   - Check Stripe Dashboard → Events
   - Confirm `checkout.session.created` shows pre-configured price IDs in line_items

### Phase 4: Monitor and Optimize

1. **Check Stripe Dashboard**
   - Go to **Products** and view each product
   - Verify prices match your intended pricing
   - Check sales metrics on each product page

2. **Review Costs**
   - Pre-configured products don't change pricing
   - Stripe fees remain the same
   - This is a pure organizational improvement

3. **Update Documentation**
   - Update team docs to reference pre-configured products
   - Add product IDs to internal wiki/docs

## Fallback Behavior

The checkout endpoint automatically handles both approaches:

1. **Environment variables set** → Uses pre-configured prices
2. **Environment variables empty** → Falls back to dynamic pricing
3. **Invalid price ID** → Falls back to dynamic pricing

This means you can safely migrate without downtime:
- Existing env vars don't break anything
- New env vars activate automatically when set
- Removal of env vars falls back gracefully

## Testing the Migration

### Test Dynamic Pricing (Before Migration)

```bash
# Ensure STRIPE_PRICE_* variables are NOT set in .env
npm run dev

# Visit: http://localhost:3000/en/newsletter
# Click "Purchase"
# Fill form and click "Continue to Payment"
# Should redirect to Stripe Checkout

# Check browser console (network tab)
# POST /api/checkout request should use price_data
```

### Test Pre-configured Pricing (After Migration)

```bash
# Set STRIPE_PRICE_NEWSLETTER_MONTHLY in .env to your price ID
npm run dev

# Visit: http://localhost:3000/en/newsletter
# Click "Purchase"
# Fill form and click "Continue to Payment"
# Should redirect to Stripe Checkout

# Check browser console (network tab)
# POST /api/checkout request should use 'price' field instead of price_data
```

## Common Issues

**Issue: "Invalid price ID"**
- Solution: Verify price ID format is `price_xxxxx`
- Check that price exists in Stripe Dashboard
- Confirm it's not a product ID (format: `prod_xxxxx`)

**Issue: Checkout still uses dynamic pricing**
- Solution: Confirm env vars are set correctly
- Restart dev server after updating .env
- Check that variable name matches exactly (case-sensitive on Linux/Mac)

**Issue: Different prices in Stripe than expected**
- Solution: Verify prices in Stripe Dashboard match your pricing table
- Check that you didn't accidentally create prices in wrong currency

## Rollback Plan

If pre-configured products cause issues:

1. Remove/comment out `STRIPE_PRICE_*` environment variables
2. Redeploy application
3. Checkout automatically falls back to dynamic pricing
4. No customer-facing interruption
5. Investigate issue and try again when ready

## Benefits of Pre-configured Products

### For Operations
- 📊 **Better Analytics**: Track sales by product in Stripe Dashboard
- 📈 **Historical Data**: Complete pricing history
- 🎯 **Dashboard Insights**: Revenue by product type over time
- 🔍 **Audit Trail**: Price changes are recorded

### For Development
- 🧪 **Easier Testing**: Use same price IDs across environments
- 📋 **Cleaner Code**: Simpler checkout logic
- 🔗 **Better Integration**: Matches Stripe best practices

### For Customers
- ✅ **Better Receipts**: Product names appear clearly
- 📧 **Better Emails**: Stripe sends clearer confirmation emails
- 🛡️ **Verification**: Customers can verify pricing in Stripe Dashboard

## Next Steps

1. **When to Migrate**
   - ✅ Recommended: Immediately before production deployment
   - ✅ Safe: Anytime after confirming dynamic pricing works
   - ⏸️ Not Urgent: Can wait until after launch

2. **Who Should Do It**
   - Ops/DevOps person with Stripe Dashboard access
   - Should have write access to Vercel/deployment platform

3. **Estimated Time**
   - Create products: 10-15 minutes
   - Update env vars: 5 minutes
   - Deploy and verify: 5-10 minutes
   - **Total**: ~30 minutes

## Support

For issues or questions:
- Check STRIPE_SETUP_GUIDE.md for general Stripe configuration
- Review Stripe API docs: https://stripe.com/docs/products-and-prices
- Submit issues to GitHub issues

## Changelog

### Version 1.0 (Current)
- ✅ Code support for pre-configured products
- ✅ Migration guide
- ✅ Fallback to dynamic pricing
- ✅ Environment variable support
