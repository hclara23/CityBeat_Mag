-- CityBeat Magazine Supabase Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Users table (for ad accounts and admin)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  company_name TEXT,
  is_advertiser BOOLEAN DEFAULT false,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Briefs table (auto-generated content)
CREATE TABLE briefs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sanity_id TEXT UNIQUE,
  title TEXT NOT NULL,
  content_en TEXT NOT NULL,
  content_es TEXT NOT NULL,
  category TEXT NOT NULL,
  source TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'published', 'scheduled'))
);

-- Translations table (tracks translation history)
CREATE TABLE translations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brief_id UUID REFERENCES briefs(id) ON DELETE CASCADE,
  original_language TEXT NOT NULL,
  target_language TEXT NOT NULL,
  original_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  translation_method TEXT DEFAULT 'deepl' CHECK (translation_method IN ('deepl', 'manual')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'review')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ads table (campaign tracking)
CREATE TABLE ads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sanity_id TEXT UNIQUE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  company_name TEXT NOT NULL,
  ad_type TEXT NOT NULL CHECK (ad_type IN ('newsletter', 'sponsored', 'banner')),
  budget DECIMAL(10, 2),
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'active', 'completed', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Page views analytics
CREATE TABLE page_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  pathname TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ad clicks analytics
CREATE TABLE ad_clicks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ad_id UUID REFERENCES ads(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ad_type TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Article reads analytics
CREATE TABLE article_reads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  time_spent_seconds INTEGER,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Newsletter signups
CREATE TABLE newsletter_signups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  locale TEXT DEFAULT 'en',
  verified BOOLEAN DEFAULT false,
  subscribed BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Subscriptions (for newsletter and ad revenue tracking)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ad_id UUID REFERENCES ads(id) ON DELETE SET NULL,
  subscription_type TEXT NOT NULL CHECK (subscription_type IN ('newsletter', 'ad_campaign')),
  start_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE,
  auto_renew BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Payment transactions
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ad_id UUID REFERENCES ads(id) ON DELETE SET NULL,
  stripe_transaction_id TEXT UNIQUE,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for better query performance
CREATE INDEX idx_briefs_category ON briefs(category);
CREATE INDEX idx_briefs_status ON briefs(status);
CREATE INDEX idx_briefs_created_at ON briefs(created_at DESC);
CREATE INDEX idx_translations_brief_id ON translations(brief_id);
CREATE INDEX idx_ads_user_id ON ads(user_id);
CREATE INDEX idx_ads_status ON ads(status);
CREATE INDEX idx_ads_created_at ON ads(created_at DESC);
CREATE INDEX idx_page_views_session_id ON page_views(session_id);
CREATE INDEX idx_page_views_created_at ON page_views(created_at DESC);
CREATE INDEX idx_ad_clicks_ad_id ON ad_clicks(ad_id);
CREATE INDEX idx_ad_clicks_session_id ON ad_clicks(session_id);
CREATE INDEX idx_article_reads_session_id ON article_reads(session_id);
CREATE INDEX idx_newsletter_signups_email ON newsletter_signups(email);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_ad_id ON payments(ad_id);
CREATE INDEX idx_payments_status ON payments(status);

-- Full text search on briefs
CREATE INDEX idx_briefs_title_search ON briefs USING GIN (to_tsvector('spanish', title));
CREATE INDEX idx_briefs_content_en_search ON briefs USING GIN (to_tsvector('english', content_en));
CREATE INDEX idx_briefs_content_es_search ON briefs USING GIN (to_tsvector('spanish', content_es));

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_briefs_updated_at BEFORE UPDATE ON briefs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_translations_updated_at BEFORE UPDATE ON translations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ads_updated_at BEFORE UPDATE ON ads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_newsletter_signups_updated_at BEFORE UPDATE ON newsletter_signups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
