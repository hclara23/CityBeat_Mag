export type Locale = 'en' | 'es'

export const topStories = [
  {
    title: "The Neon Renaissance: Downtown's New Light",
    dek: 'Artists, venues, and small businesses are turning late nights into a shared civic stage.',
    category: 'Arts',
    image: 'https://picsum.photos/seed/citybeat-neon/1600/1000',
    href: '/briefs',
  },
  {
    title: 'Midnight Tacos, Ranked Block By Block',
    dek: 'A practical guide to the stands, kitchens, and counters worth leaving home for.',
    category: 'Food',
    image: 'https://picsum.photos/seed/citybeat-tacos/900/650',
    href: '/briefs',
  },
  {
    title: 'Borderlands Sound, Two Cities Wide',
    dek: 'The musicians blending Norteño roots, warehouse electronics, and desert pop.',
    category: 'Culture',
    image: 'https://picsum.photos/seed/citybeat-music/900/650',
    href: '/briefs',
  },
]

export const events = [
  {
    title: 'Night Market: Autumn Edition',
    meta: 'Central Plaza, Friday',
    image: 'https://picsum.photos/seed/citybeat-market/760/520',
  },
  {
    title: 'Electronic Dreams Festival',
    meta: 'The Warehouse, Saturday',
    image: 'https://picsum.photos/seed/citybeat-rave/760/520',
  },
  {
    title: 'Modern Gallery Opening',
    meta: 'Gallery X, Thursday',
    image: 'https://picsum.photos/seed/citybeat-gallery/760/520',
  },
]

export const adProducts = {
  newsletter: {
    title: 'Newsletter Sponsorship',
    shortTitle: 'Newsletter',
    price: '$50',
    cadence: 'monthly',
    dek: 'Own a premium placement inside the weekly edit locals already open.',
    image: 'https://picsum.photos/seed/citybeat-newsletter/1100/760',
    features: ['Top placement in the weekly send', 'Bilingual creative review', 'Campaign performance summary'],
  },
  sponsored: {
    title: 'Sponsored Story',
    shortTitle: 'Sponsored',
    price: '$30',
    cadence: 'per post',
    dek: 'Publish useful brand stories beside CityBeat editorial coverage.',
    image: 'https://picsum.photos/seed/citybeat-sponsored/1100/760',
    features: ['Native story placement', 'Editorial production guidance', 'Category and social distribution'],
  },
  banners: {
    title: 'Category Banner',
    shortTitle: 'Banners',
    price: '$25',
    cadence: 'monthly',
    dek: 'Put a focused offer in front of readers browsing events, culture, food, and business.',
    image: 'https://picsum.photos/seed/citybeat-banners/1100/760',
    features: ['Category page placements', 'Leaderboard and rectangle formats', 'Simple monthly reporting'],
  },
} as const

export type AdProductKey = keyof typeof adProducts

export function withLocale(locale: string, href: string) {
  if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) return href
  const cleanHref = href.startsWith('/') ? href : `/${href}`
  return `/${locale}${cleanHref}`
}
