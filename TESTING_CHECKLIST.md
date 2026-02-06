# Quick Reference: Testing Checklist

Print this page or use as a reference during end-to-end testing.

## Pre-Test Setup (5 minutes)

- [ ] All environment variables set and verified
- [ ] Worker terminal open with `wrangler dev` running
- [ ] Sanity Studio available and logged in
- [ ] Supabase Dashboard available
- [ ] Email access ready for verification
- [ ] Cloudflare Dashboard available
- [ ] Test edge case plan (if needed)

## Test Run Execution (2-3 minutes)

- [ ] **Time Log Start**: __________

### Step 1: Trigger Test Endpoint
```bash
curl -X POST http://localhost:8787/api/test-automation \
  -H "Content-Type: application/json" \
  -d '{}'
```
- [ ] Response status: 200
- [ ] Response message: "Automation completed"

### Step 2: Monitor Worker Logs
Expected messages in order:
- [ ] "Starting brief automation..."
- [ ] "Fetching briefs from configured sources..."
- [ ] "Fetched X briefs from sources" (count: ____)
- [ ] "Brief saved to Sanity: brief_xxxxx" (multiple, one per brief)
- [ ] "Editor notification email sent successfully" (multiple)
- [ ] "Processed X briefs"

**Briefs created**: __________

## Post-Test Verification (5-10 minutes)

### Sanity Studio Check
1. Navigate to Briefs section
2. Filter by "Drafts" or sort by recent

For **each brief**, verify:
- [ ] Title: ___________________
- [ ] Category: business / events / culture / news
- [ ] Status: draft
- [ ] contentEN: [text visible] ✓ / ✗
- [ ] contentES: [text visible] ✓ / ✗
- [ ] Source: ___________________
- [ ] Timestamp: recent ✓ / ✗

**Total briefs in Sanity**: __________

### Supabase Check
1. SQL Editor → Run: `SELECT * FROM briefs ORDER BY created_at DESC LIMIT 5;`

For **each row**, verify:
- [ ] sanity_id matches Sanity ID
- [ ] title matches Sanity title
- [ ] content_en populated ✓ / ✗
- [ ] content_es populated ✓ / ✗
- [ ] category matches Sanity
- [ ] source matches Sanity
- [ ] status = "draft"
- [ ] published_at recent ✓ / ✗

**Total rows in Supabase**: __________

### Email Check
1. Check inbox for editors@citybeatmag.co

For **each email**, verify:
- [ ] Subject includes brief title
- [ ] From: noreply@citybeatmag.co
- [ ] Body includes English content ✓ / ✗
- [ ] Body includes Spanish content ✓ / ✗
- [ ] Formatting looks correct ✓ / ✗
- [ ] No encoding issues ✓ / ✗

**Total emails received**: __________

### Cloudflare Logs Check
1. Dashboard → Workers → Logs

Verify:
- [ ] Status: 200
- [ ] No ERROR entries
- [ ] No timeout entries
- [ ] Execution time: __________ seconds (target: < 30 sec)
- [ ] All major steps logged ✓ / ✗

## Count Verification

All counts should match:

| System | Count | Match ✓/✗ |
|--------|-------|-----------|
| Briefs Created (Worker logs) | ____ | ___ |
| Sanity Drafts | ____ | ___ |
| Supabase Rows | ____ | ___ |
| Emails Received | ____ | ___ |

**Match Status**: ✓ All match / ✗ Mismatch (investigate)

## Publisher Workflow Test (Optional)

If all counts match:

1. **Open a brief in Sanity Studio**
   - [ ] Brief selected: ___________________

2. **Publish the brief**
   - [ ] Clicked Publish ✓ / ✗
   - [ ] Confirmation appeared ✓ / ✗
   - [ ] Status changed to Published ✓ / ✗

3. **Verify on web app**
   - [ ] Go to https://citybeatmag.co
   - [ ] Brief visible in list ✓ / ✗
   - [ ] Title displays correctly ✓ / ✗
   - [ ] English content visible ✓ / ✗

4. **Test bilingual toggle**
   - [ ] Switch to Spanish ✓ / ✗
   - [ ] Spanish content displays ✓ / ✗
   - [ ] Switch back to English ✓ / ✗
   - [ ] English content displays ✓ / ✗

## Final Results

### Test Status

Choose one:
- [ ] **PASS** - All checks successful, no issues
- [ ] **PASS WITH NOTES** - Successful but with minor issues noted below
- [ ] **FAIL** - One or more critical issues (see below)

### Issues Encountered (if any)

**Issue 1**:
- Description: _________________________________________
- Severity: [ ] Critical [ ] Major [ ] Minor
- Resolution: _________________________________________
- Status: [ ] Resolved [ ] Pending [ ] Escalated

**Issue 2**:
- Description: _________________________________________
- Severity: [ ] Critical [ ] Major [ ] Minor
- Resolution: _________________________________________
- Status: [ ] Resolved [ ] Pending [ ] Escalated

### Performance Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Execution Time | < 30 sec | ____ sec | ✓/✗ |
| Briefs Fetched | 5-25 | ____ | ✓/✗ |
| Translation Success | 100% | ___% | ✓/✗ |
| Sanity Save Success | 100% | ___% | ✓/✗ |
| Email Send Success | 100% | ___% | ✓/✗ |
| Data Consistency | 100% | ___% | ✓/✗ |

## Sign-Off

- **Tester Name**: _________________________________________
- **Date/Time of Test**: ___________________
- **Test Duration**: _____ minutes
- **Overall Result**: ☐ PASS ☐ FAIL ☐ PASS WITH NOTES
- **Approved for Next Phase**: ☐ Yes ☐ No ☐ Pending Issue Resolution

**Notes/Comments**:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

---

## Common Issues Quick Reference

### No briefs created?
- [ ] Check if NewsAPI key is valid
- [ ] Check if API rate limit exceeded
- [ ] Verify worker logs for error message

### Sanity save failed?
- [ ] Check if write token is valid
- [ ] Check if brief schema exists
- [ ] Check worker logs for error details

### Emails not received?
- [ ] Check spam folder
- [ ] Verify recipient email in code
- [ ] Check Resend API key validity

### Translation empty?
- [ ] Check DeepL character usage
- [ ] Verify DeepL API key
- [ ] Check if tier limit exceeded

### Supabase insert failed?
- [ ] Verify service role key
- [ ] Check if briefs table exists
- [ ] Check schema matches expectations

---

**Last Updated**: 2026-02-04
**Test Template Version**: 1.0
