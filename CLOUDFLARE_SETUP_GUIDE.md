# Cloudflare DNS and SSL Setup Guide

## Overview

This guide covers moving CityBeat's domain (citybeatmag.co) to Cloudflare and configuring DNS records for all services with SSL/TLS encryption.

## Services and Subdomains

| Service | Subdomain | Purpose | Provider |
|---------|-----------|---------|----------|
| Main Website | citybeatmag.co | Web app | Vercel |
| Ads Portal | ads.citybeatmag.co | Ad management | Vercel |
| Sanity Studio | studio.citybeatmag.co | CMS | Sanity |
| API/Webhooks | api.citybeatmag.co | Webhooks, API | Cloudflare Worker |
| Analytics | analytics.citybeatmag.co | Analytics (optional) | Analytics service |

## Part 1: Create Cloudflare Account and Add Domain

### Step 1: Create Cloudflare Account

1. Go to https://dash.cloudflare.com/sign-up
2. Enter email address
3. Create password
4. Accept terms
5. Click **Create account**
6. Verify email address
7. Complete initial setup survey (optional)

### Step 2: Add Your Domain

1. After account setup, click **Add a site**
2. Enter domain: `citybeatmag.co`
3. Click **Add site**
4. Choose plan: **Free Plan** (includes DNS, basic DDoS protection, SSL)
   - Click **Continue with Free**
5. Cloudflare will scan for existing DNS records
6. Review detected records (if any exist)
7. Click **Continue** to proceed to nameserver update

### Step 3: Update Nameservers at Domain Registrar

Cloudflare will display two nameservers. Example:

```
NS1: lars.ns.cloudflare.com
NS2: monica.ns.cloudflare.com
```

Go to your domain registrar (GoDaddy, Namecheap, etc.):

1. Log into registrar account
2. Find **DNS** or **Nameservers** settings
3. Replace current nameservers with Cloudflare's:
   - Delete old nameservers
   - Add two Cloudflare nameservers
4. Save changes

**Important**: DNS propagation takes 24-48 hours. Cloudflare will notify when complete.

## Part 2: Configure DNS Records

After nameservers update completes, configure all subdomains in Cloudflare.

### In Cloudflare Dashboard

1. Go to https://dash.cloudflare.com
2. Select your domain: **citybeatmag.co**
3. Click **DNS** in left sidebar
4. Click **Add record** button

### DNS Records Configuration

#### 1. Root Domain → Vercel (citybeatmag.co)

**Type**: `CNAME`
**Name**: `@` (or leave blank)
**Content**: `cname.vercel-dns.com`
**TTL**: Auto
**Proxy status**: ☁️ Proxied (orange cloud)
**Click**: **Save**

#### 2. WWW Subdomain → Vercel (www.citybeatmag.co)

**Type**: `CNAME`
**Name**: `www`
**Content**: `cname.vercel-dns.com`
**TTL**: Auto
**Proxy status**: ☁️ Proxied (orange cloud)
**Click**: **Save**

#### 3. Ads Portal → Vercel (ads.citybeatmag.co)

**Type**: `CNAME`
**Name**: `ads`
**Content**: `cname.vercel-dns.com`
**TTL**: Auto
**Proxy status**: ☁️ Proxied (orange cloud)
**Click**: **Save**

#### 4. Sanity Studio → Sanity (studio.citybeatmag.co)

**Type**: `CNAME`
**Name**: `studio`
**Content**: `sanity.cloud`
**TTL**: Auto
**Proxy status**: ☁️ Proxied (orange cloud)
**Click**: **Save**

Note: Sanity may require specific CNAME values. Check Sanity docs for exact value.

#### 5. API/Webhooks → Cloudflare Worker (api.citybeatmag.co)

**Type**: `CNAME`
**Name**: `api`
**Content**: `api.citybeatmag.co.cdn.cloudflare.net` (or Cloudflare-assigned value)
**TTL**: Auto
**Proxy status**: ☁️ Proxied (orange cloud)
**Click**: **Save**

Or use specific Worker route:

**Type**: `A`
**Name**: `api`
**Content**: `192.0.2.1` (obtain from Cloudflare Workers setup)
**TTL**: Auto
**Proxy status**: ☁️ Proxied (orange cloud)
**Click**: **Save**

### Verification

After adding all records, verify each DNS entry:

```bash
# Check DNS resolution
nslookup citybeatmag.co
nslookup ads.citybeatmag.co
nslookup studio.citybeatmag.co
nslookup api.citybeatmag.co

# Or use dig
dig citybeatmag.co
dig ads.citybeatmag.co
dig studio.citybeatmag.co
dig api.citybeatmag.co
```

Expected output: Points to respective service providers (Vercel, Sanity, Cloudflare)

## Part 3: SSL/TLS Configuration

### Cloudflare SSL Settings

1. In Cloudflare Dashboard, click **SSL/TLS** in left sidebar
2. Click **Overview** tab

### Edge Certificates

1. Click **Edge Certificates** tab
2. Scroll to **Always Use HTTPS**: Toggle **ON** ✓
3. Scroll to **Minimum TLS Version**: Set to **TLS 1.2**
4. Scroll to **Opportunistic Encryption**: Toggle **ON**
5. Scroll to **TLS 1.3**: Toggle **ON**
6. Scroll to **Automatic HTTPS Rewrites**: Toggle **ON**
7. Click **Save**

### Origin Configuration

1. Click **Origin Server** tab
2. Note: This handles HTTPS between Cloudflare and your origin servers
3. Ensure origin servers have valid certificates:
   - **Vercel**: Auto-configured with Let's Encrypt
   - **Sanity**: Auto-configured with valid cert
   - **Cloudflare Workers**: No origin cert needed

### Full/Full Strict Mode

1. Go to **Overview** tab
2. Under **SSL/TLS Encryption Mode**: Select **Full (strict)**
   - This requires origin server to have valid SSL cert
   - **Recommended**: For production after verifying all services work

Or start with **Full** if certificates need configuration:
   - Allows self-signed certs temporarily
   - Still encrypts Cloudflare → origin connection

**For CityBeat**: Use **Full (strict)** since all services (Vercel, Sanity, Workers) have valid certs.

## Part 4: Configure Firewall and Security

### Page Rules (Optional)

1. Click **Rules** → **Page Rules**
2. Example rules:
   - Cache everything on static assets
   - Bypass cache for API endpoints
   - Set security level by path

### Firewall Rules

1. Click **Security** → **WAF**
2. Configure rules for:
   - Bot mitigation
   - Rate limiting
   - Geographic restrictions (optional)

### DDoS Protection

Cloudflare Free plan includes:
- ✅ Basic DDoS protection (automatic)
- ✅ Rate limiting (3 rules free)
- ✅ Bot mitigation

Settings are automatic - no configuration needed.

## Part 5: Verify Certificate Installation

After DNS propagation completes, verify SSL certificates:

### Check Certificate for Main Domain

```bash
# Using openssl
openssl s_client -connect citybeatmag.co:443 -servername citybeatmag.co

# Using curl
curl -vI https://citybeatmag.co

# Using online tool
# Visit: https://www.ssl-shopper.com/ssl-checker.html
# Enter: citybeatmag.co
```

Expected results:
- ✅ Valid certificate
- ✅ Subject: citybeatmag.co (or *.citybeatmag.co)
- ✅ Issued by: Cloudflare/Let's Encrypt
- ✅ Not expired
- ✅ All subdomains covered

### Check All Subdomains

Test each subdomain:

```bash
curl -vI https://ads.citybeatmag.co
curl -vI https://studio.citybeatmag.co
curl -vI https://api.citybeatmag.co
```

All should show:
- ✅ HTTP 200/301 (not 526/error)
- ✅ Valid SSL certificate
- ✅ Automatic HTTPS redirect

## Part 6: Worker Domain Configuration

### Route Worker to api.citybeatmag.co

1. Log into Cloudflare Account
2. Go to **Workers** → **Domains & Routes**
3. Click **Add route**
4. **Route**: `api.citybeatmag.co/*`
5. **Zone**: Select `citybeatmag.co`
6. **Worker**: Select `citybeat-worker`
7. Click **Save**

### Update wrangler.toml

```toml
[env.production]
routes = [
  { pattern = "api.citybeatmag.co/*", zone_name = "citybeatmag.co" }
]
```

### Deploy Worker

```bash
cd services/worker
wrangler deploy --env production
```

## Part 7: Verify Everything

### Checklist

- [ ] DNS records all point correctly
  - [ ] citybeatmag.co → Vercel
  - [ ] ads.citybeatmag.co → Vercel
  - [ ] studio.citybeatmag.co → Sanity
  - [ ] api.citybeatmag.co → Cloudflare Worker

- [ ] SSL certificates valid
  - [ ] https://citybeatmag.co loads with HTTPS
  - [ ] https://ads.citybeatmag.co loads with HTTPS
  - [ ] https://studio.citybeatmag.co loads with HTTPS
  - [ ] https://api.citybeatmag.co responds to requests

- [ ] Redirects working
  - [ ] http://citybeatmag.co → https://citybeatmag.co
  - [ ] http://ads.citybeatmag.co → https://ads.citybeatmag.co
  - [ ] www.citybeatmag.co → https://citybeatmag.co

- [ ] Services responding correctly
  - [ ] Web app loads and functions
  - [ ] Ads portal loads and accepts requests
  - [ ] Sanity studio loads
  - [ ] API endpoints respond (test with curl/Postman)

- [ ] Webhook endpoints accessible
  - [ ] `https://api.citybeatmag.co/webhooks/stripe` accepts POST requests
  - [ ] Stripe dashboard confirms endpoint reachable

### Test Commands

```bash
# Test main domain
curl -I https://citybeatmag.co
curl -I https://www.citybeatmag.co

# Test ads portal
curl -I https://ads.citybeatmag.co/en
curl -I https://ads.citybeatmag.co/es

# Test Sanity studio (should redirect or show login)
curl -I https://studio.citybeatmag.co

# Test API endpoint
curl -I https://api.citybeatmag.co/health

# Test webhook endpoint
curl -X POST https://api.citybeatmag.co/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"type": "ping"}'
```

## Part 8: Monitor and Troubleshoot

### Common Issues

**Issue: "Nameserver update taking too long"**
- Solution: Wait 24-48 hours
- Verify with: `dig citybeatmag.co NS`
- Should show Cloudflare nameservers

**Issue: "Mixed content warnings"**
- Cause: HTTP resources loaded on HTTPS page
- Solution: Enable "Automatic HTTPS Rewrites" in Cloudflare
- Update app code to use relative URLs or HTTPS

**Issue: "SSL certificate not trusted"**
- Check: Is SSL/TLS set to "Full (strict)"?
- Verify: Origin server has valid certificate
- Solution: May need to use "Full" mode temporarily

**Issue: "API endpoint shows 526 error"**
- Cause: Origin server SSL certificate invalid
- Solution: Check Cloudflare Worker deployment
- Verify: Worker routes configured correctly
- Test: Direct Worker URL (if available)

**Issue: "Subdomains not resolving"**
- Check: DNS records exist for each subdomain
- Verify: Proxy status is ☁️ (Proxied) if needed
- Test: `nslookup ads.citybeatmag.co`
- Clear: Browser DNS cache (or use incognito window)

### Monitor Cloudflare Dashboard

1. **Analytics**: Shows traffic, cache stats, threats blocked
2. **Logs**: Records all requests for debugging
3. **SSL/TLS**: Displays certificate status
4. **Page Rules**: Shows rule matches and actions
5. **Workers**: Shows deployment and error logs

## Part 9: Optimize Performance

### Enable Caching

1. Click **Caching** → **Cache Rules**
2. Create rules to cache:
   - Static assets (CSS, JS, images)
   - API responses (if applicable)

### Enable Compression

1. Click **Speed** → **Optimization**
2. Toggle **Brotli** compression: **ON**
3. Toggle **Rocket Loader**: **ON** (optional, may break some JS)
4. Toggle **Minify CSS/JS/HTML**: **ON**

### Enable HTTP/2

1. In **SSL/TLS** → **Edge Certificates**
2. Already enabled by default

## Part 10: Production Checklist

Before going live:

- [ ] Domain transferred to Cloudflare
- [ ] DNS records configured for all subdomains
- [ ] SSL/TLS set to "Full (strict)"
- [ ] Automatic HTTPS enabled
- [ ] All services responding over HTTPS
- [ ] Webhook endpoints verified working
- [ ] Worker routes configured
- [ ] Analytics enabled in Cloudflare
- [ ] Basic security settings configured
- [ ] Performance optimizations enabled
- [ ] Monitoring and alerts set up

## Support and Resources

- **Cloudflare Docs**: https://developers.cloudflare.com/
- **DNS Setup**: https://developers.cloudflare.com/fundamentals/setup/manage-domains/
- **SSL/TLS**: https://developers.cloudflare.com/ssl/
- **Workers Routing**: https://developers.cloudflare.com/workers/platform/routes/
- **Status Page**: https://www.cloudflarestatus.com/

## Changelog

### Version 1.0 (Current)
- ✅ Domain transfer guide
- ✅ DNS records configuration
- ✅ SSL/TLS setup
- ✅ Worker routing
- ✅ Verification procedures
- ✅ Troubleshooting guide
- ✅ Performance optimization
- ✅ Production checklist

### Future Enhancements
- [ ] WAF rule templates
- [ ] Rate limiting configuration
- [ ] Geographic restrictions
- [ ] Custom page rules
- [ ] Analytics dashboard setup
