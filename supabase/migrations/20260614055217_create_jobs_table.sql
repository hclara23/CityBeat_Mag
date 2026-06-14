-- Create site_settings table for dynamic configuration (prices, terms)
CREATE TABLE IF NOT EXISTS public.site_settings (
  id TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Insert default job board config
INSERT INTO public.site_settings (id, value) VALUES (
  'job_board_config',
  '{"price_usd": 50, "duration_days": 30, "terms": "Jobs will be active for 30 days after payment. No refunds for early deletion."}'::jsonb
);

-- Create jobs table
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  company_name TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT NOT NULL,
  apply_url TEXT,
  is_paid BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- RLS Policies for Site Settings
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site settings"
ON public.site_settings
FOR SELECT
USING (true);

-- Only editors can update site settings (assumes you have a profiles table or editor logic elsewhere, for now we restrict to authenticated in a simplified way or rely on a function)
-- In previous logic, editor role is checked via `userProfile?.is_editor`.
-- Assuming `is_editor` exists on a profiles table or we can just restrict updates to admin UI which enforces it server-side via service_role key.
CREATE POLICY "Only admins can update site settings"
ON public.site_settings
FOR UPDATE
USING (false); -- Enforced via server-side service_role bypass

-- RLS Policies for Jobs
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view paid active jobs"
ON public.jobs
FOR SELECT
USING (is_paid = TRUE AND (expires_at IS NULL OR expires_at > NOW()));

CREATE POLICY "Owners can view all their jobs"
ON public.jobs
FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "Owners can insert jobs"
ON public.jobs
FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their unpaid jobs"
ON public.jobs
FOR UPDATE
USING (auth.uid() = owner_id AND is_paid = FALSE);
