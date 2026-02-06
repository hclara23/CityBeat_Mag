# CityBeat Magazine - Incident Response Procedures

## Incident Severity Levels

### P0 - Critical
- Site completely down
- Payment processing broken
- Data loss occurring
- Security breach

**SLA**: Acknowledge within 5 minutes, resolve within 1 hour

### P1 - High
- Major feature not working
- Significant performance degradation
- High error rate (> 5%)

**SLA**: Acknowledge within 15 minutes, resolve within 4 hours

### P2 - Medium
- Minor feature broken
- Minor performance issue
- Low error rate (< 1%)

**SLA**: Acknowledge within 1 hour, resolve within 24 hours

### P3 - Low
- Cosmetic issues
- Documentation errors
- Edge case bugs

**SLA**: Fix in next sprint

## Incident Response Steps

### 1. Detection & Alerting

**Automated Alerts** (received via Slack #incidents)
- Sentry error rate > 5%
- API response time > 2 seconds (p95)
- Database connections > 90%
- Worker error rate > 1%
- Uptime check failed

**Manual Detection**
- User report via support email
- Team member notice
- Analytics dashboard review

### 2. Initial Response (Within 5 minutes for P0)

```
1. ACKNOWLEDGE: Post in #incidents
   "Investigating: [brief description]"

2. VERIFY: Confirm the issue
   - Check health endpoints
   - Check error logs (Sentry)
   - Check status pages

3. ASSESS: Determine severity
   - User impact
   - Duration
   - Scope
   - Root cause (if obvious)

4. NOTIFY:
   - On-call lead
   - Relevant stakeholders
   - Post status update
```

### 3. Investigation Phase

#### Check Services

```bash
# Health endpoints
curl https://api.citybeatmag.co/health
curl https://citybeatmag.co/api/health
curl https://ads.citybeatmag.co/api/health

# DNS
nslookup citybeatmag.co
dig @1.1.1.1 api.citybeatmag.co

# SSL
openssl s_client -connect api.citybeatmag.co:443

# Connectivity
curl -I https://api.citybeatmag.co
```

#### Check Logs

**Vercel Logs (Web App)**
```bash
vercel logs --prod
# Filter for errors
```

**Vercel Logs (Ads App)**
```bash
vercel logs --prod --scope citybeat-ads
```

**Cloudflare Worker**
```bash
wrangler tail --env production
```

**Supabase**
- Dashboard → Database → Logs
- Check for slow queries
- Check connections

**Sentry**
- https://sentry.io/organizations/citybeat/
- Recent errors
- Affected projects
- Stack traces

#### Check External Services

1. **Stripe**: https://status.stripe.com/
2. **Vercel**: https://vercel-status.com/
3. **Supabase**: https://status.supabase.com/
4. **Cloudflare**: https://www.cloudflarestatus.com/
5. **Sanity**: https://sanity.cloud/status/

### 4. Mitigation Phase

#### Quick Wins
- Clear CDN cache
- Scale up resources
- Enable read replicas
- Switch to fallback configuration

#### For Payment Issues
1. Check Stripe dashboard
2. Verify webhook endpoint
3. Check database for stuck transactions
4. Manually process pending payments if needed

#### For Database Issues
1. Check connections
2. Kill long-running queries
3. Check backups status
4. Consider failover

#### For API Issues
1. Check Worker logs
2. Verify environment variables
3. Check external API connectivity
4. Scale workers if needed

#### For Content/CMS Issues
1. Check Sanity studio
2. Verify API connectivity
3. Clear Next.js ISR cache
4. Rebuild specific pages

### 5. Resolution

#### Rollback (if recent deployment caused issue)

**Rollback Web App**
```bash
cd apps/web
vercel rollback <deployment-url>
```

**Rollback Ads Portal**
```bash
cd apps/ads
vercel rollback <deployment-url>
```

**Rollback Worker**
```bash
cd services/worker
wrangler rollback --env production
```

#### Deploy Fix

```bash
# After fixing code
git commit -m "Fix: [description]"
git push origin main

# Monitor deployment in GitHub Actions
# Or manually deploy:
vercel --prod
```

### 6. Communication

**Incident Channel Updates**
```
🔴 INCIDENT: [Title]
Status: INVESTIGATING
Severity: P[0-3]
Impact: [description]
ETA: [estimated time]
Updates: [progress]
```

**Escalation**
- P0 after 15 min: Escalate to tech lead
- P0 after 30 min: Escalate to CTO
- P1 after 1 hour: Escalate to tech lead

**Public Communication** (if relevant)
- Update status page
- Post to social media
- Email users if major issue

### 7. Post-Incident Review

#### Immediate (Within 24 hours)

1. **Document**
   - What happened
   - When it occurred
   - How long it lasted
   - What was affected
   - Root cause
   - How it was resolved

2. **Timeline**
   ```
   14:23 - Alert triggered
   14:24 - Team notified
   14:30 - Root cause identified
   14:45 - Fix deployed
   15:00 - Verified resolved
   ```

3. **Impact Assessment**
   - Users affected
   - Revenue impact
   - Data impact
   - Reputation impact

#### Short-term (Within 1 week)

1. **Preventative Measures**
   - What could have prevented this?
   - Add monitoring/alerting?
   - Code changes needed?
   - Process changes needed?

2. **Implement Fixes**
   - Deploy preventative code changes
   - Add monitoring/alerts
   - Update runbooks
   - Update tests

3. **Team Review**
   - 30-minute retrospective
   - What went well?
   - What could be improved?
   - Action items?

#### Long-term

- Track patterns
- Address systemic issues
- Improve infrastructure
- Update training

## Common Incident Scenarios

### Scenario 1: Payment Processing Down

**Symptoms**
- Checkout page loads but payment fails
- Stripe webhook errors in logs
- ad_purchases table empty

**Investigation**
```bash
# Check Stripe dashboard
# Verify webhook secret
# Check Worker logs
# Check database connections
```

**Resolution**
- Verify webhook endpoint is accessible
- Check API credentials
- Retry webhook delivery from Stripe dashboard
- If DB issue: check connections, run backups

### Scenario 2: Website Completely Down

**Symptoms**
- 503 error on citybeatmag.co
- All health checks failing

**Investigation**
```bash
# Check Vercel status
# Check DNS resolution
# Check SSL certificate
# Check Sanity/Supabase connectivity
```

**Resolution**
- If DNS issue: check Cloudflare
- If Vercel issue: check recent deployments, rollback if needed
- If database issue: scale resources or failover
- If external API down: enable cache, show fallback

### Scenario 3: High Error Rate

**Symptoms**
- Sentry shows > 5% error rate
- Users reporting errors

**Investigation**
- Filter Sentry by issue type
- Check recent code changes
- Check external dependencies
- Check database performance

**Resolution**
- Rollback recent deployment
- Deploy fix for root cause
- Clear caches if needed

### Scenario 4: Database Down

**Symptoms**
- Supabase status page shows issue
- Connection timeouts in logs

**Investigation**
```bash
# Check Supabase dashboard
# Verify connection pooling
# Check active connections
# Review backup status
```

**Resolution**
- Scale resources
- Kill long-running queries
- Failover to replica
- Restore from backup (last resort)

### Scenario 5: Translation Service Down

**Symptoms**
- New briefs not translated
- Worker logs show DeepL errors

**Investigation**
- Check DeepL status
- Verify API key
- Check character limit

**Resolution**
- Wait for DeepL recovery
- Or disable translations temporarily
- Process manually later

## Tools & Access

### Required Access
- [ ] Sentry dashboards
- [ ] Vercel deployments
- [ ] Cloudflare Workers
- [ ] Stripe dashboard
- [ ] Supabase dashboard
- [ ] Sanity studio
- [ ] GitHub repository (admin)
- [ ] Slack #incidents channel
- [ ] PagerDuty (optional)

### On-Call Setup

**Rotation**
- Weekly rotation (start Monday)
- Primary on-call
- Secondary backup

**Notification**
- PagerDuty or Slack alerts
- Phone call for P0 after 5 min
- Email for P1/P2

### Escalation

```
Level 1: On-call engineer
Level 2: Tech lead (after 15 min for P0, 1 hour for P1)
Level 3: CTO (after 30 min for P0, 4 hours for P1)
```

## Prevention Best Practices

### Monitoring
- Set up alerts for all critical metrics
- Monitor error rates, response times, resource usage
- Set up uptime monitoring
- Set up synthetic tests

### Testing
- Test payment flow before deploying
- Test database failover
- Test backup restoration
- Load testing before high-traffic events

### Code Quality
- Require code review
- Automated tests in CI/CD
- Linting and type checking
- Security scanning

### Deployment
- Gradual rollouts (canary)
- Blue-green deployments
- Automated rollback on error rate spike
- Verify deployments in staging first

### Documentation
- Keep runbooks updated
- Document common issues
- Document resolution procedures
- Share knowledge with team

## Resources

- [Sentry Docs](https://docs.sentry.io/)
- [Vercel Status](https://vercel-status.com/)
- [Cloudflare Status](https://www.cloudflarestatus.com/)
- [Stripe Dashboard](https://dashboard.stripe.com/)
- [Supabase Dashboard](https://app.supabase.com/)
- [On-Call Guide](https://github.com/morrissimo/on-call-guide)
