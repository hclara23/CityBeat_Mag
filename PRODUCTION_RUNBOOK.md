# CityBeat Magazine - Production Runbook

## Emergency Contacts

- **On-Call Lead**: [To be filled]
- **Stripe Support**: https://support.stripe.com
- **Vercel Status**: https://www.vercel-status.com/
- **Supabase Status**: https://status.supabase.com/
- **Cloudflare Status**: https://www.cloudflarestatus.com/

## Critical Endpoints

```
Main Site:        https://citybeatmag.co
Ads Portal:       https://ads.citybeatmag.co
CMS Studio:       https://studio.citybeatmag.co
API:              https://api.citybeatmag.co
Health Check:     https://api.citybeatmag.co/health
```

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Visitors                                │
└──────────────┬─────────────────────────────┬─────────────────┘
               │                             │
        ┌──────▼──────┐             ┌────────▼────────┐
        │   Website   │             │  Ads Portal     │
        │ (Vercel)    │             │ (Vercel)        │
        └──────┬──────┘             └────────┬────────┘
               │                             │
        ┌──────▼─────────────────────────────▼────────┐
        │         Cloudflare (DNS/CDN)                │
        └──────┬──────────────────────────────────────┘
               │
        ┌──────▼──────┐         ┌──────────────┐
        │   Worker    │         │  Stripe      │
        │(Webhooks)   │         │ (Payments)   │
        └──────┬──────┘         └──────────────┘
               │
        ┌──────▼───────────┬──────────────┬──────────────┐
        │                  │              │              │
    ┌───▼──────┐   ┌──────▼──┐   ┌──────▼──┐   ┌──────▼─┐
    │ Supabase │   │ Sanity  │   │ Resend  │   │ DeepL  │
    │(Database)│   │ (CMS)   │   │(Email)  │   │(Trans.)│
    └──────────┘   └─────────┘   └─────────┘   └────────┘
```

## Common Operations

### 1. Check System Health

```bash
# Test all critical endpoints
curl https://api.citybeatmag.co/health
curl https://citybeatmag.co/api/health
curl https://ads.citybeatmag.co/api/health

# Check DNS resolution
nslookup citybeatmag.co
nslookup ads.citybeatmag.co
nslookup api.citybeatmag.co

# Check SSL certificates
openssl s_client -connect api.citybeatmag.co:443 -servername api.citybeatmag.co
```

### 2. Deploy Updates

#### Deploy Web App
```bash
cd apps/web
vercel --prod
# Or automatic via GitHub push to main
```

#### Deploy Ads Portal
```bash
cd apps/ads
vercel --prod
# Or automatic via GitHub push to main
```

#### Deploy Cloudflare Worker
```bash
cd services/worker
wrangler deploy --env production
```

#### Deploy Sanity Studio
```bash
cd sanity
sanity deploy
```

### 3. Monitor Error Rates

**Sentry Dashboard**: https://sentry.io/organizations/citybeat/

- [ ] Check error trends
- [ ] Review critical errors
- [ ] Check affected users
- [ ] Look at context and stack traces

### 4. View Logs

**Vercel Logs** (Web App):
```bash
vercel logs --prod
```

**Vercel Logs** (Ads Portal):
```bash
vercel logs --prod --scope citybeat-ads
```

**Cloudflare Worker Logs**:
```bash
wrangler tail --env production
```

**Supabase Logs**:
- Go to https://app.supabase.com
- Select project
- View logs in Logs section

### 5. Stripe Operations

#### Check Webhook Delivery
1. Go to https://dashboard.stripe.com/
2. Navigate to Developers → Webhooks
3. Click endpoint: `https://api.citybeatmag.co/webhooks/stripe`
4. View events and delivery status

#### Test Webhook
1. In webhook endpoint, click "Send test"
2. Monitor Cloudflare Worker logs
3. Verify database record created

#### Create Test Payment
1. Go to Stripe Test Mode
2. Use test card: `4242 4242 4242 4242`
3. Any expiry and CVC
4. Complete payment
5. Verify webhook delivery

### 6. Database Operations

#### Backup Supabase
```bash
# Supabase handles automated backups
# To manually export:
pg_dump postgresql://[user]:[password]@[host]/[database] > backup.sql
```

#### Check Database Connections
```sql
SELECT datname, count(*) as connections
FROM pg_stat_activity
GROUP BY datname;
```

#### Monitor Slow Queries
```sql
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### 7. Email Operations

#### Check Email Status (Resend)
1. Go to https://resend.com/emails
2. View recent sends
3. Check bounce/complaint rates

#### Test Email Send
```bash
curl -X POST "https://api.resend.com/emails" \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "noreply@citybeatmag.co",
    "to": "test@example.com",
    "subject": "Test",
    "html": "<p>Test email</p>"
  }'
```

### 8. Sanity Operations

#### Publish a Brief
1. Go to https://studio.citybeatmag.co
2. Open a draft brief
3. Click "Publish"
4. Verify on main site

#### Create Backup
```bash
cd sanity
sanity dataset export production backup.tar.gz
```

### 9. Translation Operations

#### Monitor DeepL Usage
1. Go to https://www.deepl.com/pro-usage
2. Check character count
3. If near limit, consider plan upgrade

### 10. Troubleshooting

#### Website Not Loading
1. Check Vercel deployment status
2. Check Cloudflare status
3. Check DNS resolution
4. Review Sentry for errors
5. Check browser console for errors

#### Payment Not Processing
1. Check Stripe dashboard for errors
2. Verify webhook delivery
3. Check database for ad_purchases record
4. Review email logs
5. Check Sentry for payment errors

#### Translations Not Working
1. Check DeepL API key
2. Verify DeepL character limit not exceeded
3. Check Worker logs
4. Test translation manually with curl

#### Emails Not Sending
1. Check Resend API key
2. Verify domain SPF/DKIM records
3. Check bounce rates in Resend
4. Review Sentry for email errors

#### Database Down
1. Check Supabase status
2. Check connection pooling
3. Review database logs
4. Check for long-running queries
5. If needed, restore from backup

## Incident Response

### P0 - Critical (Site Down)

1. **Identify**: Check all health endpoints
2. **Notify**: Slack #incidents channel
3. **Assess**:
   - Check Vercel, Supabase, Cloudflare status
   - Review recent deployments
   - Check error logs
4. **Mitigate**:
   - Rollback recent deployment if applicable
   - Scale resources if needed
   - Enable cache if origin unavailable
5. **Resolve**: Fix root cause
6. **Communicate**: Update status page
7. **Post-Mortem**: Review within 24 hours

### P1 - Major (Feature Broken)

1. **Identify**: Confirm specific feature not working
2. **Notify**: #incidents channel
3. **Assess**: Check logs and errors
4. **Workaround**: Temporary fix if possible
5. **Fix**: Deploy corrected code
6. **Verify**: Test thoroughly
7. **Post-Mortem**: Document for patterns

### P2 - Minor (Cosmetic/UX Issue)

1. **Document**: Create GitHub issue
2. **Schedule**: Add to next sprint
3. **Track**: Monitor for user impact
4. **Fix**: Deploy in regular cadence

## Rollback Procedures

### Rollback Vercel Deployment (Web)

```bash
cd apps/web
vercel rollback web-app.vercel.app
# Or use specific deployment URL:
vercel rollback https://citybeat-web-[hash].vercel.app/
```

### Rollback Vercel Deployment (Ads)

```bash
cd apps/ads
vercel rollback ads-app.vercel.app
```

### Rollback Cloudflare Worker

```bash
cd services/worker
wrangler rollback --env production
```

## Performance Monitoring

### Key Metrics

- **LCP** (Largest Contentful Paint): < 2.5s
- **FID** (First Input Delay): < 100ms
- **CLS** (Cumulative Layout Shift): < 0.1
- **API Response Time (p95)**: < 500ms
- **Database Query Time**: < 200ms
- **Error Rate**: < 1%
- **Uptime**: > 99.9%

### Check Performance

**Vercel Analytics**: https://vercel.com/analytics

**Sentry Performance**: https://sentry.io/organizations/citybeat/performance/

**Google PageSpeed Insights**:
```
https://pagespeed.web.dev/?url=https://citybeatmag.co
https://pagespeed.web.dev/?url=https://ads.citybeatmag.co
```

## Security Checklist

### Monthly Tasks

- [ ] Review access logs
- [ ] Check SSL certificate expiration
- [ ] Review API key usage
- [ ] Run `npm audit` on all apps
- [ ] Check for security advisories

### Quarterly Tasks

- [ ] Rotate API keys
- [ ] Audit user permissions
- [ ] Review RLS policies
- [ ] Security audit of code
- [ ] Penetration test (optional)

### Annually

- [ ] Full security audit
- [ ] Update dependencies
- [ ] Review disaster recovery plan
- [ ] Team security training

## Cost Monitoring

### Monthly Estimated Costs

- Vercel Pro: $20
- Cloudflare Workers: $5-25
- Supabase Pro: $25
- Sanity Team: $99
- Resend: $20
- DeepL Pro: $25
- Sentry: $26
- Stripe: 2.9% + $0.30 per transaction

**Total Base**: ~$220/month (before transaction fees)

### Cost Alerts

- Set Stripe spending limit
- Monitor Supabase database usage
- Track Cloudflare invocations
- Review Vercel bandwidth usage

## Documentation References

- [Stripe API Docs](https://stripe.com/docs/api)
- [Supabase Docs](https://supabase.com/docs)
- [Sanity Docs](https://www.sanity.io/docs)
- [Vercel Docs](https://vercel.com/docs)
- [Cloudflare Docs](https://developers.cloudflare.com/)
- [Next.js Docs](https://nextjs.org/docs)

## Schedule

### Daily

- [ ] Check error logs
- [ ] Verify webhooks are processing
- [ ] Quick health check of endpoints

### Weekly

- [ ] Review performance metrics
- [ ] Check uptime monitoring
- [ ] Review cost trends
- [ ] Check for security alerts

### Monthly

- [ ] Full system audit
- [ ] Performance optimization review
- [ ] Security update

### Quarterly

- [ ] Team retrospective
- [ ] Capacity planning
- [ ] Disaster recovery test

## Contact Information

- **Team Lead**: [Name/Email]
- **Developer On-Call**: [Rotation]
- **PM**: [Name/Email]
- **Support Email**: support@citybeatmag.co
