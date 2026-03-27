# CityBeatMag.co (Slice 3)

## Requirements
- Node.js 18+
- pnpm
- Supabase CLI
- PocketBase (`pocketbase.exe` included for local dev)

## New Features
- **Bilingual Content**: Full support for English and Spanish articles with dynamic routing.
- **Article Integration**: Automatic syncing from local assets to PocketBase.
- **Dynamic Ad Placements**: Configurable ad slots managed via Supabase.
- **Framer Motion Animations**: Polished page transitions and scroll effects.

## Architecture
- **Frontend**: Next.js 15+ (App Router)
- **Primary DB (Auth/Ads)**: Supabase
- **Content DB (Articles)**: PocketBase
- **Styling**: Tailwind CSS
1. Install dependencies
```powershell
pnpm install
```

2. Create `.env.local`
```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

3. Link Supabase project
```powershell
supabase link --project-ref YOUR_PROJECT_ID
```

4. Apply migrations
```powershell
supabase db push
```

5. Create storage buckets
- `articles` (public)
- `ads` (public)

6. Seed minimum data (categories + ad placement)
```sql
INSERT INTO categories (slug, name_en, name_es, description_en, description_es)
VALUES
  ('politics', 'Politics', 'Politica', 'Local political news', 'Noticias politicas locales'),
  ('arts', 'Arts & Culture', 'Artes y Cultura', 'Arts coverage', 'Cobertura de artes'),
  ('sports', 'Sports', 'Deportes', 'Sports news', 'Noticias de deportes');

INSERT INTO ad_placements (key, name, size, page_context)
VALUES ('article_inline', 'Article Inline', '728x90', 'article')
ON CONFLICT (key) DO NOTHING;
```

7. Create an admin + advertiser user
- Supabase Dashboard > Auth > Users: create accounts
- Run in SQL editor:
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'admin@citybeat.local';
UPDATE profiles SET role = 'advertiser' WHERE email = 'advertiser@citybeat.local';
```

## Locale Routing
- Public routes are locale-scoped: `/en/...` and `/es/...`
- Root `/` redirects to `/en`
- Category page: `/[locale]/category/[slug]`
- Article page: `/[locale]/article/[slug]`
- Fallback: if a translation is missing, English is used

## Adding Translations
- Admin create/edit requires both EN and ES fields
- Rows are saved in `article_translations` for `locale='en'` and `locale='es'`
- If a locale is missing, UI falls back to English for public pages

## Stripe + Edge Functions (Test Mode)
1. Set Edge Function secrets
```powershell
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

2. Deploy functions
```powershell
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
supabase functions deploy ad-click
supabase functions deploy activate-campaigns
```

3. Register webhook in Stripe Dashboard
- Endpoint URL:
  `https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook`
- Event: `checkout.session.completed`

4. Create a sponsor record for the advertiser in Supabase
```sql
INSERT INTO sponsors (name, created_by)
VALUES ('Test Sponsor', '<advertiser-user-uuid>');
```

## Run locally
```powershell
pnpm dev
```

## Build
```powershell
pnpm build
```

## Routes (Slice 3)
- `/en` and `/es` Latest published articles
- `/en/category/[slug]` and `/es/category/[slug]`
- `/en/article/[slug]` and `/es/article/[slug]`
- `/auth/sign-in` Supabase Auth sign-in
- `/admin` Admin console
- `/admin/articles` Article list
- `/admin/articles/new` Create bilingual article
- `/admin/articles/[id]` Edit bilingual article
- `/portal` Advertiser overview
- `/portal/campaigns` Campaign list
- `/portal/campaigns/new` Create + pay campaign

## Deployment Pipeline (Git -> Vercel)

The project is configured for automatic deployment via Vercel:

1. **GitHub Repository**: Always push to `https://github.com/hclara23/CityBeat_Mag`.
2. **Vercel Integration**: The repository is linked to `city-beat-mag.vercel.app`.
3. **Automatic Builds**: Any push to the `main` branch triggers a new production build.

### Production Environment Variables (Required in Vercel)
For the site to function correctly in production, set these variables in the Vercel Dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_POCKETBASE_URL` (Pointer to your hosted PocketBase instance)

## Development Workflow
1. Start PocketBase: `.\pocketbase.exe serve`
2. Start Next.js: `pnpm dev`
3. Push changes: `git push origin main`

## Notes
- Ad clicks are tracked via the `ad-click` Edge Function only.
- Public ad rendering uses active campaigns in `ad_campaigns`.
- No Stripe live mode or ads analytics beyond clicks in Slice 3.
