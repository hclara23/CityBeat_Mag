-- Add profile tracking and preference fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sms_notifications_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS review_points INTEGER DEFAULT 0;

-- Add photo URLs array to reviews table
ALTER TABLE public.directory_reviews ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT '{}'::TEXT[];

-- Create an audit table for email and SMS alerts (mock or live dispatches)
CREATE TABLE IF NOT EXISTS public.sent_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('email', 'sms')),
  recipient TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create directory claims table to manage verification codes
CREATE TABLE IF NOT EXISTS public.directory_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES public.directory_listings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  verification_method TEXT NOT NULL CHECK (verification_method IN ('email', 'phone', 'postcard')),
  verification_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'code_sent', 'verified', 'rejected')),
  email_address TEXT,
  phone_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for notifications and claims
ALTER TABLE public.sent_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directory_claims ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid duplication errors
DROP POLICY IF EXISTS "Users can view their own notifications log" ON public.sent_notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON public.sent_notifications;
DROP POLICY IF EXISTS "Users can manage their own claims" ON public.directory_claims;
DROP POLICY IF EXISTS "Admins can manage all claims" ON public.directory_claims;

-- Create Policies
CREATE POLICY "Users can view their own notifications log" ON public.sent_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" ON public.sent_notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can manage their own claims" ON public.directory_claims
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all claims" ON public.directory_claims
  FOR ALL USING (
    (SELECT is_editor FROM public.profiles WHERE id = auth.uid()) = TRUE
  );
