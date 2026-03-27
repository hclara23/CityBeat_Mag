# CityBeat MVP Deployment Runbook

## Prerequisites
- Node.js 18+ (with pnpm installed: `npm install -g pnpm`)
- Supabase CLI: `npm install -g supabase`
- Vercel CLI: `npm install -g vercel`
- Git installed
- Stripe account (test keys ready)
- Vercel account + GitHub repo connected

---

## Step 1: Initialize Repository & Next.js App

### 1.1 Create project directory and initialize git
```powershell
cd C:\dev
mkdir CityBeatMag.co
cd CityBeatMag.co
git init
git config user.email "your@email.com"
git config user.name "Your Name"
```

### 1.2 Create Next.js app with pnpm
```powershell
pnpm create next-app@latest . --typescript --tailwind --app --eslint --import-alias "@/*" --skip-install
```

### 1.3 Install dependencies
```powershell
pnpm install
pnpm add @supabase/supabase-js @supabase/auth-helpers-nextjs stripe @stripe/react-stripe-js @stripe/stripe-js
```

### 1.4 Verify build passes
```powershell
pnpm build
```

---

## Step 2: Initialize Supabase Project

### 2.1 Create Supabase project
- Go to https://supabase.com/dashboard
- Create new project (note Region and credentials)
- Save connection string and anon key

### 2.2 Link local Supabase
```powershell
supabase link --project-ref YOUR_PROJECT_ID
```
(Enter database password when prompted)

### 2.3 Create migration directory
```powershell
supabase migration new init
```

### 2.4 Copy DB schema and RLS policies
- Copy entire contents of `DB_SCHEMA.sql` into `supabase/migrations/{timestamp}_init.sql`
- Copy entire contents of `RLS_POLICIES.sql` into the same file (append after schema)
- Or create separate migration file: `supabase migration new enable_rls`

### 2.5 Apply migrations locally
```powershell
supabase start
supabase db push
```

### 2.6 Verify RLS is enabled
```powershell
supabase db list
# Check that policies are visible
supabase db policies ls
```

---

## Step 3: Deploy Edge Functions

### 3.1 Create Edge Functions directory
```powershell
mkdir -p supabase/functions
```

### 3.2 Create create-checkout-session function
```powershell
supabase functions new create-checkout-session
```

Populate `supabase/functions/create-checkout-session/index.ts`:
```typescript
import { stripe } from 'https://esm.sh/stripe@13.0.0?target=deno';

const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

export async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const { campaign_id, amount_cents, campaign_name } = await req.json();

  // TODO: Validate auth and campaign ownership

  const sessionUrl = `${supabaseUrl}/auth/v1`;
  const token = req.headers.get('authorization')?.split(' ')[1];

  // Call Stripe API, update campaign with session_id, return checkout URL
  // See EDGE_FUNCTIONS_SPEC.md for full impl details

  return new Response(JSON.stringify({ session_id: 'cs_...', url: '...' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

### 3.3 Create stripe-webhook function
```powershell
supabase functions new stripe-webhook
```

Populate with Stripe signature verification and campaign activation logic.

### 3.4 Create ad-click function
```powershell
supabase functions new ad-click
```

Populate with ad event logging and redirect.

### 3.5 Create activate-campaigns function
```powershell
supabase functions new activate-campaigns
```

Populate with cron-triggered campaign activation.

### 3.6 Deploy Edge Functions to Supabase
```powershell
supabase functions deploy
```

Verify:
```powershell
supabase functions list
```

---

## Step 4: Configure Environment Variables

### 4.1 Create `.env.local` in Next.js project root
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_KEY
STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
```

### 4.2 For Supabase Edge Functions, set secrets
```powershell
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_test_...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_KEY
```

---

## Step 5: Set Up Stripe Webhooks

### 5.1 Get webhook endpoint URL
In Supabase Dashboard → Edge Functions, find `stripe-webhook` function URL:
```
https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook
```

### 5.2 Register webhook in Stripe Dashboard
1. Go to https://dashboard.stripe.com/webhooks
2. Create endpoint with URL above
3. Select events: `payment_intent.succeeded`
4. Copy webhook secret (add to env as `STRIPE_WEBHOOK_SECRET`)

---

## Step 6: Set Up Cron Job (activate-campaigns)

### 6.1 In Supabase Dashboard → Scheduled Jobs
1. Create new scheduled job
2. Name: `activate-campaigns`
3. Function: `activate-campaigns`
4. Cron expression: `0 0 * * *` (daily at 00:00 UTC)
5. Enable

---

## Step 7: Deploy to Vercel

### 7.1 Connect GitHub repository
```powershell
git add .
git commit -m "Initial CityBeat MVP commit"
git branch -M main
git remote add origin https://github.com/YOUR_ORG/citybeat-repo.git
git push -u origin main
```

### 7.2 Deploy via Vercel CLI
```powershell
vercel link
# Select "Link to existing project" or create new
```

### 7.3 Set environment variables in Vercel
```powershell
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add STRIPE_PUBLIC_KEY
vercel env add STRIPE_SECRET_KEY
```

Or add directly in Vercel Dashboard → Settings → Environment Variables.

### 7.4 Deploy
```powershell
vercel deploy --prod
```

---

## Step 8: Verify Migrations and Data on Production

### 8.1 Apply migrations to production
```powershell
supabase db push --linked
```

### 8.2 Seed initial data (categories, placements)
In Supabase Dashboard, run SQL:
```sql
INSERT INTO categories (slug, name_en, name_es, description_en, description_es)
VALUES
  ('politics', 'Politics', 'Política', 'Local political news', 'Noticias políticas locales'),
  ('arts', 'Arts & Culture', 'Artes y Cultura', 'Arts coverage', 'Cobertura de artes'),
  ('sports', 'Sports', 'Deportes', 'Sports news', 'Noticias de deportes');

INSERT INTO ad_placements (key, name, size, page_context)
VALUES
  ('home_hero', 'Home Hero Banner', '1200x300', 'home'),
  ('category_banner', 'Category Banner', '980x250', 'category'),
  ('article_sidebar', 'Article Sidebar', '300x250', 'article'),
  ('article_bottom', 'Article Bottom', '728x90', 'article')
ON CONFLICT (key) DO NOTHING;
```

---

## Step 9: Create Admin User

### 9.1 In Supabase Dashboard → Auth → Users
1. Create test admin user (email: admin@citybeat.local, password: temporary)
2. In PostgreSQL console, run:
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'admin@citybeat.local';
```

### 9.2 Test admin login
- Navigate to `/admin/dashboard`
- Log in with admin credentials
- Verify dashboard loads

---

## Acceptance Test Checklist

Test these end-to-end flows:

### Public Reader Flow
- [ ] Load home page, see latest 3 articles with cover images
- [ ] Load category page, see articles filtered by category
- [ ] Load article, see full content in English
- [ ] Toggle locale to Spanish, content updates
- [ ] See ad slots on all pages (if campaigns exist)
- [ ] Click ad, redirected to destination URL
- [ ] Ad event logged in `ad_events` table

### Admin/Editor Flow
- [ ] Log in as editor
- [ ] Create article with EN/ES title, excerpt, content
- [ ] Upload cover image
- [ ] Set category and author
- [ ] Publish article (set `published_at`)
- [ ] Verify article appears on home/category pages

### Advertiser Flow
- [ ] Log in as advertiser
- [ ] Create campaign with placement, date window, amount ($10.00 = 1000 cents)
- [ ] Upload creative image
- [ ] Enter destination URL
- [ ] Click "Checkout"
- [ ] Redirected to Stripe Checkout
- [ ] Complete payment with test card `4242 4242 4242 4242`
- [ ] Return to app
- [ ] Verify campaign status = 'active' in DB
- [ ] Verify ad renders on home page / category page / article

### Stripe Webhook Flow
- [ ] Create campaign as advertiser
- [ ] Proceed to Stripe Checkout
- [ ] Complete payment
- [ ] Check Stripe Dashboard → Events, see `payment_intent.succeeded`
- [ ] Verify Edge Function `stripe-webhook` was triggered (Supabase Function Logs)
- [ ] Verify campaign table updated with `stripe_payment_intent_id` and status changed to 'active'

### Build & Deployment
- [ ] `pnpm build` passes with zero errors
- [ ] Vercel deployment successful (check Vercel Dashboard)
- [ ] Production site loads without errors (browser console clean)
- [ ] All env vars loaded (test Stripe payment on live site)

---

## Post-MVP Checklist (Phase 2)

- [ ] Search feature
- [ ] Comments / Discussion
- [ ] Newsletter system
- [ ] Multi-user advertiser teams
- [ ] Advanced analytics dashboard
- [ ] Paid membership / Paywall
- [ ] Advanced animations (Framer Motion)

---

## Troubleshooting

### Issue: `pnpm build` fails
**Solution**: Check `pnpm list` for peer dependency conflicts; reinstall: `pnpm install --force`

### Issue: Supabase auth not working
**Solution**: Verify JWT secret in `.env.local`; check Supabase Auth settings for correct domain.

### Issue: Stripe webhook not firing
**Solution**: Verify webhook endpoint URL in Stripe Dashboard matches actual Edge Function URL; check Supabase Function Logs for errors.

### Issue: Ad not rendering
**Solution**: Verify campaign status = 'active', dates are correct, and creative exists; check browser console for RLS errors.

---

## Support & Documentation

- **Supabase**: https://supabase.com/docs
- **Next.js**: https://nextjs.org/docs
- **Stripe**: https://stripe.com/docs
- **Vercel**: https://vercel.com/docs