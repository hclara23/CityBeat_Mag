# Phase 1: Foundation & External Services Setup Guide

**Goal:** Establish production infrastructure and configure all external services
**Duration:** 3-5 days
**Status:** Begin immediately after plan approval

This guide walks you through setting up all external services needed for production deployment.

---

## Checklist Overview

- [ ] Sanity production project created
- [ ] Supabase production project created
- [ ] Database schema migrations run
- [ ] Stripe switched to live mode with products configured
- [ ] Resend email service set up
- [ ] DeepL translation service configured
- [ ] NewsAPI key obtained
- [ ] Cloudflare DNS configured
- [ ] SSL/TLS certificates verified
- [ ] All environment variables documented

---

## 1. Sanity CMS Production Setup

**Time:** 15-30 minutes

### 1.1 Create Production Project

1. Go to [Sanity.io Dashboard](https://manage.sanity.io/)
2. Click "Create new project"
3. Project name: `CityBeat Magazine (Production)`
4. Create project on your plan (Team or higher recommended for production)
5. Select region (default is fine)

### 1.2 Create Production Dataset

1. Go to project settings
2. Click "Datasets"
3. Click "Create dataset"
4. Name: `production`
5. Set to "Private" (only accessible with API key)

### 1.3 Generate API Tokens

1. Go to project settings → API
2. Create token 1 - "Web App Read":
   - Name: `web-app-read`
   - Permissions: Read only
   - Copy token → save as `SANITY_API_TOKEN`

3. Create token 2 - "Worker Write":
   - Name: `worker-write`
   - Permissions: Read, Write
   - Copy token → save as `SANITY_WRITE_TOKEN`

### 1.4 Configure CORS

1. Go to project settings → API
2. Click "CORS origins"
3. Add these origins:
   - `https://citybeatmag.co`
   - `https://www.citybeatmag.co`
   - `https://ads.citybeatmag.co`
   - `https://studio.citybeatmag.co`
4. Save

### 1.5 Deploy Schemas

```bash
cd C:\dev\CityBeat_Mag\sanity

# Login if not already
sanity login

# Deploy studio to production URL
sanity deploy
# Follow prompts, choose: citybeat.sanity.studio

# Export/backup the schemas for this project
sanity dataset export production backup-initial.tar.gz
```

### 1.6 Save Credentials

```
NEXT_PUBLIC_SANITY_PROJECT_ID = [Your Project ID - find in API section]
NEXT_PUBLIC_SANITY_DATASET = production
SANITY_API_TOKEN = [Token from step 1.3]
SANITY_WRITE_TOKEN = [Token from step 1.3]
```

**Verification:**
- Visit `studio.citybeatmag.io` (or temporary.sanity.studio URL)
- You should see the Sanity Studio interface
- No briefs yet (will be created by automation)

---

## 2. Supabase Production Setup

**Time:** 30-45 minutes

### 2.1 Create Production Project

1. Go to [Supabase.com](https://app.supabase.com/)
2. Click "New project"
3. Project name: `CityBeat Magazine (Production)`
4. Database password: Generate strong password, save securely
5. Region: US East 1 (recommended for North America)
6. Pricing plan: Pro ($25/month)
7. Create project (wait 2-3 minutes for provisioning)

### 2.2 Run Database Migrations

1. Go to project → SQL Editor
2. Click "New query"
3. Copy entire contents of `C:\dev\CityBeat_Mag\packages\lib\src\supabase\schema.sql`
4. Paste into SQL Editor
5. Click "Run"
6. Verify: No errors in console, tables created successfully

**Verify tables created:**
```
SELECT * FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Should see: profiles, campaigns, analytics, impressions, clicks, conversions, subscriptions, payments, **ad_purchases**, brief_submissions

### 2.3 Create Authentication Settings

1. Go to Authentication → Providers
2. Enable "Email" provider (already enabled)
3. Configure email verification:
   - Go to Authentication → Email Templates
   - Keep defaults for now (will update when Resend is configured)

### 2.4 Configure Automated Backups

1. Go to project settings → Database
2. Backups section:
   - Automated backups: Enabled
   - Backup frequency: Daily
   - Retention period: 7 days
3. Manual backup (optional but recommended):
   - Click "Backup database"
   - Download backup file to local storage

### 2.5 Set Up Connection Pooling

1. Go to project settings → Database
2. Connection pooling:
   - Mode: Transaction
   - Connections: 15
   - Max client connections: 100
3. Note the connection string with pooling enabled

### 2.6 Save Credentials

```
SUPABASE_URL = https://[project-name].supabase.co
NEXT_PUBLIC_SUPABASE_URL = https://[project-name].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = [anon public key from API section]
SUPABASE_SERVICE_ROLE_KEY = [service_role key from API section]
```

Find these in: Project Settings → API → Keys and URLs section

**Verification:**
```bash
# Test connection from command line
psql "postgresql://[username]:[password]@[host]/postgres"
```

If you can connect, database is ready for data.

---

## 3. Stripe Production Setup

**Time:** 45-60 minutes

### 3.1 Switch to Live Mode

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Top right: Click mode toggle
3. Switch from "Test Mode" to "Live Mode"
4. Confirm you want to enable live mode
5. You'll see: "Live data" indicator in top left

### 3.2 Create Products and Prices

**Product 1: Newsletter Sponsorship**

1. Go to Product Catalog → Products
2. Click "Add Product"
3. Name: `Newsletter Sponsorship`
4. Description: `Advertisement in weekly newsletter`
5. Create prices:

   **Price 1: Monthly**
   - Billing period: Monthly
   - Amount: $50.00
   - Currency: USD
   - Save (copy Price ID: `price_xxxxx`)

   **Price 2: Quarterly**
   - Billing period: Quarterly
   - Amount: $135.00
   - Save (copy Price ID)

   **Price 3: Annual**
   - Billing period: Quarterly
   - Amount: $500.00
   - Save (copy Price ID)

**Product 2: Sponsored Post**

1. Click "Add Product"
2. Name: `Sponsored Post`
3. Description: `Featured sponsored article`
4. Create prices:
   - Per Post: $30.00 (one-time)
   - Monthly: $100.00

**Product 3: Category Banner**

1. Click "Add Product"
2. Name: `Category Banner`
3. Description: `Banner advertisement in category page`
4. Create prices:
   - Monthly: $25.00
   - Quarterly: $65.00
   - Annual: $250.00

### 3.3 Save Price IDs

Document all price IDs you created:

```
STRIPE_PRICE_NEWSLETTER_MONTHLY = price_xxxxx
STRIPE_PRICE_NEWSLETTER_QUARTERLY = price_xxxxx
STRIPE_PRICE_NEWSLETTER_ANNUAL = price_xxxxx
STRIPE_PRICE_SPONSORED_PERPOST = price_xxxxx
STRIPE_PRICE_SPONSORED_MONTHLY = price_xxxxx
STRIPE_PRICE_BANNER_MONTHLY = price_xxxxx
STRIPE_PRICE_BANNER_QUARTERLY = price_xxxxx
STRIPE_PRICE_BANNER_ANNUAL = price_xxxxx
```

### 3.4 Configure Webhook Endpoint

1. Go to Developers → Webhooks
2. Click "Add endpoint"
3. Endpoint URL: `https://api.citybeatmag.co/webhooks/stripe`
4. API version: Latest (or at least 2023-10-16)
5. Select events to subscribe to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `charge.refunded`
6. Create endpoint

7. Go to the webhook details
8. Copy signing secret → save as `STRIPE_WEBHOOK_SECRET`

### 3.5 Get API Keys

1. Go to Developers → API Keys
2. Copy publishable key → save as `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
3. Copy secret key → save as `STRIPE_SECRET_KEY`

**IMPORTANT:** Never expose the secret key in frontend code

### 3.6 Test Webhook Delivery

1. In Webhooks section, click on your endpoint
2. Scroll to "Recent events"
3. Click "Send test webhook"
4. Confirm webhook received (will show pending until Worker is deployed)

### 3.7 Save Stripe Credentials

```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_live_xxxxx
STRIPE_SECRET_KEY = sk_live_xxxxx
STRIPE_WEBHOOK_SECRET = whsec_xxxxx
```

**Verification:**
- You can make a test purchase with real card (small amount like $1)
- Webhook endpoint shows "delivered"
- No payment errors in Stripe Dashboard

---

## 4. Resend Email Service Setup

**Time:** 15-20 minutes

### 4.1 Create Account

1. Go to [Resend.com](https://resend.com/)
2. Click "Sign up"
3. Create account with your email
4. Verify email

### 4.2 Get API Key

1. Go to [API Keys](https://resend.com/api-keys)
2. Create new API key
3. Name: `CityBeat Production`
4. Copy key → save as `RESEND_API_KEY`

### 4.3 Verify Domain

1. Go to [Domains](https://resend.com/domains)
2. Add domain: `citybeatmag.co`
3. Resend will provide DNS records to add:
   - Add TXT record for verification
   - Add CNAME records for DKIM and return-path
4. Once DNS records propagate (can take 24 hours), click "Verify"
5. Domain will show as "Verified"

### 4.4 Test Email

1. Go to [Test](https://resend.com/test)
2. Send test email to your address
3. Verify you receive the test email

### 4.5 Save Credentials

```
RESEND_API_KEY = re_xxxxx
```

**Verification:**
- Domain shows as "Verified" in Resend dashboard
- Test email arrives in inbox
- Email comes from domain address (noreply@citybeatmag.co)

---

## 5. DeepL Translation Service Setup

**Time:** 10-15 minutes

### 5.1 Create Account

1. Go to [DeepL.com](https://www.deepl.com/pro-api)
2. Click "Sign up"
3. Create account
4. Choose Pro plan ($25/month for 1M characters)

### 5.2 Get API Key

1. Go to Account Settings → API Authentication
2. Under "API key" section, copy your key
3. Save as `DEEPL_API_KEY`

### 5.3 Test API

```bash
curl -X POST https://api-free.deepl.com/v1/translate \
  -H "Authorization: DeepL-Auth-Key YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, world!",
    "source_lang": "EN",
    "target_lang": "ES"
  }'

# Should return:
# {"translations":[{"detected_source_language":"EN","text":"¡Hola, mundo!"}]}
```

### 5.4 Save Credentials

```
DEEPL_API_KEY = xxxxx
```

**Verification:**
- Test API call returns Spanish translation
- Character count visible in dashboard

---

## 6. NewsAPI Setup

**Time:** 5-10 minutes

### 6.1 Get API Key

1. Go to [NewsAPI.org](https://newsapi.org/)
2. Click "Register"
3. Create free account
4. Go to dashboard
5. Copy API key → save as `NEWS_API_KEY`

### 6.2 Understand Rate Limits

- Free plan: 500 requests per day
- Recommended keywords for CityBeat:
  - El Paso
  - Ciudad Juárez
  - border news
  - New Mexico
  - Las Cruces

### 6.3 Test API

```bash
curl "https://newsapi.org/v2/everything?q=El%20Paso&sortBy=publishedAt&language=en&pageSize=5&apiKey=YOUR_KEY"
```

Should return recent articles about El Paso.

### 6.4 Save Credentials

```
NEWS_API_KEY = xxxxx
```

**Verification:**
- API request returns articles
- Rate limit tracking visible in dashboard

---

## 7. Cloudflare DNS Configuration

**Time:** 30-45 minutes

**Important:** Complete Sanity, Supabase, and Stripe setup FIRST before configuring DNS

### 7.1 Prepare DNS Records

Gather these values:
- Sanity Studio hostname: (from sanity deploy output)
- Supabase URL: (from Supabase settings)
- Stripe webhook endpoint: https://api.citybeatmag.co/webhooks/stripe

Vercel will provide:
- CNAME target for web app: `cname.vercel-dns.com`
- CNAME target for ads app: `cname.vercel-dns.com`

### 7.2 Configure Cloudflare

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select your domain: `citybeatmag.co`
3. Go to DNS Records
4. Add/update these records:

   **Web App:**
   | Name | Type | Content | Proxy |
   |------|------|---------|-------|
   | @ | CNAME | cname.vercel-dns.com | Proxied |
   | www | CNAME | cname.vercel-dns.com | Proxied |

   **Ads Portal:**
   | Name | Type | Content | Proxy |
   |------|------|---------|-------|
   | ads | CNAME | cname.vercel-dns.com | Proxied |

   **Sanity Studio:**
   | Name | Type | Content | Proxy |
   |------|------|---------|-------|
   | studio | CNAME | sanity.cloud (or your custom) | Proxied |

   **Worker (will set up later):**
   | Name | Type | Content |
   |------|------|---------|
   | api | Cloudflare Worker Route |

### 7.3 Configure SSL/TLS

1. Go to SSL/TLS
2. Encryption mode: "Full (strict)"
3. Min TLS version: 1.2
4. TLS 1.3: Enabled
5. Automatic HTTPS rewrites: Enabled
6. Always Use HTTPS: Enabled

### 7.4 Configure Security

1. Go to Security
2. Firewall rules:
   - Block malicious bots (optional)
   - Configure rate limiting if needed
3. DDoS settings: Use defaults

### 7.5 Verify Propagation

```bash
# Test DNS propagation (wait up to 48 hours, usually 2-4 hours)
nslookup citybeatmag.co
nslookup ads.citybeatmag.co
nslookup studio.citybeatmag.co
```

All should resolve to Cloudflare IPs.

**Verification:**
```bash
curl -I https://citybeatmag.co
# Should return 404 (site not deployed yet, but HTTPS works)

curl -I https://api.citybeatmag.co
# Will fail until Worker is deployed
```

---

## 8. Compile All Environment Variables

Create a secure document with all your credentials:

```
SANITY:
  NEXT_PUBLIC_SANITY_PROJECT_ID: xxxxx
  NEXT_PUBLIC_SANITY_DATASET: production
  SANITY_API_TOKEN: xxxxx
  SANITY_WRITE_TOKEN: xxxxx

SUPABASE:
  NEXT_PUBLIC_SUPABASE_URL: https://xxxxx.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY: xxxxx
  SUPABASE_SERVICE_ROLE_KEY: xxxxx

STRIPE:
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: pk_live_xxxxx
  STRIPE_SECRET_KEY: sk_live_xxxxx
  STRIPE_WEBHOOK_SECRET: whsec_xxxxx
  [All STRIPE_PRICE_* variables]

RESEND:
  RESEND_API_KEY: re_xxxxx

DEEPL:
  DEEPL_API_KEY: xxxxx

NEWSAPI:
  NEWS_API_KEY: xxxxx

APPLICATION:
  NEXT_PUBLIC_APP_URL: https://citybeatmag.co
  NEXT_PUBLIC_ADS_URL: https://ads.citybeatmag.co
  NEXT_PUBLIC_WORKER_URL: https://api.citybeatmag.co
```

**Store in:** 1Password, LastPass, or encrypted vault
**Never:** Commit to Git

---

## 9. Verification Checklist

- [ ] Sanity studio accessible at studio.citybeatmag.io
- [ ] Can create test brief in Sanity
- [ ] Supabase database has all tables
- [ ] Can query Supabase database
- [ ] Stripe has all products and prices
- [ ] Stripe webhook endpoint registered
- [ ] Resend API key works for email
- [ ] DeepL API key translates text
- [ ] NewsAPI returns articles
- [ ] DNS records propagated
- [ ] HTTPS works for all domains
- [ ] All environment variables documented

---

## 10. Troubleshooting

### Sanity Issues

**Studio not loading:**
- Clear browser cache
- Check CORS origins in Sanity settings
- Verify API tokens have correct permissions

**API token rejected:**
- Verify token is for production dataset
- Check token hasn't expired
- Regenerate token if needed

### Supabase Issues

**Schema migration failed:**
- Check error message in SQL editor
- Try running migrations one table at a time
- Verify service role key has full permissions

**Connection pooling issues:**
- Try without pooling first (just use direct connection)
- Increase connection pool limits in settings
- Check connection string is correct

### Stripe Issues

**Webhook not delivering:**
- Check endpoint URL is correct and publicly accessible
- Verify Stripe webhook secret matches your code
- Try sending test webhook again
- Check Worker logs (after deployment)

**Price IDs not found:**
- Verify you're in Live Mode (not Test Mode)
- Check price IDs are from production, not test mode
- Confirm prices are fully created and active

### DNS Issues

**Domain not resolving:**
- Wait for DNS propagation (up to 48 hours)
- Flush local DNS cache: `ipconfig /flushdns` (Windows)
- Try from different network

**HTTPS not working:**
- Verify Cloudflare SSL/TLS mode is "Full (strict)"
- Check certificate status in Cloudflare dashboard
- Wait for certificate issuance (up to 24 hours)

---

## Next Steps

Once Phase 1 is complete:

1. **Store all credentials securely** (1Password, Vault, etc.)
2. **Document each service's status** in a shared location
3. **Set up monitoring** for each service (optional but recommended)
4. **Proceed to Phase 2:** Authentication System Implementation

**Phase 2 begins:** Building authentication with Supabase Auth

---

## Support References

- Sanity Documentation: https://www.sanity.io/docs
- Supabase Documentation: https://supabase.com/docs
- Stripe Documentation: https://stripe.com/docs
- Resend Documentation: https://resend.com/docs
- DeepL Documentation: https://www.deepl.com/docs-api
- NewsAPI Documentation: https://newsapi.org/docs

---

**Status:** Ready to proceed to Phase 2 once all services are configured and credentials are saved securely.
