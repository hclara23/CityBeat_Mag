-- Directory listings table and schema
CREATE TABLE IF NOT EXISTS directory_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  website TEXT,
  google_place_id TEXT UNIQUE,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  rating DECIMAL(3,2),
  user_ratings_total INTEGER,
  tier TEXT NOT NULL DEFAULT 'basic',
  claim_status TEXT NOT NULL DEFAULT 'unclaimed',
  image_url TEXT,
  gallery_urls TEXT[],
  social_links JSONB DEFAULT '{}'::jsonb,
  hours JSONB DEFAULT '{}'::jsonb,
  is_published BOOLEAN DEFAULT TRUE,
  stripe_subscription_id TEXT,
  claimed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE directory_listings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public read directory" ON directory_listings
  FOR SELECT USING (is_published = TRUE);

CREATE POLICY "Owners can update own listing" ON directory_listings
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Admin CRUD directory" ON directory_listings
  FOR ALL USING (
    (SELECT is_editor FROM public.profiles WHERE id = auth.uid()) = TRUE
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_directory_category ON directory_listings(category);
CREATE INDEX IF NOT EXISTS idx_directory_tier ON directory_listings(tier);
CREATE INDEX IF NOT EXISTS idx_directory_place_id ON directory_listings(google_place_id);
CREATE INDEX IF NOT EXISTS idx_directory_claim_status ON directory_listings(claim_status);
