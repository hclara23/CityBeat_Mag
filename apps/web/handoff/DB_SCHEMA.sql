-- Enable extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  bio TEXT,
  avatar_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============ CATEGORIES ============
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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