# DeepL API Configuration Guide

## Overview

CityBeat's automated brief ingestion system uses **DeepL API** to automatically translate news briefs from English to Spanish. This ensures all content is bilingual from the moment it's ingested, supporting both EN and ES-speaking readers.

## Quick Start

### 1. Get a DeepL API Key

**Free Tier (Recommended for Development):**
- Visit: https://www.deepl.com/pro#developer
- Sign up for a free developer account
- You'll get a free tier API key for testing
- Free tier includes 500,000 characters/month

**Pro Tier (For Production):**
- Upgrade to a paid plan for higher limits
- Production deployments should use Pro tier
- Pay-as-you-go pricing

### 2. Configure the API Key

#### Local Development (.env)

1. Copy the DeepL API key
2. Add to `.env` file:
   ```
   DEEPL_API_KEY=your_deepl_api_key_here
   ```

#### Cloudflare Production

1. Get your DeepL API key from the dashboard
2. Set as Cloudflare Worker secret:
   ```bash
   wrangler secret put DEEPL_API_KEY --env production
   # Paste your key when prompted
   ```

3. Verify configuration in `wrangler.toml`:
   ```toml
   [env.production.secrets]
   DEEPL_API_KEY = ""  # Value set via wrangler secret put
   ```

### 3. Verify the Setup

Test that the DeepL API key is working by running the automation manually or checking logs:

```bash
# Development
npm run dev  # Starts local worker

# Production
wrangler deploy --env production
```

Watch for these log messages:
```
Starting brief automation...
Fetched X briefs from sources
Translation successful: [content preview]
Brief saved to Sanity: [brief_id]
```

## How It Works

### Translation Pipeline

```
1. fetchBriefs()
   ↓ Fetch from NewsAPI with keywords
   ↓ Returns: Array of Brief objects with English content

2. translateBrief() ← DeepL API called here
   ↓ Send brief.content to DeepL
   ↓ Request: { text: "English content", source_lang: "EN", target_lang: "ES" }
   ↓ Response: { translations: [{ text: "Contenido en español" }] }
   ↓ Returns: { ...brief, contentEN, contentES }

3. saveBriefToSanity()
   ↓ Create draft brief with both EN and ES content
   ↓ contentEN = original English from NewsAPI
   ↓ contentES = translated Spanish from DeepL

4. saveBriefToSupabase()
   ↓ Store briefs in analytics database

5. notifyEditor()
   ↓ Send email with both EN and ES content
```

### Code Implementation

**File:** `services/worker/src/handlers/automation.ts`

```typescript
async function translateBrief(brief: Brief, env: Env): Promise<any> {
  try {
    // Call DeepL API
    const response = await fetch('https://api-free.deepl.com/v1/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${env.DEEPL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: brief.content,           // English text
        source_lang: 'EN',             // Source language
        target_lang: 'ES',             // Target language
      }),
    })

    if (!response.ok) {
      throw new Error(`DeepL API error: ${response.statusText}`)
    }

    const result = await response.json()
    const translatedContent = result.translations[0]?.text || ''

    // Return brief with both languages
    return {
      ...brief,
      contentEN: brief.content,          // Keep original English
      contentES: translatedContent,      // Add Spanish translation
    }
  } catch (error) {
    console.error('Translation failed:', error)
    // Graceful fallback: return brief without Spanish translation
    return brief
  }
}
```

## Automation Schedule

Briefs are fetched and translated automatically at **5 times per day**:

- **07:00 AM** Chihuahua Time
- **10:00 AM** Chihuahua Time
- **1:00 PM** Chihuahua Time
- **4:00 PM** Chihuahua Time
- **7:00 PM** Chihuahua Time

Configuration in `wrangler.toml`:
```toml
[[triggers.crons]]
cron = "0 7 * * *"    # 7 AM UTC

[[triggers.crons]]
cron = "0 10 * * *"   # 10 AM UTC

[[triggers.crons]]
cron = "0 13 * * *"   # 1 PM UTC

[[triggers.crons]]
cron = "0 16 * * *"   # 4 PM UTC

[[triggers.crons]]
cron = "0 19 * * *"   # 7 PM UTC
```

**Note:** Times are in UTC. For Chihuahua Time (CST/CDT), subtract 6-7 hours depending on daylight saving.

## Data Flow in Sanity

When a brief is created by automation, it contains:

```json
{
  "_type": "brief",
  "title": "Border officials report increase in trade activity",
  "content": "English content from NewsAPI...",
  "contentEN": "English content from NewsAPI...",
  "contentES": "El contenido en español traducido por DeepL...",
  "category": "business",
  "source": "Reuters",
  "status": "draft",
  "publishedAt": "2024-02-04T14:30:00Z"
}
```

**Important:** Briefs are created with `status: "draft"`. Editors must explicitly approve and publish them (see `BRIEF_PUBLISHING_WORKFLOW.md`).

## Error Handling

### Graceful Translation Fallback

If DeepL API fails for any reason:

```typescript
catch (error) {
  console.error('Translation failed:', error)
  // Return original brief without Spanish content
  return brief
}
```

The brief will still be:
- ✅ Fetched from NewsAPI
- ✅ Saved to Sanity (with only English content)
- ✅ Saved to Supabase
- ✅ Editor notified
- ❌ Spanish translation skipped (can be added manually)

Editors can manually add Spanish content later if needed.

### Common Issues

**Issue: "DeepL API error: Unauthorized"**
- Solution: Verify API key is correct in `DEEPL_API_KEY` environment variable
- Check: Has the free tier quota been exceeded?

**Issue: "DeepL API error: 429"**
- Meaning: Rate limit exceeded
- Solution: Wait before next request (usually 60 seconds)
- For production: Consider upgrading to Pro tier

**Issue: Translation returns empty string**
- Solution: Check that source content is valid English text
- Very short content may not translate well

## Best Practices

### For Configuration
- ✅ Use Free tier for development/testing
- ✅ Use Pro tier for production deployments
- ✅ Store API key in Cloudflare secrets, never in code
- ✅ Rotate API keys periodically

### For Content Quality
- ✅ Ensure NewsAPI source is providing quality English content
- ✅ Review translated content in Sanity for accuracy
- ✅ Check that translations maintain proper tone and style
- ✅ For critical briefs, have editors review Spanish translation

### For Monitoring
- ✅ Check Worker logs for translation errors
- ✅ Monitor DeepL API usage in the dashboard
- ✅ Set up alerts if translation starts failing consistently
- ✅ Review brief creation/translation logs weekly

## Advanced Configuration

### Changing Source/Target Languages

To add additional language translations (e.g., French, Portuguese):

1. Update `translateBrief()` in `automation.ts`:
   ```typescript
   // Translate to Spanish
   const esResponse = await fetch('https://api-free.deepl.com/v1/translate', {
     body: JSON.stringify({
       text: brief.content,
       source_lang: 'EN',
       target_lang: 'ES',
     }),
   })

   // Translate to French (additional)
   const frResponse = await fetch('https://api-free.deepl.com/v1/translate', {
     body: JSON.stringify({
       text: brief.content,
       source_lang: 'EN',
       target_lang: 'FR',
     }),
   })
   ```

2. Update Brief schema in Sanity to include new language fields
3. Update brief.ts schema with `contentFR` field

### Pro Tier API Configuration

For higher volume deployments using Pro tier:

1. Change endpoint from `api-free.deepl.com` to `api.deepl.com`
2. Update API key to Pro tier key
3. Monitor costs and usage

```typescript
// Change this:
const response = await fetch('https://api-free.deepl.com/v1/translate', {

// To this:
const response = await fetch('https://api.deepl.com/v1/translate', {
```

## Integration with Other Systems

### Sanity CMS
- Briefs are created with both `contentEN` and `contentES`
- Editors can view and edit both versions before publishing
- Translations appear in the bilingual UI

### Email Notifications
- Editor notifications include both EN and ES content
- Resend sends bilingual emails to editors@citybeatmag.co

### Web App Display
- Readers can toggle between EN/ES language
- Content served from `contentEN` or `contentES` fields based on preference

## Testing

### Test Translation Locally

Create a test file `test-translation.ts`:

```typescript
const testBrief = {
  title: 'Test Article',
  content: 'The United States and Mexico have announced a new trade agreement.',
  source: 'Reuters',
  category: 'business'
}

const translated = await translateBrief(testBrief, env)
console.log('EN:', translated.contentEN)
console.log('ES:', translated.contentES)
```

### Verify in Production

1. Monitor Worker logs: https://dash.cloudflare.com → Workers
2. Check Sanity studio for new draft briefs with Spanish content
3. Review email notifications to editors@citybeatmag.co

## Support

For issues or questions:
- DeepL Documentation: https://www.deepl.com/docs-api
- Cloudflare Workers: https://developers.cloudflare.com/workers/
- Submit issues to: https://github.com/[org]/citybeat-mag/issues

## Changelog

### Version 1.0 (Current)
- ✅ DeepL API integration for EN→ES translation
- ✅ Automatic translation on brief ingestion
- ✅ Graceful fallback on translation failure
- ✅ 5x daily automation schedule
- ✅ Bilingual brief creation in Sanity

### Future Enhancements
- [ ] Support for additional languages (FR, PT, DE)
- [ ] Translation quality metrics and logging
- [ ] Manual translation request endpoint
- [ ] Translation cache to reduce API calls
- [ ] Cost tracking and alerts
