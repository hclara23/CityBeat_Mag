-- Enable extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============ PROFILES ============
-- Maps Supabase Auth user to app roles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'visitor' CHECK (role IN ('admin', 'editor', 'advertiser', 'visitor')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_profiles_role ON profiles(role);

-- ============ AUTHORS ============
CREATE TABLE authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
,
  name TEXT NOT NULL,
  bio TEXT,
  avatar_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============ CATEGORIES ============
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
,
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_es TEXT NOT NULL,
  description_en TEXT,
  description_es TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_categories_slug ON categories(slug);

-- ============ SPONSORS ============
CREATE TABLE sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
,
  name TEXT NOT NULL,
  contact_email TEXT,
  website_url TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sponsors_created_by ON sponsors(created_by);

-- ============ ARTICLES ============
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
,
  slug TEXT NOT NULL UNIQUE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  author_id UUID NOT NULL REFERENCES authors(id) ON DELETE RESTRICT,
  cover_image_path TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  is_sponsored BOOLEAN DEFAULT FALSE,
  sponsor_id UUID REFERENCES sponsors(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_articles_slug ON articles(slug);
CREATE INDEX idx_articles_published_at ON articles(published_at DESC NULLS LAST);
CREATE INDEX idx_articles_category_id ON articles(category_id);
CREATE INDEX idx_articles_author_id ON articles(author_id);
CREATE INDEX idx_articles_is_sponsored ON articles(is_sponsored) WHERE is_sponsored = TRUE;

-- ============ ARTICLE_TRANSLATIONS ============
CREATE TABLE article_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
,
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('en', 'es')),
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(article_id, locale)
);

CREATE INDEX idx_article_translations_article_id ON article_translations(article_id);
CREATE INDEX idx_article_translations_locale ON article_translations(locale);

-- ============ AD_PLACEMENTS ============
CREATE TABLE ad_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  size TEXT NOT NULL,
  page_context TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert standard placements
INSERT INTO ad_placements (key, name, size, page_context) VALUES
  ('home_hero', 'Home Hero Banner', '1200x300', 'home'),
  ('category_banner', 'Category Banner', '980x250', 'category'),
  ('article_sidebar', 'Article Sidebar', '300x250', 'article'),
  ('article_bottom', 'Article Bottom', '728x90', 'article')
ON CONFLICT (key) DO NOTHING;

-- ============ AD_CAMPAIGNS ============
CREATE TABLE ad_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
,
  sponsor_id UUID NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
  placement_id UUID NOT NULL REFERENCES ad_placements(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'ended')),
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE NOT NULL,
  stripe_session_id TEXT,
  stripe_payment_intent_id TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ad_campaigns_sponsor_id ON ad_campaigns(sponsor_id);
CREATE INDEX idx_ad_campaigns_placement_id ON ad_campaigns(placement_id);
CREATE INDEX idx_ad_campaigns_status ON ad_campaigns(status);
CREATE INDEX idx_ad_campaigns_start_at ON ad_campaigns(start_at);
CREATE INDEX idx_ad_campaigns_end_at ON ad_campaigns(end_at);
CREATE INDEX idx_ad_campaigns_active_window ON ad_campaigns(placement_id, status) WHERE status = 'active';
CREATE INDEX idx_ad_campaigns_stripe_session_id ON ad_campaigns(stripe_session_id) WHERE stripe_session_id IS NOT NULL;

-- ============ AD_CREATIVES ============
CREATE TABLE ad_creatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
,
  campaign_id UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'image' CHECK (type IN ('image', 'video')),
  asset_path TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  alt_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ad_creatives_campaign_id ON ad_creatives(campaign_id);

-- ============ AD_EVENTS ============
CREATE TABLE ad_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
,
  campaign_id UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  placement_id UUID NOT NULL REFERENCES ad_placements(id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('impression', 'click')),
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  meta JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_ad_events_campaign_id ON ad_events(campaign_id);
CREATE INDEX idx_ad_events_placement_id ON ad_events(placement_id);
CREATE INDEX idx_ad_events_event_type ON ad_events(event_type);
CREATE INDEX idx_ad_events_occurred_at ON ad_events(occurred_at DESC);

-- ============ ENABLE RLS ON ALL TABLES ============
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_creatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_events ENABLE ROW LEVEL SECURITY;

-- ============ HELPER FUNCTIONS ============
-- ============ HELPER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT public.user_role()
 = 'admin'
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION is_editor()
RETURNS BOOLEAN AS $$
  SELECT public.user_role()
 IN ('admin', 'editor')
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION is_advertiser()
RETURNS BOOLEAN AS $$
  SELECT public.user_role()
 IN ('admin', 'advertiser')
$$ LANGUAGE SQL STABLE;

-- ============ PROFILES ============
-- Admins can read all; users can read only themselves
CREATE POLICY "Admins read all profiles" ON profiles
  FOR SELECT
  USING (is_admin());

CREATE POLICY "Users read own profile" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Admins write (create/update); users insert once on signup
CREATE POLICY "Admins manage profiles" ON profiles
  FOR ALL
  USING (is_admin());

CREATE POLICY "Users create own profile on signup" ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============ AUTHORS ============
-- Public read
CREATE POLICY "Everyone reads authors" ON authors
  FOR SELECT
  USING (TRUE);

-- Only editors/admins write
CREATE POLICY "Editors write authors" ON authors
  FOR INSERT
  WITH CHECK (is_editor());

CREATE POLICY "Editors update authors" ON authors
  FOR UPDATE
  USING (is_editor());

-- ============ CATEGORIES ============
-- Public read
CREATE POLICY "Everyone reads categories" ON categories
  FOR SELECT
  USING (TRUE);

-- Only admins write
CREATE POLICY "Admins write categories" ON categories
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins update categories" ON categories
  FOR UPDATE
  USING (is_admin());

-- ============ SPONSORS ============
-- Advertisers read/write own; admins read all
CREATE POLICY "Admins read all sponsors" ON sponsors
  FOR SELECT
  USING (is_admin());

CREATE POLICY "Advertisers read own sponsors" ON sponsors
  FOR SELECT
  USING (is_advertiser() AND created_by = auth.uid());

CREATE POLICY "Advertisers create sponsors" ON sponsors
  FOR INSERT
  WITH CHECK (is_advertiser() AND created_by = auth.uid());

CREATE POLICY "Advertisers update own sponsors" ON sponsors
  FOR UPDATE
  USING (is_advertiser() AND created_by = auth.uid());

-- ============ ARTICLES ============
-- Public reads only published
CREATE POLICY "Public reads published articles" ON articles
  FOR SELECT
  USING (published_at IS NOT NULL AND published_at <= NOW());

-- Editors/admins read all (including drafts)
CREATE POLICY "Editors read all articles" ON articles
  FOR SELECT
  USING (is_editor());

-- Editors/admins write
CREATE POLICY "Editors create articles" ON articles
  FOR INSERT
  WITH CHECK (is_editor() AND created_by = auth.uid());

CREATE POLICY "Editors update articles" ON articles
  FOR UPDATE
  USING (is_editor() AND created_by = auth.uid());

-- ============ ARTICLE_TRANSLATIONS ============
-- Public reads only if article is published
CREATE POLICY "Public reads published article translations" ON article_translations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM articles
      WHERE articles.id = article_translations.article_id
        AND articles.published_at IS NOT NULL
        AND articles.published_at <= NOW()
    )
  );

-- Editors/admins read all
CREATE POLICY "Editors read all article translations" ON article_translations
  FOR SELECT
  USING (is_editor());

-- Editors/admins write
CREATE POLICY "Editors write article translations" ON article_translations
  FOR INSERT
  WITH CHECK (
    is_editor() AND
    EXISTS (
      SELECT 1 FROM articles
      WHERE articles.id = article_translations.article_id
        AND articles.created_by = auth.uid()
    )
  );

CREATE POLICY "Editors update article translations" ON article_translations
  FOR UPDATE
  USING (is_editor());

-- ============ AD_PLACEMENTS ============
-- Public read (for rendering options)
CREATE POLICY "Everyone reads placements" ON ad_placements
  FOR SELECT
  USING (TRUE);

-- ============ AD_CAMPAIGNS ============
-- Public can read active campaigns (for rendering ads)
CREATE POLICY "Public reads active campaigns" ON ad_campaigns
  FOR SELECT
  USING (status = 'active' AND start_at <= NOW() AND end_at >= NOW());

-- Advertisers read/write own
CREATE POLICY "Advertisers read own campaigns" ON ad_campaigns
  FOR SELECT
  USING (is_advertiser() AND created_by = auth.uid());

CREATE POLICY "Advertisers create campaigns" ON ad_campaigns
  FOR INSERT
  WITH CHECK (is_advertiser() AND created_by = auth.uid());

CREATE POLICY "Advertisers update own campaigns" ON ad_campaigns
  FOR UPDATE
  USING (is_advertiser() AND created_by = auth.uid());

-- Admins read all
CREATE POLICY "Admins read all campaigns" ON ad_campaigns
  FOR SELECT
  USING (is_admin());

-- ============ AD_CREATIVES ============
-- Public can read active campaign creatives
CREATE POLICY "Public reads active campaign creatives" ON ad_creatives
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ad_campaigns
      WHERE ad_campaigns.id = ad_creatives.campaign_id
        AND ad_campaigns.status = 'active'
        AND ad_campaigns.start_at <= NOW()
        AND ad_campaigns.end_at >= NOW()
    )
  );

-- Advertisers read own campaign creatives
CREATE POLICY "Advertisers read own creatives" ON ad_creatives
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ad_campaigns
      WHERE ad_campaigns.id = ad_creatives.campaign_id
        AND ad_campaigns.created_by = auth.uid()
    )
  );

-- Advertisers create creatives
CREATE POLICY "Advertisers create creatives" ON ad_creatives
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ad_campaigns
      WHERE ad_campaigns.id = ad_creatives.campaign_id
        AND ad_campaigns.created_by = auth.uid()
    )
  );

-- ============ AD_EVENTS ============
-- Edge Functions (service role) insert events via policy bypass
-- Public impression tracking: allow anonymous insert with tight constraints
CREATE POLICY "Allow impression logging (tight constraints)" ON ad_events
  FOR INSERT
  WITH CHECK (
    event_type = 'impression' AND
    EXISTS (
      SELECT 1 FROM ad_campaigns
      WHERE ad_campaigns.id = ad_events.campaign_id
        AND ad_campaigns.status = 'active'
        AND ad_campaigns.start_at <= NOW()
        AND ad_campaigns.end_at >= NOW()
    )
  );

-- Admins can read all events
CREATE POLICY "Admins read all events" ON ad_events
  FOR SELECT
  USING (is_admin());

-- Advertisers can read own campaign events
CREATE POLICY "Advertisers read own events" ON ad_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ad_campaigns
      WHERE ad_campaigns.id = ad_events.campaign_id
        AND ad_campaigns.created_by = auth.uid()
    )
  );
