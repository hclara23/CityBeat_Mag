-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  company_name TEXT,
  phone_number TEXT,
  avatar_url TEXT,
  locale TEXT DEFAULT 'en',
  is_advertiser BOOLEAN DEFAULT FALSE,
  is_editor BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Advertisements/Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  landing_url TEXT,
  budget DECIMAL(10, 2) NOT NULL DEFAULT 0,
  spent DECIMAL(10, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics events
CREATE TABLE IF NOT EXISTS analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_ip TEXT,
  user_agent TEXT,
  referer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Impressions
CREATE TABLE IF NOT EXISTS impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  impression_date DATE NOT NULL,
  count INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clicks
CREATE TABLE IF NOT EXISTS clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  click_date DATE NOT NULL,
  count INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversions
CREATE TABLE IF NOT EXISTS conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  conversion_date DATE NOT NULL,
  count INT NOT NULL DEFAULT 1,
  revenue DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT UNIQUE,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  price_per_month DECIMAL(10, 2),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment history
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  stripe_charge_id TEXT UNIQUE,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ad purchases (link between Stripe checkout sessions and advertisers)
CREATE TABLE IF NOT EXISTS ad_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  advertiser_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  advertiser_email TEXT NOT NULL,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  website TEXT,
  ad_type TEXT NOT NULL,
  billing_cycle TEXT,
  amount_total INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Brief submissions
CREATE TABLE IF NOT EXISTS brief_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sanity_id TEXT UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  status TEXT DEFAULT 'draft',
  language TEXT DEFAULT 'en',
  source TEXT,
  submitted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_campaigns_advertiser ON campaigns(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON campaigns(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_analytics_campaign ON analytics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics(event_date);
CREATE INDEX IF NOT EXISTS idx_impressions_campaign_date ON impressions(campaign_id, impression_date);
CREATE INDEX IF NOT EXISTS idx_clicks_campaign_date ON clicks(campaign_id, click_date);
CREATE INDEX IF NOT EXISTS idx_conversions_campaign_date ON conversions(campaign_id, conversion_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_advertiser ON subscriptions(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payments_advertiser ON payments(advertiser_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_ad_purchases_email ON ad_purchases(advertiser_email);
CREATE INDEX IF NOT EXISTS idx_ad_purchases_status ON ad_purchases(payment_status);
CREATE INDEX IF NOT EXISTS idx_ad_purchases_stripe_customer ON ad_purchases(stripe_customer_id);

-- Enable row-level security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_purchases ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for campaigns
CREATE POLICY "Advertisers can view their own campaigns" ON campaigns
  FOR SELECT USING (auth.uid() = advertiser_id);

CREATE POLICY "Advertisers can create campaigns" ON campaigns
  FOR INSERT WITH CHECK (auth.uid() = advertiser_id);

CREATE POLICY "Advertisers can update their own campaigns" ON campaigns
  FOR UPDATE USING (auth.uid() = advertiser_id);

-- RLS Policies for analytics
CREATE POLICY "Advertisers can view their campaign analytics" ON analytics
  FOR SELECT USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE advertiser_id = auth.uid()
    )
  );

-- RLS Policies for subscriptions
CREATE POLICY "Advertisers can view their subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid() = advertiser_id);

-- RLS Policies for ad_purchases
CREATE POLICY "Advertisers can view their ad purchases" ON ad_purchases
  FOR SELECT USING (auth.uid() = advertiser_id);

CREATE POLICY "Public insertion for ad purchases (webhook)" ON ad_purchases
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Advertisers can update their ad purchases" ON ad_purchases
  FOR UPDATE USING (auth.uid() = advertiser_id);
