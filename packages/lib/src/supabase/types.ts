export interface Profile {
  id: string
  email: string
  full_name: string | null
  company_name: string | null
  phone_number: string | null
  avatar_url: string | null
  locale: string
  is_advertiser: boolean
  is_editor: boolean
  is_writer: boolean
  created_at: string
  updated_at: string
}

export interface Campaign {
  id: string
  advertiser_id: string
  name: string
  description: string | null
  image_url: string | null
  landing_url: string | null
  budget: number
  spent: number
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived'
  start_date: string | null
  end_date: string | null
  created_at: string
  updated_at: string
}

export interface CampaignAnalytics {
  campaign_id: string
  total_impressions: number
  total_clicks: number
  total_conversions: number
  ctr: number
  conversion_rate: number
  total_spent: number
  roi: number
}

export interface DailyAnalytics {
  date: string
  impressions: number
  clicks: number
  conversions: number
  ctr: number
  spent: number
}

export interface Analytics {
  id: string
  campaign_id: string
  event_type: string
  event_date: string
  user_ip: string | null
  user_agent: string | null
  referer: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  created_at: string
}

export interface Subscription {
  id: string
  advertiser_id: string
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
  plan_id: string
  status: 'active' | 'past_due' | 'canceled' | 'unpaid'
  price_per_month: number | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  advertiser_id: string
  subscription_id: string | null
  stripe_charge_id: string | null
  amount: number
  currency: string
  status: 'pending' | 'succeeded' | 'failed' | 'refunded'
  description: string | null
  created_at: string
  updated_at: string
}

export interface BriefSubmission {
  id: string
  sanity_id: string | null
  title: string
  content: string
  category: string | null
  status: 'draft' | 'submitted' | 'published' | 'rejected'
  language: string
  source: string | null
  submitted_by: string | null
  created_at: string
  updated_at: string
}

export interface Impression {
  id: string
  campaign_id: string
  impression_date: string
  count: number
  created_at: string
}

export interface Click {
  id: string
  campaign_id: string
  click_date: string
  count: number
  created_at: string
}

export interface Conversion {
  id: string
  campaign_id: string
  conversion_date: string
  count: number
  revenue: number | null
  created_at: string
}

export interface Category {
  slug: string
  name_en: string
  name_es: string
  created_at: string
}

export interface Article {
  id: string
  slug: string
  title: string
  excerpt: string | null
  content: any // JSONB structure
  image_url: string | null
  author_id: string | null
  category_id: string | null
  status: 'draft' | 'pending_review' | 'published' | 'scheduled'
  language: 'en' | 'es'
  published_at: string | null
  created_at: string
  updated_at: string
  // Optional relations
  author?: Profile
  category?: Category
  tags?: Tag[]
}

export interface Tag {
  id: string
  name: string
  created_at: string
}

export interface ArticleAnalytics {
  article_id: string
  view_count: number
  unique_visitors: number
  last_viewed_at: string
}
