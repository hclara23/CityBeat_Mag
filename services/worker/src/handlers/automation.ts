import { Env } from '../index'
import { emailTemplates, sendEmail } from './emails'

interface Brief {
  title: string
  content: string
  source: string
  category: string
}

export async function handleBriefAutomation(env: Env): Promise<void> {
  console.log('Starting brief automation...')

  try {
    // Fetch briefs from sources
    const briefs = await fetchBriefs(env)

    // Translate each brief
    for (const brief of briefs) {
      const translated = await translateBrief(brief, env)

      // Save to Sanity as draft
      await saveBriefToSanity(translated, env)

      // Send notification to editor
      await notifyEditor(translated, env)
    }

    console.log(`Processed ${briefs.length} briefs`)
  } catch (error) {
    console.error('Brief automation failed:', error)
  }
}

async function fetchBriefs(env: Env): Promise<Brief[]> {
  const briefs: Brief[] = []

  try {
    console.log('Fetching briefs from configured sources...')

    // Fetch from NewsAPI
    const newsApiKey = env.NEWS_API_KEY
    if (newsApiKey) {
      const keywords = [
        'El Paso',
        'Ciudad Juárez',
        'border news',
        'New Mexico',
        'Las Cruces'
      ]

      for (const keyword of keywords) {
        try {
          const response = await fetch(
            `https://newsapi.org/v2/everything?q=${encodeURIComponent(keyword)}&sortBy=publishedAt&language=en&pageSize=5`,
            {
              headers: {
                'X-API-Key': newsApiKey,
              },
            }
          )

          if (!response.ok) {
            console.warn(`NewsAPI error for keyword "${keyword}": ${response.statusText}`)
            continue
          }

          const data: any = await response.json()

          if (data.articles) {
            for (const article of data.articles) {
              briefs.push({
                title: article.title,
                content: article.description || article.content || '',
                source: article.source.name,
                category: categorizeArticle(article.title, article.description),
              })
            }
          }
        } catch (error) {
          console.error(`Error fetching from NewsAPI for keyword "${keyword}":`, error)
        }
      }
    }

    // Fetch from RSS feeds (simplified - in production use RSS parser library)
    const rssSources = [
      { url: 'https://www.elpasotimes.com/feed/', name: 'El Paso Times' },
      { url: 'https://www.abc-7.com/rss', name: 'ABC 7 News' },
      { url: 'https://www.kvia.com/rss', name: 'KVIA News' },
    ]

    for (const source of rssSources) {
      try {
        console.log(`Fetching from RSS: ${source.name}`)
        // In production, would use an RSS parser library
        // For now, log that we attempted to fetch
      } catch (error) {
        console.error(`Error fetching from ${source.name}:`, error)
      }
    }

    console.log(`Fetched ${briefs.length} briefs from sources`)
  } catch (error) {
    console.error('Failed to fetch briefs:', error)
  }

  return briefs
}

function categorizeArticle(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase()

  if (
    text.includes('business') ||
    text.includes('company') ||
    text.includes('economy') ||
    text.includes('job') ||
    text.includes('employment')
  ) {
    return 'business'
  }

  if (
    text.includes('event') ||
    text.includes('concert') ||
    text.includes('festival') ||
    text.includes('conference')
  ) {
    return 'events'
  }

  if (
    text.includes('culture') ||
    text.includes('art') ||
    text.includes('museum') ||
    text.includes('performance') ||
    text.includes('artist')
  ) {
    return 'culture'
  }

  return 'news'
}

async function translateBrief(brief: Brief, env: Env): Promise<any> {
  try {
    const response = await fetch('https://api-free.deepl.com/v1/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${env.DEEPL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: brief.content,
        source_lang: 'EN',
        target_lang: 'ES',
      }),
    })

    if (!response.ok) {
      throw new Error(`DeepL API error: ${response.statusText}`)
    }

    const result: any = await response.json()
    const translatedContent = result.translations[0]?.text || ''

    return {
      ...brief,
      contentEN: brief.content,
      contentES: translatedContent,
    }
  } catch (error) {
    console.error('Translation failed:', error)
    return brief
  }
}

async function saveBriefToSanity(brief: any, env: Env): Promise<void> {
  try {
    const sanityUrl = `https://${env.SANITY_PROJECT_ID}.api.sanity.io/v2021-06-07/data/mutate/${env.SANITY_DATASET}`

    const mutation = {
      mutations: [
        {
          create: {
            _type: 'brief',
            title: brief.title,
            content: brief.content,
            contentEN: brief.contentEN,
            contentES: brief.contentES,
            category: brief.category,
            status: 'draft',
            source: brief.source,
            publishedAt: new Date().toISOString(),
          },
        },
      ],
    }

    const response = await fetch(sanityUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.SANITY_WRITE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mutation),
    })

    if (!response.ok) {
      throw new Error(`Sanity API error: ${response.statusText}`)
    }

    const result: any = await response.json()
    const sanityId = result.results?.[0]?.id

    // Also save to Supabase for tracking and analytics
    if (sanityId && env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
      await saveBriefToSupabase(
        {
          ...brief,
          sanity_id: sanityId,
        },
        env
      )
    }

    console.log('Brief saved to Sanity:', sanityId)
  } catch (error) {
    console.error('Failed to save brief to Sanity:', error)
  }
}

async function saveBriefToSupabase(brief: any, env: Env): Promise<void> {
  try {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/briefs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        sanity_id: brief.sanity_id,
        title: brief.title,
        content_en: brief.contentEN,
        content_es: brief.contentES,
        category: brief.category,
        source: brief.source,
        published_at: new Date().toISOString(),
        status: 'draft',
      }),
    })

    if (!response.ok && response.status !== 201) {
      console.warn(`Supabase insert warning: ${response.statusText}`)
    } else {
      console.log('Brief saved to Supabase')
    }
  } catch (error) {
    console.error('Failed to save brief to Supabase:', error)
  }
}

async function notifyEditor(brief: any, env: Env): Promise<void> {
  try {
    const briefData = {
      title: brief.title,
      source: brief.source,
      category: brief.category,
      content: brief.contentEN || brief.content || '',
      contentES: brief.contentES || '',
    }

    const template = emailTemplates.editorNotification(briefData)
    const response = await sendEmail('editors@citybeatmag.co', template, env)

    if (!response.ok) {
      console.warn('Editor notification email failed:', response.statusText)
    } else {
      console.log('Editor notification email sent successfully')
    }
  } catch (error) {
    console.error('Failed to notify editor:', error)
  }
}
