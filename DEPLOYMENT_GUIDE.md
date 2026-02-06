# CityBeat Magazine - Deployment Guide
## Ads Portal to Vercel + Hostgator DNS Setup

### Quick Summary
- **What I've Done:** Created all configuration files and code
- **What You Must Do Manually:** Hostgator DNS, Vercel login, environment variables
- **Time to Complete:** 30-60 minutes

---

## PART 1: What I Can Do (Already Done ✅)

### Files Created:
- ✅ `apps/ads/vercel.json` - Vercel configuration
- ✅ `apps/ads/.env.example` - Environment variable template
- ✅ Campaign pages (newsletter, sponsored, banners)
- ✅ Campaign detail & analytics pages
- ✅ Order history page
- ✅ Success/confirmation page
- ✅ Stripe checkout API
- ✅ Campaign/order management APIs
- ✅ Security headers configuration
- ✅ GitHub Actions CI/CD workflow

---

## PART 2: What You Must Do (Manual Steps)

### Step 1: Prepare Your Vercel Account (5 mins)
**What to do in Vercel Dashboard:**

1. Go to https://vercel.com
2. Log in with your GitHub account
3. Click "Add New" → "Project"
4. Import the repository: `CityBeat_Mag`
5. Select `apps/ads` as the root directory
6. Click "Deploy"

**Save these values from Vercel:**
- Project ID
- Vercel ORG ID (from settings)
- Vercel API Token (from account settings → tokens)

---

### Step 2: Set Up GitHub Secrets (5 mins)
**Why:** So Vercel can deploy automatically from GitHub

**Go to:** GitHub → Your Repo → Settings → Secrets and variables → Actions

**Add these secrets:**
```
VERCEL_TOKEN=<your_vercel_api_token>
VERCEL_ORG_ID=<your_vercel_org_id>
VERCEL_PROJECT_ID_ADS=<your_ads_project_id>
```

This allows the GitHub Actions workflow to auto-deploy when you push code.

---

### Step 3: Gather All API Keys & Credentials (10 mins)

You need to collect these from their respective dashboards:

#### From Stripe Dashboard (https://dashboard.stripe.com)
- [ ] **Live Mode** (switch toggle to "Live")
- [ ] `STRIPE_SECRET_KEY` - Settings → API Keys → Secret Key
- [ ] `STRIPE_WEBHOOK_SECRET` - Webhooks → Select endpoint → Signing secret
- [ ] `NEXT_PUBLIC_STRIPE_PUBLIC_KEY` - Settings → API Keys → Publishable Key

#### From Supabase (https://app.supabase.com)
- [ ] Select your production project
- [ ] Go to Settings → API
- [ ] `NEXT_PUBLIC_SUPABASE_URL` - Project URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anon public key

#### From Sentry (https://sentry.io)
- [ ] Create new project for Ads portal
- [ ] `NEXT_PUBLIC_SENTRY_DSN` - Project → Settings → Client Keys (DSN)
- [ ] `SENTRY_DSN` - Same as above
- [ ] `SENTRY_AUTH_TOKEN` - Organization → Settings → Auth Tokens

#### From Resend (https://resend.com)
- [ ] `RESEND_API_KEY` - API Keys → Copy key

---

### Step 4: Set Environment Variables in Vercel (10 mins)
**Go to:** Vercel Dashboard → Your Project (citybeat-ads) → Settings → Environment Variables

**Add each secret:**
```
NEXT_PUBLIC_SUPABASE_URL = https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIs...
NEXT_PUBLIC_STRIPE_PUBLIC_KEY = pk_live_abc123...
STRIPE_SECRET_KEY = sk_live_xyz789...
STRIPE_WEBHOOK_SECRET = whsec_test_abc123...
NEXT_PUBLIC_SENTRY_DSN = https://abc123@sentry.io/123456
SENTRY_DSN = https://abc123@sentry.io/123456
SENTRY_AUTH_TOKEN = sntrys_token_abc123...
RESEND_API_KEY = re_abc123xyz...
NEXT_PUBLIC_APP_URL = https://ads.citybeatmag.co
NEXT_PUBLIC_API_URL = https://api.citybeatmag.co
```

**Important:** Set these for both Production and Preview environments.

---

### Step 5: Update Stripe Webhook Endpoint (5 mins)
**Go to:** Stripe Dashboard → Developers → Webhooks → Add endpoint

**Configure webhook:**
- **Endpoint URL:** `https://api.citybeatmag.co/webhooks/stripe`
- **Events to send:**
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `charge.refunded`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`

**Get webhook secret:**
- Click the endpoint
- Copy "Signing secret"
- Add to Vercel env vars as `STRIPE_WEBHOOK_SECRET`

---

### Step 6: Configure Hostgator DNS (⚠️ CRITICAL STEP - 15 mins)
**Go to:** Hostgator → Your Domain → DNS Management

You need to create DNS records pointing to Vercel:

#### A. Create CNAME Record for Subdomain
**Record 1:**
```
Name:     ads
Type:     CNAME
Value:    cname.vercel-dns.com
TTL:      3600
```

**Record 2 (if using www subdomain):**
```
Name:     ads.www (or www.ads)
Type:     CNAME
Value:    cname.vercel-dns.com
TTL:      3600
```

#### B. (OPTIONAL) A Record for Root Domain
If you want `citybeatmag.co` (without subdomain) to point to ads:
```
Name:     @
Type:     A
Value:    76.76.19.89  (Vercel IP - get current from Vercel docs)
TTL:      3600
```

#### C. Add Domain to Vercel
**In Vercel Dashboard:**
1. Project Settings → Domains
2. Add Custom Domain: `ads.citybeatmag.co`
3. Click "Add"
4. Select "Using DNS" (since you control DNS at Hostgator)
5. Vercel will show required CNAME values
6. Copy those exact values into Hostgator

---

### Step 7: Verify DNS Configuration (5 mins)
**Wait 5-30 minutes for DNS propagation, then test:**

In terminal:
```bash
nslookup ads.citybeatmag.co
# Should return Vercel IP addresses

ping ads.citybeatmag.co
# Should respond with Vercel servers

curl -I https://ads.citybeatmag.co
# Should return 200 or 308 (redirect)
```

Or use online tools:
- https://www.nslookup.io - DNS lookup
- https://mxtoolbox.com - DNS verification
- https://www.whatsmydns.net - Propagation checker

---

### Step 8: Update Supabase Webhook (5 mins)
**Go to:** Supabase Dashboard → Database → Webhooks

Create webhook for ad_purchases table:
```
Name: stripe-webhook
Table: ad_purchases
Events: INSERT, UPDATE
HTTP Method: POST
URL: https://api.citybeatmag.co/webhooks/supabase
```

---

### Step 9: Test the Deployment (10 mins)

**Visit these URLs:**
```
https://ads.citybeatmag.co/en/campaigns
https://ads.citybeatmag.co/en/newsletter
https://ads.citybeatmag.co/en/sponsored
https://ads.citybeatmag.co/en/banners
https://ads.citybeatmag.co/en/orders
```

**You should see:**
- ✅ Campaign list page with mock data
- ✅ Campaign creation forms loading
- ✅ Order history page
- ✅ No 404 errors
- ✅ HTTPS with green padlock

**Check browser console:**
- ✅ No JavaScript errors
- ✅ No CORS errors
- ✅ No missing environment variables

---

### Step 10: Monitor Initial Deployment (5 mins)

**In Vercel Dashboard:**
- Go to Deployments
- Click latest deployment
- Check build logs for errors
- Monitor for deployment issues

**In Sentry:**
- Go to your project
- Check for any initial errors
- Set up alerts if needed

---

## PART 3: Troubleshooting Checklist

### Issue: "Domain not found" or 404
**Solutions:**
- [ ] Wait 30 minutes for DNS propagation
- [ ] Clear your DNS cache: `ipconfig /flushdns` (Windows)
- [ ] Verify CNAME record in Hostgator DNS settings
- [ ] Check Vercel domain verification (green checkmark in settings)

### Issue: "Stripe configuration missing"
**Solutions:**
- [ ] Verify env vars in Vercel settings
- [ ] Redeploy: Vercel → Deployments → Click "..." → "Redeploy"
- [ ] Check environment is set to "Production"

### Issue: "Cannot load page" or blank page
**Solutions:**
- [ ] Check browser console for errors (F12)
- [ ] Verify all environment variables are set
- [ ] Check Vercel build logs for compilation errors
- [ ] Try incognito/private window to clear cache

### Issue: "Mixed content" warning
**Solutions:**
- [ ] Ensure all URLs use HTTPS
- [ ] Check `NEXT_PUBLIC_APP_URL` is `https://`
- [ ] Check `NEXT_PUBLIC_API_URL` is `https://`

### Issue: Stripe checkout not working
**Solutions:**
- [ ] Verify `STRIPE_SECRET_KEY` is in "Live" mode (starts with `sk_live_`)
- [ ] Check webhook secret in Vercel env vars
- [ ] Verify webhook endpoint URL in Stripe dashboard
- [ ] Check Stripe logs for API errors

---

## PART 4: Post-Deployment Verification

### Security Checks ✅
- [ ] HTTPS is working (green padlock)
- [ ] Security headers present: `curl -I https://ads.citybeatmag.co`
- [ ] No sensitive data in logs
- [ ] API keys not exposed in client code

### Functionality Tests ✅
- [ ] Campaign list loads
- [ ] Can see campaign detail page
- [ ] Can access campaign creation forms
- [ ] Can view order history
- [ ] Analytics calculations work
- [ ] Forms validate correctly
- [ ] Error messages display properly

### Performance Tests ✅
- [ ] Page loads in < 3 seconds
- [ ] No console errors
- [ ] Images load properly
- [ ] API calls respond < 1 second

### Integration Tests ✅
- [ ] Stripe checkout button redirects correctly
- [ ] Success page shows after mock payment
- [ ] Campaign actions (pause/resume) ready for backend
- [ ] Email notifications ready to test

---

## PART 5: What To Do Next

### Immediate (Today)
1. Complete all steps above
2. Verify domain is accessible
3. Test all pages load correctly
4. Check Sentry for any errors

### This Week
1. Test Stripe integration (use test cards)
2. Configure email templates
3. Set up monitoring alerts
4. Create backup of environment variables

### Next Week
1. Load test with realistic traffic
2. Create incident response runbook
3. Set up auto-scaling
4. Configure CDN caching

---

## Important Files Reference

| File | Purpose | Location |
|------|---------|----------|
| vercel.json | Vercel deployment config | apps/ads/ |
| .env.example | Environment variables template | apps/ads/ |
| next.config.js | Next.js configuration | apps/ads/ |
| middleware.ts | Auth & routing middleware | apps/web/ |
| .github/workflows/ | GitHub Actions CI/CD | .github/workflows/ |

---

## Support & Documentation

**If deployment fails:**
1. Check Vercel build logs: Vercel → Deployments → Click build
2. Check GitHub Actions: GitHub → Actions → View workflow logs
3. Check Sentry: https://sentry.io/organizations/citybeat

**Key URLs:**
- Vercel Dashboard: https://vercel.com/dashboard
- Hostgator Control Panel: https://www.hostgator.com/account/
- Stripe Dashboard: https://dashboard.stripe.com
- Supabase Dashboard: https://app.supabase.com
- Sentry Dashboard: https://sentry.io

**Documentation:**
- Vercel Docs: https://vercel.com/docs
- Next.js Docs: https://nextjs.org/docs
- Stripe Docs: https://stripe.com/docs
- Hostgator Help: https://support.hostgator.com

---

## Deployment Timeline

**What I've Prepared:** All code & configuration (~2 hours of work)
**What You Must Do Manually:**
- Vercel setup: 5 mins
- Environment variables: 15 mins
- Hostgator DNS: 15 mins
- GitHub secrets: 5 mins
- Testing: 10 mins

**Total Manual Time: ~45-60 minutes**

**After deployment:**
- DNS propagation: 5-30 minutes (automatic)
- First deployment: 2-5 minutes

---

## Critical Reminders ⚠️

1. **NEVER commit `.env` files** - Use `.env.example` as template
2. **Keep secrets secure** - Don't share API keys or tokens
3. **Use production mode** in Stripe before going live
4. **Enable 2FA** on Vercel, Hostgator, and Stripe
5. **Backup credentials** - Store in password manager
6. **Monitor costs** - Set up billing alerts in Vercel & Stripe
7. **Test thoroughly** - Use test cards before real transactions

---

Generated: 2026-02-05
Status: Ready for deployment
