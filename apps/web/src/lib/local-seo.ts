import { adminDb } from '@citybeat/lib/firebase/admin'

// Programmatic local-SEO surface: one landing page per (category × city), e.g.
// "Best Restaurants in El Paso". These rank for high-intent "near me" / "in <city>"
// searches and are built entirely from the existing directory data.

export type LocalCategory = { slug: string; value: string; label: string; plural: string }
export type LocalCity = { slug: string; name: string; aliases: string[] }

// `value` matches the directory_listings.category field; `slug` is the URL.
// Each entry generates a /best/{slug}/{city} page for every city with listings.
// `value` MUST equal the directory_listings.category field. `plural` is the H1
// and title — phrased to match how people actually search ("real estate agents
// near me", "best dentists in el paso").
export const LOCAL_CATEGORIES: LocalCategory[] = [
  // High commercial-intent B2B / professional services (best-paying verticals).
  { slug: 'real-estate-agents', value: 'Real Estate', label: 'Real Estate Agent', plural: 'Real Estate Agents' },
  { slug: 'attorneys', value: 'Attorneys', label: 'Attorney', plural: 'Attorneys' },
  { slug: 'insurance-agents', value: 'Insurance', label: 'Insurance Agent', plural: 'Insurance Agents' },
  { slug: 'financial-advisors', value: 'Financial', label: 'Financial Advisor', plural: 'Financial Advisors' },
  { slug: 'title-companies', value: 'Title & Notary', label: 'Title & Notary Service', plural: 'Title & Notary Services' },
  { slug: 'marketing-agencies', value: 'Marketing', label: 'Marketing Agency', plural: 'Marketing Agencies' },
  { slug: 'web-designers', value: 'Web Development', label: 'Web Designer', plural: 'Web Design & Development' },
  // High-intent consumer services.
  { slug: 'dentists-doctors', value: 'Health', label: 'Doctor & Clinic', plural: 'Doctors, Dentists & Clinics' },
  { slug: 'gyms', value: 'Fitness', label: 'Gym', plural: 'Gyms & Fitness' },
  { slug: 'salons-spas', value: 'Beauty', label: 'Salon & Spa', plural: 'Salons & Spas' },
  { slug: 'auto-repair', value: 'Auto Repair', label: 'Auto Repair Shop', plural: 'Auto Repair Shops' },
  { slug: 'home-services', value: 'Home Services', label: 'Home Service', plural: 'Home Services & Contractors' },
  { slug: 'auto-dealers', value: 'Auto Dealer', label: 'Auto Dealer', plural: 'Auto Dealers' },
  // Food & nightlife (high search volume).
  { slug: 'restaurants', value: 'Restaurant', label: 'Restaurant', plural: 'Restaurants' },
  { slug: 'cafes', value: 'Cafe', label: 'Cafe', plural: 'Cafes' },
  { slug: 'coffee-shops', value: 'Coffee Shop', label: 'Coffee Shop', plural: 'Coffee Shops' },
  { slug: 'bakeries', value: 'Bakery', label: 'Bakery', plural: 'Bakeries' },
  { slug: 'bars', value: 'Bar', label: 'Bar', plural: 'Bars' },
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
// the /best hub. One query per category, bucketed by city in memory. Empty combos
// are omitted so we never publish a thin/zero-result page.
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
