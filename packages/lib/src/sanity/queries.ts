import { sanityClient } from './client'

export interface Brief {
  _id: string
  title: string
  slug: string
  content: string
  contentEN?: string
  contentES?: string
  category: string
  publishedAt: string
  status: string
  source?: string
  _createdAt: string
  _updatedAt: string
}

export interface Article {
  _id: string
  title: string
  slug: string
  content: string
  publishedAt: string
  _createdAt: string
  _updatedAt: string
}

export interface Advertisement {
  _id: string
  title: string
  description: string
  image: string
  link: string
  startDate: string
  endDate: string
  status: string
  _createdAt: string
}

// Fetch all published briefs
export async function getAllBriefs(locale: string = 'en'): Promise<Brief[]> {
  const query = `
    *[_type == "brief" && status == "published"] | order(_createdAt desc) {
      _id,
      title,
      slug,
      content,
      contentEN,
      contentES,
      category,
      publishedAt,
      status,
      source,
      _createdAt,
      _updatedAt
    }
  `

  try {
    const briefs = await sanityClient.fetch(query)
    return briefs
  } catch (error) {
    console.error('Error fetching briefs:', error)
    return []
  }
}

// Fetch a single brief by slug
export async function getBriefBySlug(slug: string): Promise<Brief | null> {
  const query = `
    *[_type == "brief" && slug.current == $slug && status == "published"][0] {
      _id,
      title,
      slug,
      content,
      contentEN,
      contentES,
      category,
      publishedAt,
      status,
      source,
      _createdAt,
      _updatedAt
    }
  `

  try {
    const brief = await sanityClient.fetch(query, { slug })
    return brief || null
  } catch (error) {
    console.error('Error fetching brief:', error)
    return null
  }
}

// Fetch briefs by category
export async function getBriefsByCategory(category: string): Promise<Brief[]> {
  const query = `
    *[_type == "brief" && category == $category && status == "published"] | order(_createdAt desc) {
      _id,
      title,
      slug,
      content,
      contentEN,
      contentES,
      category,
      publishedAt,
      status,
      source,
      _createdAt,
      _updatedAt
    }
  `

  try {
    const briefs = await sanityClient.fetch(query, { category })
    return briefs
  } catch (error) {
    console.error('Error fetching briefs by category:', error)
    return []
  }
}

// Fetch paginated briefs
export async function getPaginatedBriefs(
  limit: number = 10,
  offset: number = 0
): Promise<{ briefs: Brief[]; total: number }> {
  const countQuery = `count(*[_type == "brief" && status == "published"])`
  const dataQuery = `
    *[_type == "brief" && status == "published"] | order(_createdAt desc) [${offset}...${offset + limit}] {
      _id,
      title,
      slug,
      content,
      contentEN,
      contentES,
      category,
      publishedAt,
      status,
      source,
      _createdAt,
      _updatedAt
    }
  `

  try {
    const [total, briefs] = await Promise.all([
      sanityClient.fetch(countQuery),
      sanityClient.fetch(dataQuery),
    ])
    return { briefs, total }
  } catch (error) {
    console.error('Error fetching paginated briefs:', error)
    return { briefs: [], total: 0 }
  }
}

// Fetch all articles
export async function getAllArticles(): Promise<Article[]> {
  const query = `
    *[_type == "article"] | order(_createdAt desc) {
      _id,
      title,
      slug,
      content,
      publishedAt,
      _createdAt,
      _updatedAt
    }
  `

  try {
    const articles = await sanityClient.fetch(query)
    return articles
  } catch (error) {
    console.error('Error fetching articles:', error)
    return []
  }
}

// Fetch advertisements
export async function getActiveAdvertisements(): Promise<Advertisement[]> {
  const query = `
    *[_type == "ad" && status == "active" && startDate <= now() && endDate >= now()] {
      _id,
      title,
      description,
      image,
      link,
      startDate,
      endDate,
      status,
      _createdAt
    }
  `

  try {
    const ads = await sanityClient.fetch(query)
    return ads
  } catch (error) {
    console.error('Error fetching advertisements:', error)
    return []
  }
}
