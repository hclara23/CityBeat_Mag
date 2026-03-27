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
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT auth.user_role() = 'admin'
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION is_editor()
RETURNS BOOLEAN AS $$
  SELECT auth.user_role() IN ('admin', 'editor')
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION is_advertiser()
RETURNS BOOLEAN AS $$
  SELECT auth.user_role() IN ('admin', 'advertiser')
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