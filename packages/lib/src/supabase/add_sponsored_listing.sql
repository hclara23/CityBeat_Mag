-- Add sponsored listing flag to directory_listings
-- Sponsored listings appear at the very top of search results above premium and basic tiers.
ALTER TABLE public.directory_listings ADD COLUMN IF NOT EXISTS is_sponsored BOOLEAN DEFAULT FALSE;

-- Add index for faster ordering queries
CREATE INDEX IF NOT EXISTS idx_directory_is_sponsored ON public.directory_listings(is_sponsored);

-- Allow admin editors to update the is_sponsored flag
-- (Covered by existing Admin CRUD policy on directory_listings)
