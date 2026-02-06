# Quick Reference Card - CityBeat Ads Portal Deployment
**Print this for quick lookup during deployment**

---

## Critical URLs

```
Vercel Dashboard:     https://vercel.com/dashboard
Hostgator Control:    https://www.hostgator.com/account/
Stripe Dashboard:     https://dashboard.stripe.com (Live Mode!)
Supabase Dashboard:   https://app.supabase.com
Sentry Dashboard:     https://sentry.io/organizations/citybeat
GitHub Repo:          https://github.com/your-org/CityBeat_Mag

Live Domain:          https://ads.citybeatmag.co
Test Domain:          http://localhost:3001 (local)
```

---

## Environment Variables (Vercel)

| Variable | Source | Format | Example |
|----------|--------|--------|---------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase Settings | URL | https://xxx.supabase.co |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase API Keys | Key | eyJhbGc... |
| NEXT_PUBLIC_STRIPE_PUBLIC_KEY | Stripe API (Live) | Key | pk_live_abc... |
| STRIPE_SECRET_KEY | Stripe API (Live) | Key | sk_live_xyz... |
| STRIPE_WEBHOOK_SECRET | Stripe Webhooks | Key | whsec_... |
| NEXT_PUBLIC_SENTRY_DSN | Sentry Project | URL | https://x@sentry.io/123 |
| SENTRY_DSN | Sentry Project | URL | https://x@sentry.io/123 |
| SENTRY_AUTH_TOKEN | Sentry Org | Key | sntrys_... |
| RESEND_API_KEY | Resend Account | Key | re_xxx... |
| NEXT_PUBLIC_APP_URL | (Set yourself) | URL | https://ads.citybeatmag.co |
| NEXT_PUBLIC_API_URL | (Set yourself) | URL | https://api.citybeatmag.co |

---

## Hostgator DNS Record

```
Type:   CNAME
Name:   ads
Value:  cname.vercel-dns.com
TTL:    3600
```

**Verification:**
```bash
nslookup ads.citybeatmag.co
# Should show Vercel IPs (76.76.19.89, etc.)
```

---

## Stripe Webhook Endpoint

```
URL: https://api.citybeatmag.co/webhooks/stripe

Events to Subscribe:
✓ checkout.session.completed
✓ customer.subscription.created
✓ customer.subscription.updated
✓ customer.subscription.deleted
✓ charge.refunded
✓ invoice.payment_succeeded
✓ invoice.payment_failed
```

---

## Key Files Created

```
✓ apps/ads/vercel.json              - Vercel config
✓ apps/ads/.env.example             - Env template
✓ apps/ads/src/app/.../campaigns/page.tsx     - Campaign list
✓ apps/ads/src/app/.../campaigns/[id]/page.tsx - Detail & analytics
✓ apps/ads/src/app/.../newsletter/page.tsx    - Newsletter creation
✓ apps/ads/src/app/.../sponsored/page.tsx     - Sponsored creation
✓ apps/ads/src/app/.../banners/page.tsx       - Banner creation
✓ apps/ads/src/app/.../success/page.tsx       - Order confirmation
✓ apps/ads/src/app/.../orders/page.tsx        - Order history
✓ apps/ads/src/app/api/checkout/route.ts      - Stripe checkout API
✓ apps/ads/src/app/api/orders/route.ts        - Orders list API
```

---

## Deployment Checklist (Simplified)

### Pre-Deployment
- [ ] `npm run build --workspace=apps/ads` succeeds
- [ ] No TypeScript errors: `npm run type-check`
- [ ] All code committed to `main`

### Vercel Setup
- [ ] Project created in Vercel
- [ ] Root directory: `apps/ads`
- [ ] All env vars added (11 variables)
- [ ] GitHub connected and auto-deploy enabled

### Hostgator DNS
- [ ] CNAME record created: `ads` → `cname.vercel-dns.com`
- [ ] DNS propagated: `nslookup ads.citybeatmag.co` shows Vercel IPs

### Verification
- [ ] Visit `https://ads.citybeatmag.co/en/campaigns` - loads
- [ ] Stripe test card accepted: `4242 4242 4242 4242`
- [ ] No console errors (F12)
- [ ] HTTPS padlock green

---

## Test URLs After Deployment

```
https://ads.citybeatmag.co/en/campaigns      ✓ Campaign list
https://ads.citybeatmag.co/en/newsletter     ✓ Newsletter form
https://ads.citybeatmag.co/en/sponsored      ✓ Sponsored form
https://ads.citybeatmag.co/en/banners        ✓ Banner form
https://ads.citybeatmag.co/en/orders         ✓ Order history
```

---

## Stripe Test Cards

```
Card Number:    4242 4242 4242 4242
Expiry:         12/25 (any future date)
CVC:            123 (any 3 digits)
ZIP:            12345 (any 5 digits)

Result: Charge succeeds, webhook fires
```

---

## Common Problems & Fixes

| Problem | Cause | Fix |
|---------|-------|-----|
| 404 Page Not Found | DNS not propagated | Wait 10+ mins, refresh |
| SSL Certificate Error | Cert still provisioning | Wait 5-10 mins |
| Stripe "Missing API Key" | Env var not set in Vercel | Check Vercel settings, redeploy |
| Blank Page | Build failed | Check Vercel build logs |
| Console CORS errors | Domain mismatch | Verify NEXT_PUBLIC_APP_URL |

---

## Emergency Commands

### Rollback Deployment (Vercel)
```bash
vercel rollback --prod
# OR in Vercel UI: Deployments → Click "..." → Redeploy previous
```

### Check DNS Propagation
```bash
nslookup ads.citybeatmag.co
dig ads.citybeatmag.co
host ads.citybeatmag.co
```

### Test HTTPS
```bash
curl -I https://ads.citybeatmag.co
# Should return 200 or 308 (redirect)
```

### View Build Logs
```
Vercel Dashboard → Deployments → Click build → View logs
```

---

## GitHub Secrets (For CI/CD)

```bash
VERCEL_TOKEN=vercel_your_token_here
VERCEL_ORG_ID=your_org_id
VERCEL_PROJECT_ID_ADS=your_project_id
```

---

## Cost Reference (Monthly)

```
Vercel Pro:           $20/month
Stripe:               2.9% + $0.30 per transaction
Supabase Pro:         $25/month
Sentry:               ~$29/month
Resend:               Free (up to 100/day)
Total (base):         ~$95/month + transaction fees
```

---

## Important Reminders ⚠️

1. **NEVER commit `.env` file** - Use `.env.example`
2. **Use STRIPE LIVE MODE** - Switch toggle in dashboard
3. **Keep all secrets secure** - Use password manager
4. **Monitor build logs** - Check after each deployment
5. **Test thoroughly** - Use test cards first
6. **Backup credentials** - Store securely
7. **Set billing alerts** - Vercel, Stripe, Supabase
8. **Document everything** - Keep runbooks updated

---

## Support Contacts

```
Vercel Support:      https://vercel.com/support
Stripe Support:      https://support.stripe.com
Hostgator Support:   https://support.hostgator.com
Supabase Support:    https://supabase.com/support
GitHub Support:      https://support.github.com
```

---

## Post-Deployment Verification

**In terminal:**
```bash
# DNS check
nslookup ads.citybeatmag.co

# HTTPS check
curl -I https://ads.citybeatmag.co

# Page load
curl -s https://ads.citybeatmag.co/en/campaigns | head -20
```

**In browser:**
```
F12 → Console → Check for errors
F12 → Network → Check all requests are 2xx/3xx
```

---

## Timeline

```
Vercel setup:        5 mins
Env variables:       10 mins
Hostgator DNS:       5 mins
DNS propagation:     5-30 mins
Testing:             10 mins
─────────────────────────────
Total:               35-60 mins
```

---

**Last Updated:** 2026-02-05
**Status:** Ready for deployment
