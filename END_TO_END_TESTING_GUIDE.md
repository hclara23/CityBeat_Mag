# End-to-End Testing Guide: Brief Automation Workflow

This guide provides step-by-step procedures to test the complete brief automation pipeline: fetch → translate → save to Sanity → send email → log to Supabase.

## Overview of Complete Workflow

```
1. Manual Trigger via Test Endpoint
   ↓
2. NewsAPI Fetch (5 keywords, up to 25 articles)
   ├─ El Paso
   ├─ Ciudad Juárez
   ├─ border news
   ├─ New Mexico
   └─ Las Cruces
   ↓
3. For Each Article:
   ├─ 3a. Categorize (business, events, culture, or news)
   ├─ 3b. Translate EN → ES (via DeepL)
   ├─ 3c. Save to Sanity as Draft
   │       ├─ contentEN: English content
   │       ├─ contentES: Spanish translation
   │       ├─ title, source, category
   │       └─ status: "draft"
   ├─ 3d. Log to Supabase (analytics)
   └─ 3e. Send Editor Notification Email (bilingual)
   ↓
4. Verification in Multiple Systems
   ├─ Sanity Studio (new briefs visible)
   ├─ Supabase (database entries logged)
   ├─ Email (editors@citybeatmag.co received notification)
   └─ Cloudflare Logs (execution logged)
```

## Prerequisites

### Environment Variables Set

Verify all required environment variables are configured in your `.env.local` or Cloudflare Worker secrets:

```bash
# NewsAPI
NEWS_API_KEY=your_newsapi_key_here

# DeepL
DEEPL_API_KEY=your_deepl_key_here

# Sanity
SANITY_PROJECT_ID=your_project_id
SANITY_DATASET=production
SANITY_WRITE_TOKEN=your_write_token

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Resend (Email)
RESEND_API_KEY=your_resend_api_key
```

### Services Online

- [ ] NewsAPI responding at https://newsapi.org/v2/everything
- [ ] DeepL API responding at https://api-free.deepl.com/v1/translate
- [ ] Sanity API responding at https://{projectId}.api.sanity.io
- [ ] Supabase API responding at {supabaseUrl}/rest/v1
- [ ] Resend API responding at https://api.resend.com/emails
- [ ] Cloudflare Worker deployed and running

### Access Required

- [ ] Sanity Studio login credentials
- [ ] Supabase Dashboard access
- [ ] Email access to editors@citybeatmag.co or test email account
- [ ] Cloudflare Dashboard access
- [ ] NewsAPI account with active key

## Part 1: Setup Development Environment

### Step 1a: Start the Worker Locally

```bash
# Navigate to worker directory
cd services/worker

# Install dependencies
npm install

# Start worker in development mode
wrangler dev
```

**Expected Output**:
```
▲ [wrangler] Starting local server...
▲ [wrangler] Listening at http://localhost:8787
```

This starts the worker at `http://localhost:8787` with live reload enabled.

### Step 1b: Verify Health Check

In another terminal, test the health endpoint:

```bash
curl http://localhost:8787/health
```

**Expected Output**:
```
OK
```

If you don't see "OK", the worker isn't running correctly. Check the terminal where you ran `wrangler dev` for errors.

## Part 2: Trigger Manual Automation

### Step 2: Execute Test Endpoint

In a separate terminal, trigger the brief automation:

```bash
curl -X POST http://localhost:8787/api/test-automation \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Output** (Success):
```json
{
  "status": "ok",
  "message": "Automation completed"
}
```

**Expected Output** (Error):
```json
{
  "status": "error",
  "message": "Error details here"
}
```

If you get an error, check the worker terminal for detailed logs about what failed.

### Step 2b: Monitor Worker Logs

In the worker terminal (from Step 1a), watch for these log messages in order:

```
Starting brief automation...
Fetching briefs from configured sources...
Fetching from RSS: El Paso Times
Fetching from RSS: ABC 7 News
Fetching from RSS: KVIA News
Fetched X briefs from sources
Brief saved to Sanity: brief_xxxxxxxxxxxxx
Editor notification email sent successfully
Processed X briefs
```

**Count Expected Logs**: You should see "Brief saved to Sanity" and "Editor notification email sent successfully" messages repeated for each brief fetched (typically 2-10 briefs depending on NewsAPI results).

## Part 3: Verify Sanity CMS

### Step 3a: Login to Sanity Studio

1. Go to https://studio.citybeatmag.co (or your Sanity studio URL)
2. Login with your credentials
3. Navigate to **Briefs** section in the sidebar
4. Look at the **Recent** tab or **Drafts** filter

### Step 3b: Inspect Recent Brief(s)

You should see **new draft briefs** with very recent timestamps (within the last few minutes).

For each brief, verify:

**Title**: ✓ Should be populated with news article title
- Example: "El Paso Business District Announces New Development"

**contentEN**: ✓ Should contain English text
- Example: "The El Paso business community celebrated today as developers announced a $50M project..."

**contentES**: ✓ Should contain Spanish translation
- Example: "La comunidad empresarial de El Paso celebró hoy mientras los desarrolladores anunciaron un proyecto de $50M..."

**Category**: ✓ Should be one of: business, events, culture, news
- Example: "business"

**Source**: ✓ Should show news source
- Example: "El Paso Times" or other NewsAPI source

**Status**: ✓ Must be "draft" (not published)

**Timestamp**: ✓ Should be very recent (within last few minutes)

### Step 3c: Check Translation Quality

Read both contentEN and contentES side-by-side to verify translation quality. The Spanish should be:
- Contextually accurate
- Not machine-translated gibberish
- Maintaining original meaning

### Step 3d: Count Briefs

Count the number of new briefs created. This should match the number logged in the worker terminal.

**Expected Result**: 2-10 new draft briefs in Sanity

## Part 4: Verify Supabase Logging

### Step 4a: Access Supabase Dashboard

1. Go to https://supabase.com and login
2. Select your project
3. Click **SQL Editor** in left sidebar
4. Execute this query:

```sql
SELECT * FROM briefs
ORDER BY created_at DESC
LIMIT 5;
```

### Step 4b: Inspect Results

You should see new rows in the `briefs` table with:

| Field | Expected Value |
|-------|-----------------|
| `sanity_id` | UUID from Sanity (e.g., "brief_abc123...") |
| `title` | News article title |
| `content_en` | English content |
| `content_es` | Spanish translation |
| `category` | One of: business, events, culture, news |
| `source` | News source name |
| `published_at` | Recent timestamp (within last few minutes) |
| `status` | "draft" |
| `created_at` | Should be very recent |

### Step 4c: Verify Count Matches

The number of rows added to Supabase should match:
- The count in the worker logs
- The count of briefs in Sanity
- The count of emails sent to editors

**Expected Result**: Same number of rows as briefs created

## Part 5: Verify Email Notifications

### Step 5a: Check Email Inbox

Check the inbox for **editors@citybeatmag.co** (or your test email configured in the code).

You should see one email per brief created, with subject like:
```
New Brief: El Paso Business District Announces New Development
```

or

```
New Brief Ingested - {brief title}
```

### Step 5b: Inspect Email Content

Open one of the emails and verify it contains:

**Required Fields**:
- [ ] Brief title
- [ ] Brief source (e.g., "El Paso Times")
- [ ] Brief category (e.g., "business")
- [ ] English content (contentEN)
- [ ] Spanish translation (contentES)
- [ ] Proper HTML formatting
- [ ] Bilingual presentation

**Expected Email Structure**:
```
Subject: New Brief: {title}

From: noreply@citybeatmag.co

Body:
---
Brief Title: [Brief title]
Source: [Source name]
Category: [Category]

English Content:
[contentEN text here]

Spanish Translation:
[contentES text here]

---
```

### Step 5c: Check Email Count

Count the number of emails received. Should match the number of briefs.

**Expected Result**: One email per brief (typically 2-10 emails)

## Part 6: Verify Cloudflare Logs

### Step 6a: Access Cloudflare Dashboard

1. Go to https://dash.cloudflare.com
2. Select **Workers** → **citybeat-worker**
3. Click **Logs** tab
4. Look for recent activity (last few minutes)

### Step 6b: Inspect Logs

You should see entries showing:

```
POST /api/test-automation 200
Manual automation test triggered
Starting brief automation...
Fetching briefs from configured sources...
Fetched X briefs from sources
Brief saved to Sanity: brief_xxxxx
Editor notification email sent successfully
Processed X briefs
```

### Step 6c: Verify Success Status

All log entries should show:
- [ ] Status: 200 (success)
- [ ] No ERROR messages
- [ ] No timeout messages
- [ ] No 429 (rate limit) messages
- [ ] No 401/403 (auth) messages

## Part 7: Comprehensive Verification Checklist

After completing all previous steps, verify the following:

### Sanity Verification
- [ ] New briefs visible in Sanity Studio
- [ ] Status set to "draft" (not published)
- [ ] Title field populated
- [ ] contentEN has English text
- [ ] contentES has Spanish text
- [ ] Category correctly assigned
- [ ] Source correctly identified
- [ ] Timestamp recent (within test time)
- [ ] No error notifications in Sanity

### Supabase Verification
- [ ] New rows in `briefs` table
- [ ] `sanity_id` matches Sanity brief ID
- [ ] `content_en` matches contentEN
- [ ] `content_es` matches contentES
- [ ] `category` matches Sanity category
- [ ] `source` matches Sanity source
- [ ] `status` is "draft"
- [ ] `published_at` is recent
- [ ] No NULL values in required fields

### Email Verification
- [ ] Emails received in inbox
- [ ] One email per brief created
- [ ] Subject line includes brief title
- [ ] Email body includes bilingual content
- [ ] Emails from noreply@citybeatmag.co
- [ ] HTML formatting looks correct
- [ ] No unsubscribe link errors
- [ ] All text readable (no encoding issues)

### Cloudflare Verification
- [ ] Logs show 200 status
- [ ] Logs show all major steps
- [ ] No error messages
- [ ] Execution time reasonable (< 30 seconds)
- [ ] No auth/permission errors
- [ ] No timeout errors

### Data Consistency Verification
- [ ] Sanity title = Supabase title
- [ ] Sanity contentEN = Supabase content_en
- [ ] Sanity contentES = Supabase content_es
- [ ] Sanity category = Supabase category
- [ ] Sanity source = Supabase source
- [ ] Sanity status = Supabase status
- [ ] Timestamp differences minimal (< 1 second)

## Part 8: Test Editor Publishing Workflow

After verifying all data is correctly ingested, test the editor publishing workflow:

### Step 8a: Publish a Brief in Sanity

1. In Sanity Studio, open one of the new draft briefs
2. Click **Publish** button
3. Confirm publication

### Step 8b: Verify Published State

Check Sanity to verify the brief is now published:
- [ ] Status changed from "draft" to "published"
- [ ] Timestamp updated if applicable
- [ ] Brief no longer in Drafts filter (if using filters)

### Step 8c: Verify Web App Display

1. Go to the web app at https://citybeatmag.co (or development URL)
2. Check the **Briefs** section
3. Verify the published brief appears

**Expected Results**:
- [ ] Brief title visible
- [ ] Brief content visible (EN or ES depending on language selection)
- [ ] Brief properly formatted
- [ ] Category displayed
- [ ] Source attributed
- [ ] Publication date shown

### Step 8d: Verify Bilingual Toggle

1. Toggle language from English to Spanish
2. Verify the brief content switches to Spanish (contentES)
3. Toggle back to English
4. Verify the brief content switches back

**Expected Results**:
- [ ] Content switches instantly
- [ ] Spanish translation is displayed correctly
- [ ] Formatting maintained in both languages

## Part 9: Repeat Testing Process

To ensure consistency and robustness, repeat the entire process 2-3 times:

### Test Run 2

```bash
# Trigger again (wait at least 30 seconds between triggers)
sleep 30
curl -X POST http://localhost:8787/api/test-automation \
  -H "Content-Type: application/json" \
  -d '{}'
```

- [ ] New briefs created (different from Test Run 1)
- [ ] All verification steps pass
- [ ] No duplicate briefs
- [ ] Different article content (since time has passed and NewsAPI results may change)

### Test Run 3

Repeat the same process to ensure automation is repeatable and reliable.

## Part 10: Error Scenarios and Recovery

### Scenario 1: No Articles Found

If automation completes but finds 0 briefs:

**Check**:
1. Is NewsAPI key valid? Test directly:
```bash
curl "https://newsapi.org/v2/everything?q=El%20Paso" \
  -H "X-API-Key: $NEWS_API_KEY"
```

2. Are keywords returning results? Try different keywords
3. Check NewsAPI rate limits (free tier: 100 requests/day)
4. Check if NewsAPI is blocking requests

**Solution**: Verify API key, check rate limits, try different search keywords

### Scenario 2: Translation Fails

If briefs are created but contentES is empty:

**Check**:
1. Is DeepL API key valid?
2. Is character limit exceeded? (Free tier: 500k/month)
3. Check DeepL status page

**Solution**: Verify DeepL key, check character usage, consider upgrading tier

### Scenario 3: Sanity Save Fails

If logs show "Failed to save brief to Sanity":

**Check**:
1. Is Sanity write token valid?
2. Does brief schema exist in Sanity?
3. Are required fields configured?

**Solution**: Verify token, check schema, ensure fields exist

### Scenario 4: Email Not Received

If Supabase shows entries but no emails received:

**Check**:
1. Is Resend API key valid?
2. Is recipient email correct?
3. Check spam folder
4. Verify Resend dashboard for failed sends

**Solution**: Verify API key, check recipient, check Resend dashboard

## Part 11: Performance Metrics

Document the performance of each automation run:

### Metrics to Track

| Metric | Target | Actual |
|--------|--------|--------|
| Total execution time | < 30 seconds | ___ |
| Briefs fetched | 5-25 | ___ |
| Articles translated | 100% | ___ |
| Sanity saves successful | 100% | ___ |
| Emails sent | 100% | ___ |
| Supabase logs created | 100% | ___ |
| Worker status code | 200 | ___ |

### Performance Analysis

If any metric is below target:

1. **Slow execution (> 30 seconds)**:
   - Check NewsAPI response time
   - Check DeepL response time
   - Consider parallelizing API calls
   - Check Sanity write token rate limits

2. **Low fetch rate (< 5 briefs)**:
   - Check if keywords return results
   - Try broader keywords
   - Verify NewsAPI is responding
   - Check rate limits

3. **Translation failures**:
   - Check character count (is limit exceeded?)
   - Check error messages in logs
   - Verify DeepL API key

## Part 12: Success Criteria

The end-to-end test is **SUCCESSFUL** when ALL of the following are true:

### Functional Requirements
- ✅ Manual trigger via `/api/test-automation` works
- ✅ NewsAPI returns articles (minimum 1, typically 5-10)
- ✅ DeepL successfully translates all articles
- ✅ Sanity drafts created for each article
- ✅ Supabase logging records each brief
- ✅ Editor emails received for each brief
- ✅ Bilingual content (EN/ES) present
- ✅ Categories correctly assigned
- ✅ Sources correctly identified

### Data Integrity Requirements
- ✅ No data loss between systems
- ✅ Sanity data matches Supabase data
- ✅ Translation quality is acceptable
- ✅ All required fields populated
- ✅ Timestamps consistent

### Performance Requirements
- ✅ Automation completes in < 30 seconds
- ✅ All external API calls succeed
- ✅ No timeout errors
- ✅ No rate limit errors

### Editor Workflow Requirements
- ✅ Drafts can be published
- ✅ Published briefs appear on web app
- ✅ Bilingual toggle works
- ✅ Content displays correctly

## Part 13: Sign-Off and Documentation

### After Successful Testing

1. **Document Results**:
   - Record number of briefs created
   - Record execution time
   - Note any issues encountered and resolved
   - Record test date and time

2. **Approval**:
   - [ ] Developer conducting test (name): _________
   - [ ] Date tested: _________
   - [ ] All success criteria met: [ ] Yes [ ] No
   - [ ] Ready for next phase: [ ] Yes [ ] No

3. **Known Issues** (if any):
   - Issue 1: _________
   - Issue 2: _________
   - (None acceptable for production launch)

## Part 14: Next Steps

After successful end-to-end testing:

1. **Production Deployment**:
   - Deploy Worker to production environment
   - Configure cron jobs for automated execution

2. **Monitoring Setup**:
   - Enable Cloudflare logs
   - Set up alerting for failures
   - Monitor for 24 hours

3. **Editor Training**:
   - Train editors on brief publishing workflow
   - Explain bilingual content review process
   - Set review guidelines

4. **Production Verification**:
   - Monitor first 24 hours of automated runs
   - Verify 5 scheduled runs execute as expected
   - Check all briefs are properly created and published

## Troubleshooting Reference

| Error | Cause | Solution |
|-------|-------|----------|
| No briefs created | NewsAPI returning 0 results | Check API key, try different keywords |
| Translation empty | DeepL rate limit exceeded | Check character usage, upgrade tier |
| Sanity save fails | Auth token invalid | Regenerate write token |
| Email not received | Invalid recipient | Check email address in code |
| Worker logs don't appear | Worker not running | Run `wrangler dev` |
| CORS errors | Origin not allowed | Check Sanity/Supabase CORS config |
| 429 errors | Rate limit exceeded | Wait before retrying, upgrade plan |
| 401/403 errors | Invalid credentials | Verify all API keys |

## Support Resources

- **Cloudflare Workers**: https://developers.cloudflare.com/workers/
- **NewsAPI**: https://newsapi.org/docs
- **DeepL API**: https://www.deepl.com/docs-api
- **Sanity**: https://www.sanity.io/docs
- **Supabase**: https://supabase.com/docs
- **Resend**: https://resend.com/docs

---

**Test Completed**: Date _____ | Tester _____ | Status: ☐ PASS ☐ FAIL
