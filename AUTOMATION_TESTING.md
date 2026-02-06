# Brief Automation Testing Guide

This guide provides step-by-step procedures to test and verify the brief ingestion automation pipeline.

## Quick Start: Manual Test

### Development Environment

```bash
# Terminal 1: Start the worker in development mode
cd services/worker
wrangler dev

# Terminal 2: Trigger automation manually
curl -X POST http://localhost:8787/api/test-automation \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected response:
```json
{
  "status": "ok",
  "message": "Automation completed"
}
```

### Production Environment

Test via Cloudflare Dashboard:

1. Go to https://dash.cloudflare.com/
2. Navigate to **Workers** → Select `citybeat-worker`
3. Click **Triggers** tab
4. Under **Crons**, click the test button (⚡) for any cron
5. Click **Send test request**
6. Monitor **Logs** tab for execution

## Testing Checklist

### Phase 1: Environment Setup

Before testing, verify all environment variables are set:

**In Cloudflare Worker secrets:**
```bash
wrangler secret list
```

Should show:
- [ ] `SANITY_PROJECT_ID`
- [ ] `SANITY_DATASET`
- [ ] `SANITY_WRITE_TOKEN`
- [ ] `DEEPL_API_KEY`
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `RESEND_API_KEY`
- [ ] `NEWS_API_KEY`
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`

### Phase 2: Component Testing

#### Test 1: NewsAPI Connection

```bash
# Test that NewsAPI key works and returns articles
curl -s "https://newsapi.org/v2/everything?q=El%20Paso&sortBy=publishedAt&language=en&pageSize=5" \
  -H "X-API-Key: $NEWS_API_KEY" | jq '.articles | length'

# Should return a number > 0
```

**Expected**: Returns article count (e.g., `5`)

#### Test 2: DeepL Translation

```bash
# Test translation of sample text
curl -s -X POST https://api-free.deepl.com/v1/translate \
  -H "Authorization: DeepL-Auth-Key $DEEPL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "El Paso is a major city on the US-Mexico border",
    "source_lang": "EN",
    "target_lang": "ES"
  }' | jq '.translations[0].text'

# Should return Spanish translation
```

**Expected**: Returns Spanish text like `"El Paso es una ciudad importante en la frontera entre EE.UU. y México"`

#### Test 3: Sanity Connection

```bash
# Test that Sanity write token works
curl -s "https://$SANITY_PROJECT_ID.api.sanity.io/v2021-06-07/data" \
  -H "Authorization: Bearer $SANITY_WRITE_TOKEN" | jq '.datasets | length'

# Should return datasets available
```

**Expected**: Returns a number indicating datasets

#### Test 4: Supabase Connection

```bash
# Test Supabase service role key
curl -s "$SUPABASE_URL/rest/v1/" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_ANON_KEY"

# Should return service response
```

**Expected**: Returns Supabase API response (no 401/403 errors)

#### Test 5: Resend Email API

```bash
# Test that Resend API key works
curl -s -X POST "https://api.resend.com/emails" \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "noreply@citybeatmag.co",
    "to": "your-test-email@example.com",
    "subject": "Test Email",
    "html": "<p>Test email</p>"
  }' | jq '.id'

# Should return an email ID if successful
```

**Expected**: Returns email ID like `"email_xxxxx"`

### Phase 3: Full Automation Test

#### Local Test (Development)

```bash
# 1. Start worker with all env vars set
cd services/worker
wrangler dev

# 2. In another terminal, trigger automation
curl -X POST http://localhost:8787/api/test-automation \
  -H "Content-Type: application/json" \
  -d '{}'

# 3. Watch the worker terminal output for logs
```

**Expected logs**:
```
[bun] POST /api/test-automation 200
Starting brief automation...
Fetching briefs from configured sources...
Fetched X briefs from sources
Brief saved to Sanity: brief_xxxxx
Editor notification email sent successfully
```

#### Production Test

```bash
# Method 1: Use Cloudflare test button (recommended)
# 1. Go to Cloudflare Dashboard
# 2. Workers → citybeat-worker → Triggers
# 3. Click test button (⚡) next to any cron
# 4. Check Logs tab

# Method 2: Create temporary cron trigger
# 1. Edit services/worker/wrangler.toml
# 2. Add test cron at near-future time:
[[triggers.crons]]
cron = "*/2 * * * *"  # Every 2 minutes for 5 minutes
# 3. Deploy: wrangler deploy --env production
# 4. Monitor Logs tab
# 5. Remove test cron when done
```

### Phase 4: Verification Steps

After running automation (via any method), verify results:

#### Check 1: Sanity Studio

1. Go to https://studio.citybeatmag.co
2. Navigate to **Briefs** section
3. Verify recent briefs exist with:
   - [ ] **Title**: Populated with article title
   - [ ] **contentEN**: English content visible
   - [ ] **contentES**: Spanish translation visible
   - [ ] **Category**: Properly categorized (business, events, culture, news)
   - [ ] **Status**: Shows as "draft"
   - [ ] **Source**: Shows article source (e.g., "El Paso Times")
   - [ ] **Timestamp**: Recent (last few minutes)

#### Check 2: Cloudflare Logs

1. Go to https://dash.cloudflare.com/
2. Workers → citybeat-worker → **Logs** tab
3. Filter by status and check:
   - [ ] Success responses (200 status)
   - [ ] Log messages show "Starting brief automation..."
   - [ ] "Brief saved to Sanity" messages appear
   - [ ] "Editor notification email sent" messages appear
   - [ ] No ERROR messages in logs

#### Check 3: Email Notification

1. Check inbox for editors@citybeatmag.co (or configured editor email)
2. Verify email contains:
   - [ ] Brief title
   - [ ] Brief source
   - [ ] English content
   - [ ] Spanish translation (contentES)
   - [ ] Category
   - [ ] Bilingual formatting

#### Check 4: Supabase Analytics

1. Go to Supabase Dashboard
2. Navigate to **briefs** table
3. Verify recent entries:
   - [ ] Rows appear with recent timestamps
   - [ ] content_en and content_es columns populated
   - [ ] category matches Sanity
   - [ ] status is "draft"
   - [ ] sanity_id references match

#### Check 5: Stripe Webhook Verification (if configured)

1. Go to Stripe Dashboard → Developers → Webhooks
2. Find https://api.citybeatmag.co/webhooks/stripe endpoint
3. Click on endpoint to view recent attempts
4. Verify any webhook calls succeeded (200 responses)

## Common Issues and Solutions

### Issue: "NewsAPI returned 0 articles"

**Causes:**
- API key invalid or expired
- Keywords not returning results
- Rate limit exceeded

**Solutions:**
```bash
# 1. Verify API key
curl "https://newsapi.org/v2/top-headlines?country=us" \
  -H "X-API-Key: $NEWS_API_KEY"

# 2. Check rate limits
# Free tier: 100 requests per 24 hours
# Each automation run = 5 keywords = 5 requests

# 3. Try different keywords
curl "https://newsapi.org/v2/everything?q=border&sortBy=publishedAt" \
  -H "X-API-Key: $NEWS_API_KEY"
```

### Issue: "DeepL translation failed: 429"

**Cause**: Rate limit exceeded

**Solutions:**
- Free tier: 500,000 characters per month
- Each brief translation uses ~200-500 characters
- 5 runs/day × 5 briefs × 350 chars = ~8,750 chars/day
- Safe for free tier (~262,500/month)
- If hitting limits: Upgrade to Pro tier or reduce frequency

**Check usage:**
```bash
# Go to https://www.deepl.com/account/usage
```

### Issue: "Sanity save failed: Unauthorized"

**Causes:**
- Write token expired
- Write token has insufficient permissions
- Token is for wrong project

**Solutions:**
```bash
# 1. Regenerate token
# Go to Sanity → Manage → API → Tokens
# Create new token with write permissions

# 2. Verify token format
echo $SANITY_WRITE_TOKEN | wc -c
# Should be >50 characters

# 3. Test token
curl "https://$SANITY_PROJECT_ID.api.sanity.io/v2021-06-07/data" \
  -H "Authorization: Bearer $SANITY_WRITE_TOKEN"
```

### Issue: "Supabase insert failed"

**Causes:**
- Connection string incorrect
- Service role key invalid
- Schema mismatch

**Solutions:**
```bash
# 1. Verify connection
curl "$SUPABASE_URL/rest/v1/briefs?limit=1" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

# 2. Check table schema
# Go to Supabase Dashboard → SQL Editor
# Run: SELECT * FROM briefs LIMIT 1;

# 3. Verify columns match (snake_case in DB):
# sanity_id, title, content_en, content_es, category, source, published_at, status
```

### Issue: "Editor email not received"

**Causes:**
- Resend API key invalid
- Email address typo
- Email in spam folder

**Solutions:**
```bash
# 1. Test Resend directly
curl -X POST "https://api.resend.com/emails" \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "noreply@citybeatmag.co",
    "to": "your-email@example.com",
    "subject": "Test",
    "html": "<p>Test</p>"
  }'

# 2. Check Resend logs at https://resend.com/emails

# 3. Verify editor email in code:
# services/worker/src/handlers/automation.ts:276
# Should be: editors@citybeatmag.co
```

## Monitoring the Automation Schedule

### View Recent Executions

**Cloudflare Logs**:
1. Dashboard → Workers → citybeat-worker → Logs
2. Filter by:
   - Status: Success (green checkmark)
   - Time range: Last 24 hours
   - Search: "brief automation"

**Expected daily pattern**:
```
2024-02-04 07:00:15 ✓ Starting brief automation...
2024-02-04 10:00:12 ✓ Starting brief automation...
2024-02-04 13:00:18 ✓ Starting brief automation...
2024-02-04 16:00:09 ✓ Starting brief automation...
2024-02-04 19:00:14 ✓ Starting brief automation...
```

### Performance Metrics

Monitor execution time:

1. Each automation run should complete in **< 30 seconds**
2. Typical breakdown:
   - NewsAPI fetch: 2-5 seconds
   - DeepL translation: 3-8 seconds (per brief)
   - Sanity save: 1-2 seconds (per brief)
   - Supabase insert: 1-2 seconds (per brief)
   - Email send: 1 second
   - **Total**: 10-30 seconds for 5 briefs

**If slow:**
- Reduce number of briefs fetched
- Parallelize API calls
- Cache translations

## Debugging Tips

### Enable Verbose Logging

Add debug logs to `services/worker/src/handlers/automation.ts`:

```typescript
console.log('Fetching briefs for keyword:', keyword)
console.log('Found articles:', data.articles.length)
console.log('Translation response:', result)
console.log('Sanity mutation:', JSON.stringify(mutation, null, 2))
```

### Test Individual Functions

Create test files in `services/worker/src/handlers/test/`:

```typescript
// test/automation.test.ts
import { fetchBriefs } from '../automation'

// Run locally with:
// npx ts-node test/automation.test.ts
```

### Monitor External API Status

Check status pages for integrations:
- **NewsAPI**: https://newsapi.org/
- **DeepL**: https://www.deepl.com/docs-api
- **Sanity**: https://status.sanity.io/
- **Supabase**: https://status.supabase.com/
- **Resend**: https://www.resend.com/ (check status in dashboard)

## Performance Optimization

### If Briefs Taking Too Long

**Option 1: Parallelize API Calls**
```typescript
// Current: Sequential (slow)
for (const brief of briefs) {
  await translateBrief(brief)
}

// Faster: Parallel (max 10 concurrent)
await Promise.all(
  briefs.map(brief => translateBrief(brief))
)
```

### If Rate Limits Exceeded

**Option 1: Reduce Frequency**
- Change from 5x daily to 3x daily
- Update cron times in wrangler.toml

**Option 2: Upgrade API Tiers**
- DeepL Free → Pro (higher character limit)
- NewsAPI Free → Paid (higher request limit)

### If Emails Not Sending

**Option 1: Add Retry Logic**
```typescript
async function sendWithRetry(email, template, env, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await sendEmail(email, template, env)
    } catch (error) {
      if (i < maxRetries - 1) await new Promise(r => setTimeout(r, 1000))
    }
  }
}
```

## Success Criteria

Automation is working correctly when:

- ✅ Manual trigger returns `{ status: "ok" }`
- ✅ Cron jobs execute at expected times (every 5 times daily)
- ✅ Briefs appear in Sanity within 1 minute of execution
- ✅ Both contentEN and contentES populated
- ✅ Editor emails received with bilingual content
- ✅ Supabase entries logged with matching data
- ✅ No error logs in Cloudflare dashboard
- ✅ All external API integrations responding successfully

## Next Steps

After confirming all tests pass:

1. **Monitor for 24 hours**: Ensure all 5 daily runs execute
2. **Check data quality**: Verify briefs are correctly categorized and translated
3. **Gather feedback**: Ask editors if notifications are helpful
4. **Optimize schedule**: Adjust times if needed based on traffic
5. **Enable alerts**: Set up monitoring for failures

## Support

For issues or questions:
- Check `AUTOMATION_SCHEDULE_GUIDE.md` for detailed reference
- Review Cloudflare Worker logs for error details
- Verify all environment variables are set correctly
- Test individual API components (NewsAPI, DeepL, etc.) in isolation
