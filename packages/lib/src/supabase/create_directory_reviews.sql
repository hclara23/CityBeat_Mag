CREATE TABLE IF NOT EXISTS directory_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES directory_listings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE directory_reviews ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Public read reviews" ON directory_reviews;
CREATE POLICY "Public read reviews" ON directory_reviews
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON directory_reviews;
CREATE POLICY "Authenticated users can insert reviews" ON directory_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own review" ON directory_reviews;
CREATE POLICY "Users can update own review" ON directory_reviews
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin delete reviews" ON directory_reviews;
CREATE POLICY "Admin delete reviews" ON directory_reviews
  FOR ALL USING (
    (SELECT is_editor FROM public.profiles WHERE id = auth.uid()) = TRUE
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reviews_listing_id ON directory_reviews(listing_id);
