# Pre-Deployment Checklist - CityBeat Ads Portal
**Date:** ____________
**Deployed By:** ____________
**Domain:** `ads.citybeatmag.co`

---

## Phase 1: Code & Configuration ✓

### Repository & Build
- [ ] All changes committed to `main` branch
- [ ] No uncommitted files: `git status` is clean
- [ ] Latest code pulled: `git pull origin main`
- [ ] Build succeeds locally: `npm run build --workspace=apps/ads`
- [ ] No TypeScript errors: `npm run type-check --workspace=apps/ads`
- [ ] Tests pass: `npm run test --workspace=apps/ads` (or skip if not implemented)
- [ ] Linting passes: `npm run lint --workspace=apps/ads`

### Configuration Files
- [ ] `apps/ads/vercel.json` exists and is properly formatted
- [ ] `apps/ads/.env.example` has all required variables
- [ ] `.env.local` created with all values filled in
- [ ] No `.env` file is committed (only `.env.example`)
- [ ] `apps/ads/next.config.js` has correct domain settings
- [ ] Security headers configured in next.config.js

### Package Dependencies
- [ ] All dependencies installed: `npm ci` (not `npm install`)
- [ ] No duplicate packages in package-lock.json
- [ ] All required packages present:
  - [ ] next
  - [ ] react
  - [ ] stripe
  - [ ] @supabase/supabase-js
  - [ ] @sentry/nextjs

---

## Phase 2: External Services Setup ✓

### Stripe Configuration
- [ ] Account switched to **Live Mode** (NOT Test Mode)
- [ ] Live Secret Key obtained: `sk_live_...`
- [ ] Live Publishable Key obtained: `pk_live_...`
- [ ] Webhook endpoint created: `https://api.citybeatmag.co/webhooks/stripe`
- [ ] Webhook secret copied: `whsec_...`
- [ ] Webhook events subscribed:
  - [ ] `checkout.session.completed`
  - [ ] `customer.subscription.created`
  - [ ] `customer.subscription.updated`
  - [ ] `customer.subscription.deleted`
  - [ ] `charge.refunded`
  - [ ] `invoice.payment_succeeded`
  - [ ] `invoice.payment_failed`
- [ ] All products created with correct pricing:
  - [ ] Newsletter: $50/mo, $135/qtr, $500/yr
  - [ ] Sponsored: $30/post, $100/mo
  - [ ] Banner: $25/mo, $65/qtr, $250/yr

### Supabase Configuration
- [ ] Production project created (not development)
- [ ] Database migrations run: `schema.sql`
- [ ] Required tables created:
  - [ ] `campaigns`
  - [ ] `ad_purchases`
  - [ ] `profiles`
  - [ ] `invoices`
- [ ] RLS (Row Level Security) policies configured
- [ ] Service role key obtained for backend
- [ ] Anon key obtained for frontend
- [ ] Connection pooling enabled
- [ ] Automated backups configured (daily, 7-day retention)
- [ ] PITR (Point-in-Time Recovery) enabled

### Sentry Configuration
- [ ] Project created for Ads portal
- [ ] DSN obtained: `https://...@sentry.io/...`
- [ ] Release tracking enabled
- [ ] Performance monitoring enabled
- [ ] Alerts configured for:
  - [ ] Error rate > 1%
  - [ ] Performance degradation
  - [ ] New issues

### Resend Configuration
- [ ] Account created and active
- [ ] Domain verified: `citybeatmag.co`
- [ ] API key obtained: `re_...`
- [ ] Email templates created:
  - [ ] Campaign confirmation
  - [ ] Payment receipt
  - [ ] Subscription started
  - [ ] Subscription cancelled

---

## Phase 3: Vercel Setup ✓

### Project Creation
- [ ] Vercel account active and verified
- [ ] Organization created (if using)
- [ ] Project imported: `CityBeat_Mag`
- [ ] Build settings:
  - [ ] Framework: Next.js
  - [ ] Root Directory: `apps/ads`
  - [ ] Build Command: `npm run build --workspace=apps/ads`
  - [ ] Output Directory: `apps/ads/.next`
- [ ] Environment: Production selected

### Environment Variables (In Vercel)
- [ ] All env vars added to Vercel dashboard:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `NEXT_PUBLIC_STRIPE_PUBLIC_KEY`
  - [ ] `STRIPE_SECRET_KEY`
  - [ ] `STRIPE_WEBHOOK_SECRET`
  - [ ] `NEXT_PUBLIC_SENTRY_DSN`
  - [ ] `SENTRY_DSN`
  - [ ] `SENTRY_AUTH_TOKEN`
  - [ ] `RESEND_API_KEY`
  - [ ] `NEXT_PUBLIC_APP_URL=https://ads.citybeatmag.co`
  - [ ] `NEXT_PUBLIC_API_URL=https://api.citybeatmag.co`
  - [ ] `ADS_REQUIRE_AUTH=true`
- [ ] Environment set to "Production" for all vars
- [ ] No secrets exposed in preview environment (optional)

### GitHub Integration
- [ ] Repository connected to Vercel
- [ ] GitHub account has admin access
- [ ] Branch set to `main`
- [ ] Auto-deploy on push: enabled

---

## Phase 4: DNS Configuration ✓

### Hostgator DNS Records
- [ ] Logged into Hostgator control panel
- [ ] DNS management accessed for domain
- [ ] CNAME record created:
  ```
  Name: ads
  Type: CNAME
  Value: cname.vercel-dns.com (or Vercel's provided value)
  TTL: 3600
  ```
- [ ] Apex domain A record configured (if needed):
  ```
  Name: @
  Type: A
  Value: 76.76.19.89 (current Vercel IP)
  TTL: 3600
  ```
- [ ] DNS propagation confirmed with nslookup:
  ```bash
  nslookup ads.citybeatmag.co
  ```

### Vercel Domain Configuration
- [ ] Custom domain added to Vercel: `ads.citybeatmag.co`
- [ ] DNS records verified in Vercel dashboard (green checkmark)
- [ ] SSL certificate auto-provisioned (green padlock)
- [ ] SSL certificate valid: https://ads.citybeatmag.co

---

## Phase 5: GitHub Secrets (CI/CD) ✓

### GitHub Repository Secrets
- [ ] Repository Settings → Secrets and variables → Actions
- [ ] Added secrets:
  - [ ] `VERCEL_TOKEN` (from Vercel account settings)
  - [ ] `VERCEL_ORG_ID` (from Vercel organization)
  - [ ] `VERCEL_PROJECT_ID_ADS` (from Vercel project)
  - [ ] `SLACK_WEBHOOK_URL` (optional, for notifications)
  - [ ] `CLOUDFLARE_API_TOKEN` (for worker deployment)
  - [ ] `CLOUDFLARE_ACCOUNT_ID` (for worker deployment)

### GitHub Actions Workflows
- [ ] `.github/workflows/test.yml` exists and is valid
- [ ] `.github/workflows/deploy-ads.yml` exists and is valid
- [ ] Workflows triggered on push to `main` branch
- [ ] Workflow logs are accessible and readable

---

## Phase 6: Security & Compliance ✓

### HTTPS & SSL
- [ ] HTTPS enforced (not HTTP)
- [ ] SSL certificate valid and not expired
- [ ] Certificate issuer is Let's Encrypt or similar trusted CA
- [ ] No mixed content warnings
- [ ] HSTS header present: `Strict-Transport-Security`

### Security Headers
- [ ] Verified with: `curl -I https://ads.citybeatmag.co`
- [ ] Headers present:
  - [ ] `X-Content-Type-Options: nosniff`
  - [ ] `X-Frame-Options: SAMEORIGIN`
  - [ ] `X-XSS-Protection: 1; mode=block`
  - [ ] `Referrer-Policy: strict-origin-when-cross-origin`
  - [ ] `Strict-Transport-Security: max-age=31536000`

### API Security
- [ ] All API endpoints use HTTPS
- [ ] CORS properly configured for trusted domains only
- [ ] Rate limiting implemented
- [ ] Input validation on all endpoints
- [ ] No sensitive data in URLs or logs

### Data Protection
- [ ] Encryption at rest enabled (Supabase, Stripe)
- [ ] Encryption in transit (TLS 1.2+)
- [ ] Data backup: daily automated + weekly manual
- [ ] Backup tested and verified to restore
- [ ] PII data properly encrypted

---

## Phase 7: Functionality Testing ✓

### Page Access
- [ ] `https://ads.citybeatmag.co/en/campaigns` loads
- [ ] `https://ads.citybeatmag.co/en/newsletter` loads
- [ ] `https://ads.citybeatmag.co/en/sponsored` loads
- [ ] `https://ads.citybeatmag.co/en/banners` loads
- [ ] `https://ads.citybeatmag.co/en/orders` loads
- [ ] All pages load in < 3 seconds

### Form Functionality
- [ ] Campaign creation form accepts input
- [ ] Form validation works (empty field errors)
- [ ] Billing cycle selection updates price
- [ ] Order summary updates in real-time
- [ ] Submit button is clickable

### Stripe Integration
- [ ] Stripe.js loads without errors
- [ ] Checkout button clickable
- [ ] Checkout session creation endpoint responds
- [ ] Redirects to Stripe checkout page
- [ ] Stripe checkout form loads correctly

### Error Handling
- [ ] Network errors show user-friendly messages
- [ ] Invalid data shows validation messages
- [ ] Loading states display properly
- [ ] Error recovery options available
- [ ] No console JavaScript errors

### Responsive Design
- [ ] Desktop view (1920px) displays correctly
- [ ] Tablet view (768px) responsive
- [ ] Mobile view (375px) readable and usable
- [ ] Touch targets are 44px+ on mobile
- [ ] No horizontal scrolling on mobile

---

## Phase 8: Performance & Monitoring ✓

### Performance Metrics
- [ ] Lighthouse score > 85
- [ ] First Contentful Paint < 2.5s
- [ ] Largest Contentful Paint < 4s
- [ ] Cumulative Layout Shift < 0.1
- [ ] Time to Interactive < 3.5s

### Monitoring & Alerts
- [ ] Sentry integration confirmed (errors captured)
- [ ] Error alerts configured in Sentry
- [ ] Performance monitoring enabled
- [ ] Slack notifications configured (optional)
- [ ] Uptime monitoring setup (external service)

### Analytics
- [ ] Google Analytics or similar installed (optional)
- [ ] Campaign tracking initialized
- [ ] Conversion tracking setup
- [ ] User identification setup

---

## Phase 9: Documentation & Handoff ✓

### Documentation
- [ ] Deployment guide created: `DEPLOYMENT_GUIDE.md`
- [ ] Production runbook created: `PRODUCTION_RUNBOOK.md`
- [ ] API documentation created: `API_DOCUMENTATION.md`
- [ ] Troubleshooting guide created: `TROUBLESHOOTING.md`
- [ ] Environment variables documented
- [ ] Secrets management documented

### Credentials & Access
- [ ] Vercel login credentials secured
- [ ] Hostgator login credentials secured
- [ ] Stripe API keys secured
- [ ] Supabase credentials secured
- [ ] All credentials stored in password manager
- [ ] Backup access credentials created

### Team Communication
- [ ] Deployment notification sent to team
- [ ] Production URL shared
- [ ] Known limitations documented
- [ ] Support contact listed
- [ ] Escalation procedures documented

---

## Phase 10: Post-Deployment Verification ✓

### Live URL Verification
Visit in browser:
- [ ] `https://ads.citybeatmag.co` (redirects properly)
- [ ] `https://ads.citybeatmag.co/en/campaigns` (loads, shows mock data)
- [ ] `https://ads.citybeatmag.co/en/newsletter` (form loads)
- [ ] Page title is correct: "CityBeat Magazine - Ads Portal"
- [ ] Favicon loads correctly
- [ ] Logo/branding displays correctly

### Browser Console Check (F12)
- [ ] No JavaScript errors in console
- [ ] No CORS errors
- [ ] No 404 errors in network tab
- [ ] No warnings about missing resources
- [ ] All API calls respond with 2xx status

### Network Performance
- [ ] All resources load from CDN
- [ ] Images optimized and served in modern formats
- [ ] JavaScript bundles are minified
- [ ] CSS is optimized
- [ ] No unused resources loaded

### Stripe Test
- [ ] Test card: `4242 4242 4242 4242`
- [ ] Expiry: Any future date (e.g., 12/25)
- [ ] CVC: Any 3 digits
- [ ] Checkout form loads
- [ ] Error handling for declined cards works

### Email Testing
- [ ] Test email sent to: `test@example.com`
- [ ] Email received within 5 minutes
- [ ] Email formatting is correct
- [ ] All links in email work
- [ ] Unsubscribe link works (optional)

---

## Final Sign-Off ✓

### Deployment Status
- [ ] **ALL TESTS PASSED**
- [ ] **DEPLOYMENT SUCCESSFUL**
- [ ] **LIVE AND ACCESSIBLE**

### Sign-Off
- **Deployed By:** _________________
- **Verified By:** _________________
- **Date:** _________________
- **Time:** _________________

### Notes & Issues
```
[Any issues encountered or workarounds applied]
```

---

## Emergency Contacts

| Role | Name | Contact |
|------|------|---------|
| DevOps Lead | [Your Name] | [Email] |
| Stripe Support | | https://support.stripe.com |
| Vercel Support | | https://vercel.com/support |
| Hostgator Support | | https://support.hostgator.com |

---

## Rollback Plan

If critical issues occur after deployment:

1. **Vercel Rollback** (instant):
   ```bash
   vercel rollback --prod
   ```

2. **DNS Revert** (if needed):
   - Revert CNAME record in Hostgator
   - Point to previous server/IP

3. **Communication**:
   - Notify team immediately
   - Update status page
   - Send incident notification

---

**This checklist must be completed before considering deployment successful.**
