export interface Author {
  id: string;
  name: string;
  role: string;
  avatar: string;
  bio: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  color: string;
}

export interface Story {
  id: string;
  title: string;
  dek: string;
  slug: string;
  category: Category;
  author: Author;
  date: string;
  readTime: string;
  heroImage: string;
  content: string; // HTML or Markdown string for mock
  isSponsored: boolean;
  sponsorName?: string;
  sponsorLogo?: string;
  featured?: boolean;
}

export interface CityEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  price: string;
  category: string;
  image: string;
  description: string;
  coordinates?: { lat: number; lng: number };
}

export interface NewsletterIssue {
  id: string;
  title: string;
  date: string;
  previewText: string;
  coverImage: string;
}

export interface AdCampaign {
  id: string;
  clientName: string;
  placement: "homepage_banner" | "sidebar" | "newsletter" | "sponsored_post";
  status: "active" | "pending" | "completed";
  impressions: number;
  clicks: number;
  cost: number;
}
