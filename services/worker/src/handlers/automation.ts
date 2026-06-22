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

      // Save to the app (Firestore articles, pending review)
      await saveBriefToApp(translated, env)

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

// Post the translated brief to the web app's ingest endpoint, which writes it to
// Firestore `articles` as `pending_review` for editors to publish.
async function saveBriefToApp(brief: any, env: Env): Promise<void> {
  try {
    const url = `${env.INGEST_URL || 'https://citybeatmag.co'}/api/ingest/brief`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ingest-secret': env.INGEST_SECRET || '',
      },
      body: JSON.stringify({
        title: brief.title,
        content: brief.content,
        contentEN: brief.contentEN,
        contentES: brief.contentES,
        category: brief.category,
        source: brief.source,
      }),
    })

    if (!response.ok) {
      throw new Error(`Ingest API error: ${response.status} ${response.statusText}`)
    }

    const result: any = await response.json().catch(() => ({}))
    console.log('Brief ingested to Firestore:', result.id)
  } catch (error) {
    console.error('Failed to ingest brief:', error)
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
