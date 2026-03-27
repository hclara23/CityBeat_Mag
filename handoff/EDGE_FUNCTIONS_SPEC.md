# CityBeat Edge Functions Specification

## Overview
Four Supabase Edge Functions (Deno runtime) handle:
1. Stripe checkout session creation
2. Stripe webhook verification and campaign activation
3. Ad click tracking and redirect
4. Daily cron job to auto-activate campaigns

---

## Function 1: `create-checkout-session`

**Purpose**: Create Stripe Checkout session for a campaign and return session URL.

**HTTP Method**: POST
**Request Path**: `/functions/v1/create-checkout-session`

### Request JSON
```json
{
  "campaign_id": "uuid",
  "amount_cents": 10000,
  "campaign_name": "Summer Sale Banner"
}
```

### Response JSON (Success)
```json
{
  "session_id": "cs_live_...",
  "url": "https://checkout.stripe.com/pay/cs_live_..."
}
```

### Response JSON (Error)
```json
{
  "error": "Campaign not found or already paid"
}
```

### Required Environment Variables
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET` (for verification elsewhere)

### Database Writes
1. Query: `SELECT * FROM ad_campaigns WHERE id = $1 AND status = 'pending'`
2. Call Stripe API to create Checkout session
3. Update: `UPDATE ad_campaigns SET stripe_session_id = $1 WHERE id = $2`

### Security Notes
- Only authenticated advertisers can call (check Supabase Auth JWT)
- Validate campaign ownership: campaign's `created_by` must match JWT `sub`
- Amount is immutable once campaign is created (hardcoded or locked on creation)
- Use service role key or authenticate via Supabase client

---

## Function 2: `stripe-webhook`

**Purpose**: Handle Stripe webhook events (payment_intent.succeeded); activate campaign.

**HTTP Method**: POST
**Request Path**: `/functions/v1/stripe-webhook`

### Request Headers
- `stripe-signature: <signature>`

### Request Body (raw Stripe event JSON)
```json
{
  "id": "evt_...",
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_...",
      "client_secret": "...",
      "metadata": {
        "campaign_id": "uuid"
      }
    }
  }
}
```

### Response JSON (Success)
```json
{
  "received": true,
  "campaign_id": "uuid",
  "new_status": "active"
}
```

### Response JSON (Error)
```json
{
  "error": "Invalid signature" / "Campaign not found" / "Already activated"
}
```

### Required Environment Variables
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Database Writes
1. Verify Stripe signature
2. Query: `SELECT * FROM ad_campaigns WHERE stripe_payment_intent_id = $1`
3. Update: `UPDATE ad_campaigns SET status = 'active' WHERE id = $1`
4. Optionally insert row in audit log

### Security Notes
- **Always** verify Stripe signature using provided secret
- Use service role (bypass RLS) to update campaign
- Return 204 No Content on success (idempotent; retry-safe)
- Return 400 on invalid signature
- Do NOT rely on campaign metadata alone; verify against DB first

---

## Function 3: `ad-click`

**Purpose**: Log ad click event and redirect to destination URL.

**HTTP Method**: GET
**Request Path**: `/api/ad-click?campaign_id=<uuid>&placement=<key>`

### Query Parameters
- `campaign_id`: UUID of campaign
- `placement`: placement key (e.g., 'home_hero')

### Response
- **Status**: 302 Redirect
- **Location**: Creative's `destination_url`

### Response JSON (Error - Status 404)
```json
{
  "error": "Campaign or creative not found"
}
```

### Database Writes
1. Query: `SELECT * FROM ad_campaigns WHERE id = $1 AND status = 'active'`
2. Query: `SELECT * FROM ad_creatives WHERE campaign_id = $1 LIMIT 1`
3. Insert: `INSERT INTO ad_events (campaign_id, placement_id, event_type, meta) VALUES ($1, $2, 'click', '{...}')`
4. Return 302 with `destination_url`

### Security Notes
- **Anonymous access allowed** (no auth required)
- **Tight query constraints**: only log clicks for active campaigns within date window
- **Redirect safety**: destination_url must be validated (no javascript: or data: URIs)
- Use public client or service role (allow all inserts via policy)
- Log user agent + IP in `meta` for debugging (optional but recommended)

---

## Function 4: `activate-campaigns`

**Purpose**: Cron job that runs daily; transitions campaigns from 'pending' to 'active' on start_at.

**HTTP Method**: POST
**Triggered by**: Supabase scheduled job (cron)

### Cron Schedule
```
0 0 * * * # Run at 00:00 UTC daily
```

### Request Headers (if called manually)
- `X-Supabase-Job-Token`: (optional; for manual invocation)

### Response JSON
```json
{
  "activated_count": 5,
  "campaigns": [
    {
      "id": "uuid",
      "placement": "home_hero",
      "start_at": "2025-02-11T00:00:00Z"
    }
  ]
}
```

### Required Environment Variables
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Database Writes
```sql
UPDATE ad_campaigns
SET status = 'active', updated_at = NOW()
WHERE status = 'pending'
  AND start_at <= NOW()
  AND end_at >= NOW()
RETURNING id, placement_id, start_at;
```

### Security Notes
- Use service role key (bypass RLS)
- **No external trigger needed** if using Supabase scheduled jobs
- Idempotent: running twice in one day is safe (no duplicates)
- Log activation count for monitoring

---

## Deployment Checklist

- [ ] All four functions have `.env` files with required vars
- [ ] Stripe webhook secret is stored securely (not in source)
- [ ] Each function has input validation
- [ ] All database queries use parameterized queries (no SQL injection)
- [ ] Edge Functions are deployed to Supabase project
- [ ] Stripe webhook endpoint is registered in Stripe Dashboard → Webhooks
- [ ] Cron job is configured in Supabase Scheduled Jobs UI