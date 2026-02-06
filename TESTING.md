# CityBeat Testing Guide

This document provides comprehensive instructions for testing the CityBeat Magazine application across all services and integrations.

## Table of Contents

1. [Local Development Testing](#local-development-testing)
2. [API Endpoint Testing](#api-endpoint-testing)
3. [Worker Automation Testing](#worker-automation-testing)
4. [End-to-End Workflow](#end-to-end-workflow)
5. [Database Testing](#database-testing)
6. [Integration Testing](#integration-testing)

## Local Development Testing

### Start Services

```bash
# Start all services
npm run dev

# Or start individually:
# Web app (port 3000)
cd apps/web && npm run dev

# Ads app (port 3001)
cd apps/ads && npm run dev

# Worker (port 8787)
cd services/worker && npm run dev
```

### Verify Services Running

```bash
# Web app
curl http://localhost:3000 && echo "✓ Web app running"

# Ads app
curl http://localhost:3001 && echo "✓ Ads app running"

# Worker health
curl http://localhost:8787/health && echo "✓ Worker running"
```

## API Endpoint Testing

### Web App Endpoints

#### GET /api/briefs
Fetch briefs with optional pagination.

```bash
# Fetch all briefs
curl http://localhost:3000/api/briefs

# With pagination
curl "http://localhost:3000/api/briefs?locale=en&limit=5&offset=0"

# Expected response:
{
  "data": [
    {
      "_id": "1",
      "title": "...",
      "category": "...",
      "publishedAt": "...",
      "language": "en",
      "source": "..."
    }
  ],
  "total": 2,
  "limit": 10,
  "offset": 0
}
```

#### GET /api/analytics
Fetch campaign analytics.

```bash
# Fetch analytics for a campaign
curl "http://localhost:3000/api/analytics?campaignId=campaign-1"

# With date range
curl "http://localhost:3000/api/analytics?campaignId=campaign-1&startDate=2026-01-01&endDate=2026-01-31"

# Expected response:
{
  "campaignId": "campaign-1",
  "totalImpressions": 15234,
  "totalClicks": 342,
  "ctr": 2.24,
  "startDate": "...",
  "endDate": "...",
  "dailyData": [...]
}
```

### Ads App Endpoints

#### GET /api/campaigns
Fetch advertiser's campaigns.

```bash
# Fetch campaigns for an advertiser
curl "http://localhost:3001/api/campaigns?advertiserId=user-123"

# With status filter
curl "http://localhost:3001/api/campaigns?advertiserId=user-123&status=active"

# Expected response:
{
  "data": [
    {
      "id": "campaign-1",
      "name": "Summer Sale 2024",
      "status": "active",
      "budget": 5000,
      "spent": 2340
    }
  ],
  "count": 1
}
```

### Worker Endpoints

#### GET /health
Health check endpoint.

```bash
curl http://localhost:8787/health
# Expected response: OK
```

#### POST /api/test-automation
Manually trigger brief automation.

```bash
curl -X POST http://localhost:8787/api/test-automation
curl -X POST http://localhost:8787/api/test-automation | jq .
```

#### POST /api/tracking
Track ad events (impressions, clicks).

```bash
curl -X POST http://localhost:8787/api/tracking \
  -H "Content-Type: application/json" \
  -d '{
    "campaignId": "campaign-123",
    "eventType": "impression",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'

# Expected response:
{
  "status": "ok",
  "trackingId": "..."
}
```

## Worker Automation Testing

### Manual Test Run

```bash
# Trigger automation manually
curl -X POST http://localhost:8787/api/test-automation

# Check the response
{
  "status": "ok",
  "message": "Automation completed"
}

# Watch worker logs
npx wrangler tail
```

### Test Components

#### News Fetching
Automation handler tests:
```bash
# Check if NEWS_API_KEY is set
echo $NEWS_API_KEY

# The worker will fetch from NewsAPI with these keywords:
# - El Paso
# - Ciudad Juárez
# - border news
# - New Mexico
# - Las Cruces
```

#### Translation
DeepL translation test:
```bash
curl -X POST https://api-free.deepl.com/v1/translate \
  -H "Authorization: DeepL-Auth-Key $DEEPL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Sample text to translate",
    "source_lang": "EN",
    "target_lang": "ES"
  }'
```

#### Sanity Publishing
Verify Sanity credentials:
```bash
# Check environment variables
echo "Project: $SANITY_PROJECT_ID"
echo "Dataset: $SANITY_DATASET"
echo "Token set: ${SANITY_API_TOKEN:0:10}..."
```

## Page Testing

### Web App Pages

#### Homepage
```bash
# English
curl http://localhost:3000/en | grep -i "citybeat"

# Spanish
curl http://localhost:3000/es | grep -i "citybeat"
```

#### Briefs Page
```bash
curl http://localhost:3000/en/briefs | grep -i "brief"
```

#### Privacy Policy
```bash
curl http://localhost:3000/en/privacy | grep -i "privacy"
```

#### Terms of Service
```bash
curl http://localhost:3000/en/terms | grep -i "terms"
```

#### Dashboard
```bash
curl http://localhost:3000/en/dashboard | grep -i "dashboard"
```

#### Account Settings
```bash
curl http://localhost:3000/en/account | grep -i "account"
```

### Ads App Pages

#### Pricing
```bash
curl http://localhost:3001/en/pricing | grep -i "price"
```

#### Campaigns
```bash
curl http://localhost:3001/en/banners | grep -i "banner"
```

## End-to-End Workflow

### Complete Workflow Test

1. **Start Services**
   ```bash
   npm run dev
   # Wait for all services to be ready
   ```

2. **Test Web App**
   ```bash
   # Check pages load
   curl http://localhost:3000/en
   curl http://localhost:3000/en/privacy
   curl http://localhost:3000/en/dashboard
   ```

3. **Test APIs**
   ```bash
   # Fetch briefs
   curl http://localhost:3000/api/briefs | jq .

   # Fetch analytics
   curl http://localhost:3000/api/analytics | jq .
   ```

4. **Test Worker**
   ```bash
   # Health check
   curl http://localhost:8787/health

   # Trigger automation
   curl -X POST http://localhost:8787/api/test-automation | jq .
   ```

5. **Monitor Logs**
   ```bash
   # Watch worker logs
   npx wrangler tail

   # Watch Next.js build output
   # (visible in terminal where npm run dev was executed)
   ```

## Database Testing

### Supabase Connection

Check if Supabase client is configured:
```bash
# Test imports (in Node REPL or test file)
const { supabaseClient } = require('@citybeat/lib/supabase/client')
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
```

### Sanity Connection

Test Sanity client:
```bash
# Verify Sanity credentials
curl -H "Authorization: Bearer $SANITY_API_TOKEN" \
  https://${SANITY_PROJECT_ID}.api.sanity.io/v2021-06-07/data/query/production \
  --data-urlencode 'query=*[_type == "brief"]'
```

## Integration Testing

### Service Integration Matrix

| Service | Auth | API | Database | Status |
|---------|------|-----|----------|--------|
| Web App | - | ✓ | Mock | Ready |
| Ads App | - | ✓ | Mock | Ready |
| Worker | API Keys | ✓ | - | Ready |
| Sanity | Token | ✓ | - | Ready |
| Supabase | Key | ✓ | - | Ready |
| Stripe | Webhook | ✓ | - | Ready |

### Test Checklist

- [ ] **Web App**
  - [ ] Pages load (en and es)
  - [ ] Navigation works
  - [ ] API endpoints respond

- [ ] **Ads App**
  - [ ] Pages load (en and es)
  - [ ] Pricing page displays
  - [ ] Campaign API works

- [ ] **Worker**
  - [ ] Health check responds
  - [ ] Automation handler works
  - [ ] Tracking endpoint accepts requests
  - [ ] Logs are readable

- [ ] **Sanity**
  - [ ] Authentication works
  - [ ] Schema is defined
  - [ ] Test brief can be created

- [ ] **Supabase**
  - [ ] Connection works
  - [ ] Database schema created
  - [ ] RLS policies applied

- [ ] **Stripe**
  - [ ] Webhook signing works
  - [ ] Test transaction succeeds

- [ ] **DeepL**
  - [ ] Translation API responds
  - [ ] Character limit tracked

- [ ] **Resend**
  - [ ] Email sending works
  - [ ] Recipient verified

- [ ] **NewsAPI**
  - [ ] API key valid
  - [ ] News fetching works

## Troubleshooting

### Services Not Starting

```bash
# Check node version
node --version

# Clear dependencies and reinstall
rm -rf node_modules
npm install

# Check for port conflicts
lsof -i :3000
lsof -i :3001
lsof -i :8787
```

### API Not Responding

```bash
# Check if service is running
curl http://localhost:3000 -v

# Check logs
tail -f <service>/logs

# Verify environment variables
env | grep -i SANITY
env | grep -i SUPABASE
```

### Translation Not Working

```bash
# Verify DeepL API key
echo $DEEPL_API_KEY

# Test DeepL API directly
curl -X POST https://api-free.deepl.com/v1/translate \
  -H "Authorization: DeepL-Auth-Key $DEEPL_API_KEY" \
  -d '{"text":"test","target_lang":"ES"}'
```

### Briefs Not Publishing

```bash
# Check Sanity credentials
echo "Project: $SANITY_PROJECT_ID"
echo "Dataset: $SANITY_DATASET"

# Test Sanity query
curl -H "Authorization: Bearer $SANITY_API_TOKEN" \
  https://${SANITY_PROJECT_ID}.api.sanity.io/v2021-06-07/datasets/${SANITY_DATASET}/
```

## Next Steps

- [ ] Set up authentication (Supabase Auth)
- [ ] Connect real Sanity project
- [ ] Configure production Supabase
- [ ] Set up Stripe production account
- [ ] Deploy worker to production
- [ ] Configure monitoring and alerting
- [ ] Set up CI/CD pipeline
- [ ] Load test the application
