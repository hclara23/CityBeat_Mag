import { createClient } from '@supabase/supabase-js'
import { localArticles } from './localArticles'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Public client for fetching published content
const publicSupabase = createClient(supabaseUrl, supabaseAnonKey)

export async function getPublishedArticles(limit = 10) {
  try {
    const { data, error } = await publicSupabase
      .from('articles')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  } catch (err) {
    console.error('Error fetching published articles:', err)
    return []
  }
}

export async function getArticleBySlug(slug: string) {
  try {
    const { data, error } = await publicSupabase
      .from('articles')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .single()

    if (error) throw error
    return data
  } catch (err) {
    // Fallback to local articles if not found in DB
    return localArticles.find(a => a.slug === slug)
  }
}
