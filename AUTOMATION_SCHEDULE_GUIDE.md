# Cloudflare Worker Automation Schedule Guide

## Overview

CityBeat's brief ingestion automation runs on a scheduled cron job within Cloudflare Workers. This guide covers the configuration, testing, and troubleshooting of the automation schedule.

## Current Schedule

The automation runs **5 times per day** at these times:

| Local Time (Chihuahua CST/CDT) | UTC Time (always) | Cron Expression |
|--------------------------------|-------------------|-----------------|
| 1:00 AM | 7:00 AM | 0 7 * * * |
| 4:00 AM | 10:00 AM | 0 10 * * * |
| 7:00 AM | 1:00 PM | 0 13 * * * |
| 10:00 AM | 4:00 PM | 0 16 * * * |
| 1:00 PM | 7:00 PM | 0 19 * * * |

**Note**: Cron times in Cloudflare are **always in UTC**, regardless of your local timezone.

### Timezone Conversion

**Chihuahua Time** has two states:
- **CST (Central Standard Time)**: UTC-6 (November - March)
- **CDT (Central Daylight Time)**: UTC-5 (March - November, daylight saving)

To convert from Chihuahua local time to UTC:
```
Chihuahua CST time → Add 6 hours → UTC time
Chihuahua CDT time → Add 5 hours → UTC time
```

Example: 1:00 AM Chihuahua CST
```
1:00 AM + 6 hours = 7:00 AM UTC ✓
```

## Configuration

### Cron Expression Syntax

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6)
│ │ │ │ │
│ │ │ │ │
* * * * *
```

### Current wrangler.toml Configuration

```toml
[[triggers.crons]]
cron = "0 7 * * *"    # Every day at 07:00 UTC (1:00 AM Chihuahua CST)

[[triggers.crons]]
cron = "0 10 * * *"   # Every day at 10:00 UTC (4:00 AM Chihuahua CST)

[[triggers.crons]]
cron = "0 13 * * *"   # Every day at 13:00 UTC (7:00 AM Chihuahua CST)

[[triggers.crons]]
cron = "0 16 * * *"   # Every day at 16:00 UTC (10:00 AM Chihuahua CST)

[[triggers.crons]]
cron = "0 19 * * *"   # Every day at 19:00 UTC (1:00 PM Chihuahua CST)
```

## How It Works

### Automation Flow

When a scheduled cron time triggers:

```
1. Cloudflare Worker checks cron time
   ↓
2. If matched, invokes scheduled event handler
   ↓
3. handleBriefAutomation() executes in services/worker/src/index.ts
   ↓
4. fetchBriefs() gets news from NewsAPI
   ↓
5. translateBrief() translates EN → ES via DeepL
   ↓
6. saveBriefToSanity() creates draft in Sanity CMS
   ↓
7. saveBriefToSupabase() logs to analytics database
   ↓
8. notifyEditor() sends email to editors@citybeatmag.co
   ↓
9. Logs recorded in Cloudflare dashboard
```

### Handler Implementation

**File**: `services/worker/src/index.ts`

```typescript
export default {
  fetch: (request, env, ctx) => handleRequest(request, env, ctx),
  scheduled: (event, env, ctx) => handleScheduled(event, env, ctx),
}

async function handleScheduled(event, env, ctx) {
  console.log('Scheduled automation triggered')
  try {
    await handleBriefAutomation(env)
    console.log('Automation completed successfully')
  } catch (error) {
    console.error('Automation failed:', error)
  }
}
```

## Testing the Schedule

### Manual Trigger (Development)

```bash
# Test automation locally without waiting for cron time
cd services/worker
npm run dev

# In another terminal, trigger manually
curl -X POST http://localhost:8787/api/test-automation \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Manual Trigger (Production)

Use Cloudflare's test event feature:

1. Go to https://dash.cloudflare.com/
2. Navigate to **Workers** → Select `citybeat-worker`
3. Click **Triggers** tab
4. Under **Crons**, click the test button (⚡)
5. Click **Send test request**
6. Logs appear in real-time

### Scheduled Testing

Create a test cron at a near-future time to verify:

```toml
# Temporary test: Run at 15:32 UTC (9:32 AM Chihuahua CST)
[[triggers.crons]]
cron = "32 15 * * *"   # Temporary test time
```

Then deploy:
```bash
wrangler deploy --env production
```

Monitor logs as the time approaches:
1. Go to Cloudflare dashboard
2. Workers → Logs
3. Watch for automation execution at 15:32 UTC
4. Verify briefs created in Sanity

Once confirmed working, remove the test cron.

## Monitoring Automation

### View Logs

1. Go to https://dash.cloudflare.com/
2. Navigate to **Workers** → `citybeat-worker`
3. Click **Logs** tab
4. Filter by:
   - Time range
   - Status (success/error)
   - Log level

### Check Executions

**Verification Steps**:

1. **Check Cloudflare Logs**
   - Should see "Automation triggered" message
   - Should see "Briefs fetched: X" message
   - Should see "Brief saved to Sanity" message

2. **Check Sanity Studio**
   - Go to https://studio.citybeatmag.co
   - Check **Briefs** section
   - Should see new draft briefs with recent timestamps
   - Both `contentEN` and `contentES` should be populated

3. **Check Email**
   - Editors should receive email to editors@citybeatmag.co
   - Email should have bilingual content (EN and ES)
   - Subject should indicate number of briefs ingested

4. **Check Supabase**
   - Go to Supabase dashboard
   - Check `briefs` table
   - Should see new entries with automation timestamp
   - Check `translations` table for translation records

### Common Log Messages

**Success**:
```
Automation triggered at 2024-02-04T07:00:00Z
Fetched 5 briefs from sources
Translation successful: Brief about border trade
Brief saved to Sanity: brief_1234567890
Email notification sent to editors
Automation completed successfully
```

**Error**:
```
Automation failed: DeepL API error: 429
Brief save failed: Network timeout
Email notification failed: Invalid recipient
```

## Troubleshooting

### Issue: Automation Not Triggering

**Causes**:
1. Cron time in UTC, not local time (most common)
2. wrangler.toml not deployed
3. Worker disabled in Cloudflare

**Solutions**:

1. **Verify cron times are UTC**
   ```bash
   # Check current UTC time
   date -u

   # Verify cron config
   grep "cron =" services/worker/wrangler.toml
   ```

2. **Redeploy worker**
   ```bash
   wrangler deploy --env production
   ```

3. **Check worker status**
   - Go to Cloudflare dashboard
   - Workers → `citybeat-worker`
   - Verify "Enabled" status

### Issue: Briefs Not Being Created

**Possible Causes**:
- DeepL API rate limit exceeded
- Sanity write token expired
- NewsAPI key invalid
- Network issues

**Debug Steps**:

1. Check automation logs for specific error
2. Test individual components:
   ```bash
   # Test NewsAPI
   curl -H "Authorization: Bearer $NEWS_API_KEY" \
     "https://newsapi.org/v2/everything?q=El%20Paso"

   # Test DeepL
   curl -X POST https://api-free.deepl.com/v1/translate \
     -H "Authorization: DeepL-Auth-Key $DEEPL_API_KEY" \
     -d '{"text":"Test","source_lang":"EN","target_lang":"ES"}'

   # Test Sanity connection
   curl -H "Authorization: Bearer $SANITY_WRITE_TOKEN" \
     "https://api.sanity.io/v1/projects/$SANITY_PROJECT_ID"
   ```

3. Check DeepL quota usage
   - Go to https://www.deepl.com/account/usage
   - Verify free tier quota not exceeded
   - Consider upgrading if over limit

### Issue: Emails Not Sending

**Causes**:
- Resend API key invalid
- Editor email list incorrect
- Email template error

**Solutions**:

1. **Verify Resend configuration**
   ```bash
   # Test Resend API
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

2. **Check editor email address**
   - Verify in code: `editors@citybeatmag.co`
   - Confirm email is correct format
   - Test with `curl` as above

### Issue: Duplicate Briefs Created

**Cause**: Multiple automation runs triggered simultaneously

**Solution**:
- Implement idempotency check before saving
- Check if brief with same title already exists
- Add deduplication logic if needed

## Optimization

### Adjusting Schedule

To change automation times:

1. **Edit wrangler.toml**
   ```toml
   # Change to new times
   [[triggers.crons]]
   cron = "0 8 * * *"    # New time: 8 AM UTC (2 AM Chihuahua CST)
   ```

2. **Deploy**
   ```bash
   wrangler deploy --env production
   ```

3. **Verify**
   - Monitor logs at new time
   - Confirm briefs created

### Rate Limiting

If running into API rate limits:

1. **Reduce frequency** from 5x daily to 3x daily
2. **Add delays** between API calls
3. **Upgrade API tiers**:
   - DeepL: Free → Pro (higher limit)
   - NewsAPI: Free → Paid (higher limit)

### Performance Optimization

Monitor automation execution time:

1. Check logs for duration
2. If slow:
   - Reduce number of briefs fetched
   - Cache translations
   - Parallelize API calls

## Production Checklist

Before launching automation:

- [ ] wrangler.toml has 5 cron expressions
- [ ] All times are in UTC
- [ ] All environment variables set
- [ ] DeepL API key valid
- [ ] NewsAPI key valid
- [ ] Sanity write token valid
- [ ] Supabase connection working
- [ ] Resend API key valid
- [ ] Editor email configured
- [ ] Test automation runs successfully
- [ ] Briefs appear in Sanity
- [ ] Emails sent to editors
- [ ] Logs recorded in Cloudflare
- [ ] Monitoring alerts configured

## Support and Resources

- **Cloudflare Triggers**: https://developers.cloudflare.com/workers/platform/triggers/crons/
- **Cron Schedule Syntax**: https://crontab.guru/
- **UTC Time Converter**: https://www.timeanddate.com/worldclock/
- **DeepL API Docs**: https://www.deepl.com/docs-api
- **NewsAPI Docs**: https://newsapi.org/

## Changelog

### Version 1.0 (Current)
- ✅ 5x daily automation schedule configured
- ✅ UTC cron times with Chihuahua timezone notes
- ✅ Scheduled handler implementation
- ✅ Testing procedures
- ✅ Monitoring guide
- ✅ Troubleshooting guide
- ✅ Optimization suggestions

### Future Enhancements
- [ ] Slack notifications on automation failure
- [ ] Custom dashboard for automation metrics
- [ ] A/B testing different schedules
- [ ] Automated rate limit detection and adjustment
- [ ] Advanced filtering and source management
