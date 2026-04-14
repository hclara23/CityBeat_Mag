import { Story, CityEvent, NewsletterIssue, AdCampaign, Category, Author } from "./types";

export const CATEGORIES: Category[] = [
  { id: "1", name: "Food & Drink", slug: "food-drink", color: "text-orange-400" },
  { id: "2", name: "Culture", slug: "culture", color: "text-purple-400" },
  { id: "3", name: "Nightlife", slug: "nightlife", color: "text-brand-neon" },
  { id: "4", name: "Borderlands", slug: "borderlands", color: "text-yellow-400" },
  { id: "5", name: "Business", slug: "business", color: "text-blue-400" },
  { id: "6", name: "Arts", slug: "arts", color: "text-pink-400" },
];

export const AUTHORS: Author[] = [
  {
    id: "1",
    name: "Elena Rodriguez",
    role: "Editor-in-Chief",
    avatar: "https://picsum.photos/seed/author1/200/200",
    bio: "Elena covers the intersection of culture and policy in the metro area.",
  },
  {
    id: "2",
    name: "Marcus Chen",
    role: "Senior Food Critic",
    avatar: "https://picsum.photos/seed/author2/200/200",
    bio: "Eating his way through the city, one taco at a time.",
  },
  {
    id: "3",
    name: "Sarah Jenkins",
    role: "Arts Reporter",
    avatar: "https://picsum.photos/seed/author3/200/200",
    bio: "Documenting the underground art scene since 2015.",
  },
];

export const STORIES: Story[] = [
  {
    id: "1",
    title: "The Neon Renaissance: Downtown's New Light",
    dek: "How a collective of artists is transforming the city skyline, one LED installation at a time.",
    slug: "neon-renaissance",
    category: CATEGORIES[5], // Arts
    author: AUTHORS[2],
    date: "2023-10-15",
    readTime: "6 min read",
    heroImage: "https://fal.media/files/monkey/o7C4_1740050785368.png",
    content: "<p>The city sleeps, but the lights don't. In the heart of the district...</p>",
    isSponsored: false,
    featured: true,
  },
  {
    id: "2",
    title: "Midnight Tacos: A Definitive Ranking",
    dek: "We stayed up until 4am to find the best al pastor in the metro area.",
    slug: "midnight-tacos",
    category: CATEGORIES[0], // Food
    author: AUTHORS[1],
    date: "2023-10-12",
    readTime: "8 min read",
    heroImage: "https://picsum.photos/seed/tacos/1200/800",
    content: "<p>There is something spiritual about a taco at 2am...</p>",
    isSponsored: false,
    featured: false,
  },
  {
    id: "3",
    title: "Future of Transit: The Hyperloop Proposal",
    dek: "Is the new transit bill a pipe dream or the future of commuting?",
    slug: "transit-future",
    category: CATEGORIES[4], // Business
    author: AUTHORS[0],
    date: "2023-10-10",
    readTime: "5 min read",
    heroImage: "https://picsum.photos/seed/train/1200/800",
    content: "<p>Commuters have long complained about the gridlock...</p>",
    isSponsored: false,
    featured: false,
  },
  {
    id: "4",
    title: "Hidden Speakeasies of the Old Quarter",
    dek: "You walk past them every day. Here's how to get inside.",
    slug: "hidden-speakeasies",
    category: CATEGORIES[2], // Nightlife
    author: AUTHORS[1],
    date: "2023-10-08",
    readTime: "4 min read",
    heroImage: "https://picsum.photos/seed/bar/1200/800",
    content: "<p>Look for the red light above the unmarked door...</p>",
    isSponsored: true,
    sponsorName: "Velvet Lounge",
    sponsorLogo: "https://picsum.photos/seed/logo/100/100",
    featured: false,
  },
  {
    id: "5",
    title: "Borderlands: The Sound of Two Cities",
    dek: "Exploring the musical fusion happening at the edge of the map.",
    slug: "borderlands-sound",
    category: CATEGORIES[3], // Borderlands
    author: AUTHORS[2],
    date: "2023-10-05",
    readTime: "7 min read",
    heroImage: "https://picsum.photos/seed/music/1200/800",
    content: "<p>Music knows no borders, and neither do these bands...</p>",
    isSponsored: false,
    featured: false,
  },
];

export const EVENTS: CityEvent[] = [
  {
    id: "1",
    title: "Night Market: Autumn Edition",
    date: "2023-10-20",
    time: "6:00 PM - 11:00 PM",
    venue: "Central Plaza",
    price: "Free",
    category: "Market",
    image: "https://picsum.photos/seed/market/800/600",
    description: "Local vendors, street food, and live music under the stars.",
  },
  {
    id: "2",
    title: "Electronic Dreams Festival",
    date: "2023-10-22",
    time: "8:00 PM - 2:00 AM",
    venue: "The Warehouse",
    price: "$45",
    category: "Music",
    image: "https://picsum.photos/seed/rave/800/600",
    description: "Top DJs from around the world descend on the city.",
  },
  {
    id: "3",
    title: "Modern Art Gallery Opening",
    date: "2023-10-25",
    time: "7:00 PM - 10:00 PM",
    venue: "Gallery X",
    price: "$15",
    category: "Art",
    image: "https://picsum.photos/seed/gallery/800/600",
    description: "Featuring works by local emerging artists.",
  },
];

export const NEWSLETTERS: NewsletterIssue[] = [
  {
    id: "1",
    title: "Issue #42: The Fall Guide",
    date: "2023-10-01",
    previewText: "Everything you need to know about the upcoming season in the city.",
    coverImage: "https://picsum.photos/seed/fall/800/600",
  },
  {
    id: "2",
    title: "Issue #41: Best Coffee Spots",
    date: "2023-09-24",
    previewText: "We ranked the top 10 espresso bars. You won't believe #1.",
    coverImage: "https://picsum.photos/seed/coffee/800/600",
  },
];

export const AD_CAMPAIGNS: AdCampaign[] = [
  {
    id: "1",
    clientName: "TechCorp",
    placement: "homepage_banner",
    status: "active",
    impressions: 12500,
    clicks: 450,
    cost: 1200,
  },
  {
    id: "2",
    clientName: "Local Brewery",
    placement: "sidebar",
    status: "active",
    impressions: 8000,
    clicks: 210,
    cost: 600,
  },
];
