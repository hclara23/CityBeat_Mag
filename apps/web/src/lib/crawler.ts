// Client for the Crawl4AI microservice (services/crawler) — turns any URL into
// clean markdown for enrichment (directory business sites) and fuller newsroom
// source text. Dormant (returns null) until CRAWLER_URL is set on the web app.

export type CrawlResult = { url: string; markdown: string; title: string | null; success: boolean }

export function crawlerEnabled(): boolean {
  return Boolean(process.env.CRAWLER_URL)
}

export async function crawlUrl(url: string, timeoutMs = 30000): Promise<CrawlResult | null> {
  const base = process.env.CRAWLER_URL
  if (!base || !url) return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/crawl`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-crawler-secret': process.env.CRAWLER_SECRET || '',
      },
      body: JSON.stringify({ url }),
      signal: ctrl.signal,
    })
    if (!res.ok) return null
    const data: any = await res.json()
    return {
      url,
      markdown: String(data?.markdown || ''),
      title: data?.title || null,
      success: Boolean(data?.success),
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
