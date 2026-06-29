import { adminDb } from '@citybeat/lib/firebase/admin'

// Programmatic local-SEO surface: one landing page per (category × city), e.g.
// "Best Restaurants in El Paso". These rank for high-intent "near me" / "in <city>"
// searches and are built entirely from the existing directory data.

export type LocalCategory = { slug: string; value: string; label: string; plural: string }
export type LocalCity = { slug: string; name: string; aliases: string[] }

// `value` matches the directory_listings.category field; `slug` is the URL.
export const LOCAL_CATEGORIES: LocalCategory[] = [
  { slug: 'restaurants', value: 'Restaurant', label: 'Restaurant', plural: 'Restaurants' },
  { slug: 'cafes', value: 'Cafe', label: 'Cafe', plural: 'Cafes' },
  { slug: 'coffee-shops', value: 'Coffee Shop', label: 'Coffee Shop', plural: 'Coffee Shops' },
  { slug: 'bars', value: 'Bar', label: 'Bar', plural: 'Bars' },
  { slug: 'auto-dealers', value: 'Auto Dealer', label: 'Auto Dealer', plural: 'Auto Dealers' },
]

// Coverage cities; `aliases` are matched (case-insensitive) against a listing's address.
export const LOCAL_CITIES: LocalCity[] = [
  { slug: 'el-paso', name: 'El Paso', aliases: ['El Paso'] },
  { slug: 'las-cruces', name: 'Las Cruces', aliases: ['Las Cruces'] },
  { slug: 'ciudad-juarez', name: 'Ciudad Juárez', aliases: ['Ciudad Juárez', 'Juárez', 'Juarez'] },
  { slug: 'horizon-city', name: 'Horizon City', aliases: ['Horizon'] },
  { slug: 'socorro', name: 'Socorro', aliases: ['Socorro'] },
  { slug: 'clint', name: 'Clint', aliases: ['Clint'] },
  { slug: 'anthony', name: 'Anthony', aliases: ['Anthony'] },
  { slug: 'sunland-park', name: 'Sunland Park', aliases: ['Sunland Park'] },
]

export function findCategory(slug?: string) {
  return LOCAL_CATEGORIES.find((c) => c.slug === slug) || null
}
export function findCity(slug?: string) {
  return LOCAL_CITIES.find((c) => c.slug === slug) || null
}

export type LocalListing = {
  id: string
  name: string
  description?: string
  address?: string
  rating?: number
  user_ratings_total?: number
  tier?: string
  is_sponsored?: boolean
}

function inCity(row: any, city: LocalCity): boolean {
  const hay = `${row.address || ''} ${typeof row.locations === 'object' ? JSON.stringify(row.locations) : ''}`.toLowerCase()
  return city.aliases.some((a) => hay.includes(a.toLowerCase()))
}

function rank(a: any, b: any): number {
  if (Boolean(a.is_sponsored) !== Boolean(b.is_sponsored)) return a.is_sponsored ? -1 : 1
  const tierRank: Record<string, number> = { featured: 3, premium: 2, basic: 1 }
  const at = tierRank[a.tier] || 0
  const bt = tierRank[b.tier] || 0
  if (at !== bt) return bt - at
  if ((a.rating || 0) !== (b.rating || 0)) return (b.rating || 0) - (a.rating || 0)
  if ((a.user_ratings_total || 0) !== (b.user_ratings_total || 0)) return (b.user_ratings_total || 0) - (a.user_ratings_total || 0)
  return (a.name || '').localeCompare(b.name || '')
}

// Published listings for a category, filtered to a city, ranked.
export async function getLocalListings(cat: LocalCategory, city: LocalCity): Promise<LocalListing[]> {
  try {
    const snap = await adminDb
      .collection('directory_listings')
      .where('is_published', '==', true)
      .where('category', '==', cat.value)
      .get()
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
    return rows.filter((r) => inCity(r, city)).sort(rank)
  } catch {
    return []
  }
}

// All (category × city) combos that actually have ≥1 listing — for the sitemap and
// the /best hub. One query per category (5), bucketed by city in memory.
export async function getNonEmptyCombos(): Promise<Array<{ category: LocalCategory; city: LocalCity; count: number }>> {
  const out: Array<{ category: LocalCategory; city: LocalCity; count: number }> = []
  for (const cat of LOCAL_CATEGORIES) {
    let rows: any[] = []
    try {
      const snap = await adminDb
        .collection('directory_listings')
        .where('is_published', '==', true)
        .where('category', '==', cat.value)
        .get()
      rows = snap.docs.map((d) => d.data())
    } catch {
      rows = []
    }
    for (const city of LOCAL_CITIES) {
      const count = rows.filter((r) => inCity(r, city)).length
      if (count > 0) out.push({ category: cat, city, count })
    }
  }
  return out
}
