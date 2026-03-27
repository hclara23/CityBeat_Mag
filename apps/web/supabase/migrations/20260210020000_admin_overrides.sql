-- ============================================================
-- CityBeat: RLS Admin Override Patch
-- Purpose:
--   - Allow admins to manage content/campaigns across creators
--   - Prevent "admin can't fix editor content" and webhook support issues
-- Notes:
--   - Assumes helper functions exist in public schema:
--       public.user_role(), public.is_admin(), public.is_editor(), public.is_advertiser()
-- ============================================================

-- ============================
-- ARTICLES
-- ============================

-- Replace policy so editors can update their own, admins can update any
DROP POLICY IF EXISTS "Editors update articles" ON public.articles;

CREATE POLICY "Editors update articles" ON public.articles
  FOR UPDATE
  USING (
    public.is_editor()
    AND (public.articles.created_by = auth.uid() OR public.is_admin())
  );

-- Replace policy so editors can create, admins can create on behalf of others if needed
DROP POLICY IF EXISTS "Editors create articles" ON public.articles;

CREATE POLICY "Editors create articles" ON public.articles
  FOR INSERT
  WITH CHECK (
    public.is_editor()
    AND (public.articles.created_by = auth.uid() OR public.is_admin())
  );

-- ============================
-- ARTICLE_TRANSLATIONS
-- ============================

-- Allow editors/admins to insert translations for any article (admin override)
DROP POLICY IF EXISTS "Editors write article translations" ON public.article_translations;

CREATE POLICY "Editors write article translations" ON public.article_translations
  FOR INSERT
  WITH CHECK (
    public.is_editor()
    AND EXISTS (
      SELECT 1
      FROM public.articles a
      WHERE a.id = public.article_translations.article_id
    )
  );

-- Allow editors/admins to update translations
DROP POLICY IF EXISTS "Editors update article translations" ON public.article_translations;

CREATE POLICY "Editors update article translations" ON public.article_translations
  FOR UPDATE
  USING (public.is_editor());

-- ============================
-- SPONSORS
-- ============================

-- Admin override: allow admins to update any sponsor
-- (Useful when advertisers need support or sponsor ownership corrections)
DROP POLICY IF EXISTS "Admins update all sponsors" ON public.sponsors;

CREATE POLICY "Admins update all sponsors" ON public.sponsors
  FOR UPDATE
  USING (public.is_admin());

-- ============================
-- AD_CAMPAIGNS
-- ============================

-- Admin override: allow admins to update any campaign
DROP POLICY IF EXISTS "Admins update all campaigns" ON public.ad_campaigns;

CREATE POLICY "Admins update all campaigns" ON public.ad_campaigns
  FOR UPDATE
  USING (public.is_admin());

-- ============================
-- AD_CREATIVES
-- ============================

-- Admin override: admins can manage creatives (insert/update/delete)
-- Helpful for correcting broken URLs, assets, or emergency takedowns.
DROP POLICY IF EXISTS "Admins manage creatives" ON public.ad_creatives;

CREATE POLICY "Admins manage creatives" ON public.ad_creatives
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
