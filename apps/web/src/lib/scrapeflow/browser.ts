// Page loading backends + cheerio helpers. ScrapeFlow's "Launch browser" node
// is Puppeteer-only; the CityBeat web image (node:20-alpine) has no Chromium,
// so the default here is plain fetch, upgraded to the Crawl4AI microservice
// when `CRAWLER_URL` is set, with Puppeteer available for local runs.

import * as cheerio from 'cheerio'
import { crawlUrl, crawlerEnabled } from '@/lib/crawler'
import type { BrowserBackend } from './tasks'

export const SCRAPEFLOW_USER_AGENT =
  'Mozilla/5.0 (compatible; CityBeatBot/1.0; +https://citybeatmag.co/about) ScrapeFlow'

export interface LoadedPage {
  url: string
  finalUrl: string
  status: number | null
  html: string
  text: string
  title: string | null
  backend: Exclude<BrowserBackend, 'auto'>
}

export interface PageSession {
  backend: Exclude<BrowserBackend, 'auto'>
  current: LoadedPage | null
  /** Puppeteer browser handle when that backend is active. */
  puppeteer?: { browser: any; page: any } | null
}

export function resolveBackend(requested?: string | null): Exclude<BrowserBackend, 'auto'> {
  const envDefault = (process.env.SCRAPEFLOW_BROWSER || 'auto').toLowerCase()
  const wanted = (requested || envDefault || 'auto').toLowerCase()
  if (wanted === 'puppeteer') return 'puppeteer'
  if (wanted === 'crawl4ai') return crawlerEnabled() ? 'crawl4ai' : 'fetch'
  if (wanted === 'fetch') return 'fetch'
  // auto
  if (envDefault === 'puppeteer') return 'puppeteer'
  return crawlerEnabled() ? 'crawl4ai' : 'fetch'
}

export function htmlToText(html: string, maxChars = 120_000): string {
  if (!html) return ''
  const $ = cheerio.load(html)
  $('script, style, noscript, svg, iframe, template, link, meta').remove()
  // Keep nav/footer out of the way: they're boilerplate for listing extraction.
  $('nav, footer, header .menu, .cookie, #cookie-banner').remove()
  // Preserve line structure so AI extraction can see one listing per block.
  $('br').replaceWith('\n')
  $('p, div, li, tr, h1, h2, h3, h4, h5, h6, section, article, address, dd, dt').each((_, el) => {
    $(el).append('\n')
  })
  // Surface tel:/mailto: targets — they're often more reliable than visible text.
  $('a[href^="tel:"]').each((_, el) => {
    const href = $(el).attr('href') || ''
    $(el).append(` [tel:${href.replace(/^tel:/i, '').trim()}]`)
  })
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href') || ''
    $(el).append(` [mailto:${href.replace(/^mailto:/i, '').split('?')[0].trim()}]`)
  })
  $('a[href^="http"]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const label = $(el).text().trim().toLowerCase()
    if (/website|visit|www\.|\.com|\.org|\.net/.test(label)) $(el).append(` [${href}]`)
  })
  const text = $('body').length ? $('body').text() : $.root().text()
  return text
    .replace(/\r/g, '')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim()
    .slice(0, maxChars)
}

export function extractTitle(html: string): string | null {
  try {
    const $ = cheerio.load(html)
    return $('title').first().text().trim() || null
  } catch {
    return null
  }
}

export function absolutizeLinks(
  html: string,
  baseUrl: string,
  selector = 'a[href]',
  match?: RegExp | null
): string[] {
  const $ = cheerio.load(html)
  const seen = new Set<string>()
  const out: string[] = []
  $(selector).each((_, el) => {
    const href = ($(el).attr('href') || '').trim()
    if (!href || href.startsWith('#') || /^(javascript|mailto|tel):/i.test(href)) return
    let abs: string
    try {
      abs = new URL(href, baseUrl).toString()
    } catch {
      return
    }
    if (match && !match.test(abs)) return
    if (seen.has(abs)) return
    seen.add(abs)
    out.push(abs)
  })
  return out
}

async function loadWithFetch(url: string, timeoutMs: number): Promise<LoadedPage> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': SCRAPEFLOW_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
  })
  const html = await res.text()
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} for ${url}`)
    ;(err as any).status = res.status
    ;(err as any).page = { url, finalUrl: res.url || url, status: res.status, html, text: htmlToText(html), title: extractTitle(html), backend: 'fetch' }
    throw err
  }
  return {
    url,
    finalUrl: res.url || url,
    status: res.status,
    html,
    text: htmlToText(html),
    title: extractTitle(html),
    backend: 'fetch',
  }
}

async function loadWithCrawl4ai(url: string, timeoutMs: number): Promise<LoadedPage> {
  const result = await crawlUrl(url, timeoutMs)
  if (!result || !result.success) throw new Error(`Crawl4AI failed for ${url}`)
  // Crawl4AI returns markdown, not HTML. Selector-based nodes won't have much to
  // chew on, but AI extraction works great on markdown.
  return {
    url,
    finalUrl: url,
    status: 200,
    html: '',
    text: result.markdown.slice(0, 200_000),
    title: result.title,
    backend: 'crawl4ai',
  }
}

// Hidden from the bundler/file-tracer on purpose: puppeteer (+ its Chromium
// download) must never end up in the Cloud Run image. Local-only.
async function importPuppeteer(): Promise<any> {
  const dynamicImport = new Function('m', 'return import(m)') as (m: string) => Promise<any>
  const mod = await dynamicImport('puppeteer')
  return mod.default || mod
}

async function ensurePuppeteer(session: PageSession) {
  if (session.puppeteer?.page) return session.puppeteer
  const puppeteer = await importPuppeteer()
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()
  await page.setUserAgent(SCRAPEFLOW_USER_AGENT)
  session.puppeteer = { browser, page }
  return session.puppeteer
}

async function loadWithPuppeteer(session: PageSession, url: string, timeoutMs: number): Promise<LoadedPage> {
  const { page } = await ensurePuppeteer(session)
  const res = await page.goto(url, { waitUntil: 'networkidle2', timeout: timeoutMs })
  const html: string = await page.content()
  return {
    url,
    finalUrl: page.url(),
    status: res ? res.status() : null,
    html,
    text: htmlToText(html),
    title: await page.title().catch(() => null),
    backend: 'puppeteer',
  }
}

export async function openSession(backend: Exclude<BrowserBackend, 'auto'>): Promise<PageSession> {
  return { backend, current: null, puppeteer: null }
}

export async function navigate(session: PageSession, url: string, timeoutMs = 30_000): Promise<LoadedPage> {
  let page: LoadedPage
  if (session.backend === 'puppeteer') page = await loadWithPuppeteer(session, url, timeoutMs)
  else if (session.backend === 'crawl4ai') page = await loadWithCrawl4ai(url, timeoutMs)
  else page = await loadWithFetch(url, timeoutMs)
  session.current = page
  return page
}

export async function closeSession(session: PageSession | null | undefined) {
  if (!session?.puppeteer?.browser) return
  try {
    await session.puppeteer.browser.close()
  } catch {
    /* ignore */
  }
  session.puppeteer = null
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)))
