// Executor registry — one async function per TaskType, mirroring ScrapeFlow's
// `lib/workflow/executor/registry.ts`. Each executor gets an ExecutionEnvironment
// with typed getInput/setOutput, the shared browser session, and a log collector,
// and returns true/false for phase success.

import { DIRECTORY_CATEGORIES } from '@/lib/categories'
import { extractDataWithAI, extractListingsWithAI } from './ai'
import {
  absolutizeLinks,
  closeSession,
  htmlToText,
  navigate,
  openSession,
  resolveBackend,
  sleep,
  type PageSession,
} from './browser'
import { deliverToDirectory } from './directory-sink'
import { titleCaseName } from './normalize'
import { searchPlacesAsListings } from './places'
import { TaskType, type ExtractedListing, type LogLevel, type RunSummary } from './types'
import * as cheerio from 'cheerio'

export interface ExecutionEnvironment {
  getInput: (name: string) => string
  setOutput: (name: string, value: string) => void
  getSession: () => PageSession | null
  setSession: (session: PageSession) => void
  log: { info: (m: string) => void; warn: (m: string) => void; error: (m: string) => void; write: (l: LogLevel, m: string) => void }
  /** Shared run context (workflow id, run counter for rotation, dry-run flag, summary accumulator). */
  ctx: {
    workflowId: string | null
    runIndex: number
    dryRun: boolean
    summary: RunSummary
    deadline: number
  }
}

export type ExecutorFn = (env: ExecutionEnvironment) => Promise<boolean>

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v)
  return Number.isFinite(n) && v !== '' && v !== undefined ? n : fallback
}
const bool = (v: string | undefined, fallback: boolean) => {
  if (v === undefined || v === '') return fallback
  return /^(1|true|yes|on)$/i.test(v)
}
const parseJsonArray = (raw: string): any[] => {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed
    if (parsed && Array.isArray(parsed.listings)) return parsed.listings
    if (parsed && Array.isArray(parsed.links)) return parsed.links
    return parsed ? [parsed] : []
  } catch {
    // Allow newline-separated plain lists (handy when editing by hand).
    return raw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
}

const launchBrowser: ExecutorFn = async (env) => {
  const url = env.getInput('Website URL')
  if (!url) {
    env.log.error('Website URL is required')
    return false
  }
  const backend = resolveBackend(env.getInput('Backend') || null)
  const session = await openSession(backend)
  env.setSession(session)
  env.log.info(`Browser started (backend: ${backend})`)
  try {
    const page = await navigate(session, url)
    env.ctx.summary.pages_crawled++
    env.log.info(`Navigated to ${page.finalUrl} (${page.status ?? 'n/a'}, ${page.html.length || page.text.length} chars)`)
    env.setOutput('Web page', page.finalUrl)
    return true
  } catch (e: any) {
    env.log.error(`Failed to open ${url}: ${e?.message || e}`)
    if (e?.status === 403 || e?.status === 429) {
      env.log.warn('Site blocks plain fetch — set CRAWLER_URL (Crawl4AI) or Backend=puppeteer locally.')
    }
    return false
  }
}

const navigateUrl: ExecutorFn = async (env) => {
  const session = env.getSession()
  const url = env.getInput('URL')
  if (!session) {
    env.log.error('No browser session — add a Launch browser node first')
    return false
  }
  if (!url) {
    env.log.error('URL is required')
    return false
  }
  try {
    const page = await navigate(session, url)
    env.ctx.summary.pages_crawled++
    env.log.info(`Navigated to ${page.finalUrl}`)
    env.setOutput('Web page', page.finalUrl)
    return true
  } catch (e: any) {
    env.log.error(`Navigation failed: ${e?.message || e}`)
    return false
  }
}

const pageToHtml: ExecutorFn = async (env) => {
  const page = env.getSession()?.current
  if (!page) {
    env.log.error('No page loaded')
    return false
  }
  if (!page.html && page.backend === 'crawl4ai') {
    env.log.warn('Crawl4AI backend returns markdown, not HTML — passing text through as HTML')
  }
  env.setOutput('HTML', page.html || page.text)
  env.setOutput('Web page', page.finalUrl)
  env.log.info(`Captured ${(page.html || page.text).length} chars`)
  return true
}

const pageToText: ExecutorFn = async (env) => {
  const page = env.getSession()?.current
  if (!page) {
    env.log.error('No page loaded')
    return false
  }
  const text = page.text || htmlToText(page.html)
  env.setOutput('Text', `### SOURCE: ${page.finalUrl}\n${text}`)
  env.setOutput('Web page', page.finalUrl)
  env.log.info(`Captured ${text.length} chars of text`)
  return true
}

const extractTextFromElement: ExecutorFn = async (env) => {
  const selector = env.getInput('Selector')
  const html = env.getInput('HTML')
  if (!selector) {
    env.log.error('No selector provided')
    return false
  }
  if (!html) {
    env.log.error('No HTML provided')
    return false
  }
  const $ = cheerio.load(html)
  const el = $(selector)
  if (el.length === 0) {
    env.log.error(`Element not found: ${selector}`)
    return false
  }
  const text = el
    .map((_, e) => htmlToText($.html(e)))
    .get()
    .join('\n\n')
    .trim()
  if (!text) {
    env.log.error('No text found in element')
    return false
  }
  env.setOutput('Extracted text', text)
  env.log.info(`Extracted ${text.length} chars from ${el.length} element(s)`)
  return true
}

const extractLinks: ExecutorFn = async (env) => {
  const html = env.getInput('HTML')
  const base = env.getSession()?.current?.finalUrl || env.getInput('Web page') || ''
  if (!html) {
    env.log.error('No HTML provided')
    return false
  }
  const selector = env.getInput('Selector') || 'a[href]'
  const matchRaw = env.getInput('Match')
  let match: RegExp | null = null
  if (matchRaw) {
    try {
      match = new RegExp(matchRaw, 'i')
    } catch {
      env.log.error(`Invalid regex: ${matchRaw}`)
      return false
    }
  }
  const max = Math.max(1, Math.floor(num(env.getInput('Max'), 10)))
  const rotate = bool(env.getInput('Rotate'), true)
  const all = absolutizeLinks(html, base, selector, match).filter((u) => u !== base)
  if (!all.length) {
    env.log.error(`No links matched selector "${selector}"${matchRaw ? ` + /${matchRaw}/` : ''}`)
    return false
  }
  let picked: string[]
  if (rotate && all.length > max) {
    const windows = Math.ceil(all.length / max)
    const start = (env.ctx.runIndex % windows) * max
    picked = all.slice(start, start + max)
    env.log.info(`Rotation window ${(env.ctx.runIndex % windows) + 1}/${windows}: links ${start + 1}-${start + picked.length} of ${all.length}`)
  } else {
    picked = all.slice(0, max)
    env.log.info(`Kept ${picked.length} of ${all.length} matching links`)
  }
  env.setOutput('Links', JSON.stringify(picked))
  return true
}

const crawlPages: ExecutorFn = async (env) => {
  const session = env.getSession()
  if (!session) {
    env.log.error('No browser session')
    return false
  }
  const links = parseJsonArray(env.getInput('Links')).map(String).filter((u) => /^https?:\/\//i.test(u))
  if (!links.length) {
    env.log.error('No links to crawl')
    return false
  }
  const delay = Math.max(0, num(env.getInput('Delay ms'), 1200))
  const maxChars = Math.max(1000, num(env.getInput('Max chars per page'), 60_000))
  const parts: string[] = []
  let ok = 0
  for (const [i, url] of links.entries()) {
    if (Date.now() > env.ctx.deadline) {
      env.log.warn(`Time budget reached — stopping after ${i} of ${links.length} pages`)
      break
    }
    try {
      const page = await navigate(session, url)
      env.ctx.summary.pages_crawled++
      const text = (page.text || htmlToText(page.html)).slice(0, maxChars)
      parts.push(`### SOURCE: ${page.finalUrl}\n${text}`)
      ok++
      env.log.info(`(${i + 1}/${links.length}) ${url} → ${text.length} chars`)
    } catch (e: any) {
      env.log.warn(`(${i + 1}/${links.length}) ${url} failed: ${e?.message || e}`)
    }
    if (i < links.length - 1) await sleep(delay)
  }
  if (!ok) {
    env.log.error('Every page failed to load')
    return false
  }
  env.setOutput('Text', parts.join('\n\n'))
  return true
}

const extractDataWithAi: ExecutorFn = async (env) => {
  const text = env.getInput('Text')
  const prompt = env.getInput('Prompt')
  if (!text || !prompt) {
    env.log.error('Text and Prompt are required')
    return false
  }
  try {
    const data = await extractDataWithAI(text, prompt)
    const json = JSON.stringify(data)
    env.setOutput('Extracted data', json)
    env.log.info(`AI returned ${Array.isArray(data) ? `${data.length} items` : `${json.length} chars`}`)
    return true
  } catch (e: any) {
    env.log.error(`AI extraction failed: ${e?.message || e}`)
    return false
  }
}

const extractListingsWithAi: ExecutorFn = async (env) => {
  const text = env.getInput('Text')
  if (!text) {
    env.log.error('Text is required')
    return false
  }
  const hint = env.getInput('Category hint') || null
  // The crawler tags each page with "### SOURCE: <url>" — split on it so every
  // listing remembers the page it came from.
  const sections = text.split(/^### SOURCE: /m).filter((s) => s.trim())
  const listings: ExtractedListing[] = []
  try {
    for (const section of sections) {
      const nl = section.indexOf('\n')
      const hasUrl = nl > 0 && /^https?:\/\//i.test(section.slice(0, nl).trim())
      const sourceUrl = hasUrl ? section.slice(0, nl).trim() : env.getSession()?.current?.finalUrl || null
      const body = hasUrl ? section.slice(nl + 1) : section
      if (body.trim().length < 40) continue
      const found = await extractListingsWithAI(body, { categoryHint: hint, categories: DIRECTORY_CATEGORIES, sourceUrl })
      env.log.info(`${sourceUrl || 'page'}: ${found.length} listings`)
      listings.push(...found)
    }
  } catch (e: any) {
    env.log.error(`AI listing extraction failed: ${e?.message || e}`)
    if (!listings.length) return false
  }
  env.setOutput('Listings', JSON.stringify(listings))
  env.log.info(`Total ${listings.length} listings extracted`)
  return true
}

const deliverToDirectoryExec: ExecutorFn = async (env) => {
  const listings = parseJsonArray(env.getInput('Listings')) as ExtractedListing[]
  if (!listings.length) {
    env.log.warn('No listings to deliver')
    env.setOutput('Result', JSON.stringify({ candidates: 0, inserted: 0 }))
    return true
  }
  try {
    const result = await deliverToDirectory(listings, {
      defaultCategory: env.getInput('Default category') || 'Professional Services',
      regionFilter: bool(env.getInput('Region filter'), true),
      publish: bool(env.getInput('Publish'), true),
      consolidate: bool(env.getInput('Consolidate'), true),
      dryRun: env.ctx.dryRun,
      sourceUrl: env.getSession()?.current?.finalUrl || null,
      workflowId: env.ctx.workflowId,
      log: (l, m) => env.log.write(l, m),
    })
    env.ctx.summary.candidates += result.candidates
    env.ctx.summary.inserted += result.inserted
    env.ctx.summary.skipped_existing += result.skipped_existing
    env.ctx.summary.skipped_invalid += result.skipped_invalid
    env.ctx.summary.consolidated_groups = (env.ctx.summary.consolidated_groups || 0) + (result.consolidated_groups || 0)
    const { sample, inserted_ids, ...counts } = result
    env.setOutput('Result', JSON.stringify({ ...counts, would_insert: env.ctx.dryRun ? inserted_ids.length : undefined, sample }))
    return true
  } catch (e: any) {
    env.log.error(`Directory write failed: ${e?.message || e}`)
    return false
  }
}

const deliverViaWebhook: ExecutorFn = async (env) => {
  const target = env.getInput('Target URL')
  const body = env.getInput('Body')
  if (!target || !body) {
    env.log.error('Target URL and Body are required')
    return false
  }
  if (!/^https:\/\//i.test(target)) {
    env.log.error('Webhook target must be https')
    return false
  }
  try {
    const res = await fetch(target, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      signal: AbortSignal.timeout(20_000),
    })
    env.setOutput('Status', String(res.status))
    env.log.info(`Webhook responded ${res.status}`)
    return res.ok
  } catch (e: any) {
    env.log.error(`Webhook failed: ${e?.message || e}`)
    return false
  }
}

const fetchJson: ExecutorFn = async (env) => {
  const url = env.getInput('URL')
  if (!/^https?:\/\//i.test(url)) {
    env.log.error('URL is required (http/https)')
    return false
  }
  const max = Math.max(1, Math.floor(num(env.getInput('Max items'), 5000)))
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'CityBeatBot/1.0 ScrapeFlow (+https://citybeatmag.co)' },
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) {
      env.log.error(`HTTP ${res.status} from ${url}`)
      return false
    }
    const data: any = await res.json()
    const rows: any[] = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : Array.isArray(data?.data) ? data.data : data ? [data] : []
    const kept = rows.slice(0, max)
    env.ctx.summary.pages_crawled++
    env.setOutput('JSON', JSON.stringify(kept))
    env.log.info(`Fetched ${rows.length} rows${kept.length < rows.length ? ` (kept ${kept.length})` : ''}`)
    return true
  } catch (e: any) {
    env.log.error(`Fetch failed: ${e?.message || e}`)
    return false
  }
}

const getPath = (obj: any, path: string): any =>
  String(path)
    .split('.')
    .filter(Boolean)
    .reduce((acc, key) => (acc === null || acc === undefined ? undefined : acc[key]), obj)

const mapJsonToListings: ExecutorFn = async (env) => {
  const rows = parseJsonArray(env.getInput('JSON'))
  let map: Record<string, string>
  try {
    map = JSON.parse(env.getInput('Field map') || '{}')
  } catch {
    env.log.error('Field map is not valid JSON')
    return false
  }
  if (!map.name) {
    env.log.error('Field map needs at least "name"')
    return false
  }
  const category = env.getInput('Category') || null
  const titleCase = bool(env.getInput('Title case names'), true)
  const listings: ExtractedListing[] = []
  for (const row of rows) {
    const get = (k: string) => {
      const v = map[k] ? getPath(row, map[k]) : undefined
      return v === undefined || v === null || v === '' ? null : v
    }
    const rawName = get('name')
    if (!rawName) continue
    const name = titleCase ? titleCaseName(String(rawName)) : String(rawName)
    let city = get('city') ? String(get('city')) : null
    let state = get('state') ? String(get('state')) : null
    let zip = get('zip') ? String(get('zip')) : null
    const csz = get('city_state_zip')
    if (csz) {
      // "EL PASO TX 79907" / "El Paso, TX 79907-2724"
      const m = String(csz).match(/^(.*?)[, ]+([A-Za-z]{2})\s+(\d{5})(?:-\d{4})?$/)
      if (m) {
        city = city || titleCaseName(m[1].trim())
        state = state || m[2].toUpperCase()
        zip = zip || m[3]
      } else city = city || String(csz)
    }
    const addrRaw = get('address')
    listings.push({
      name,
      category: category || (get('category') ? String(get('category')) : null),
      address: addrRaw ? (titleCase ? titleCaseName(String(addrRaw)) : String(addrRaw)) : null,
      city,
      state,
      zip,
      phone: get('phone') ? String(get('phone')) : null,
      website: get('website') ? String(get('website')) : null,
      email: get('email') ? String(get('email')) : null,
      description: get('description') ? String(get('description')) : null,
      latitude: get('latitude') !== null ? Number(get('latitude')) : null,
      longitude: get('longitude') !== null ? Number(get('longitude')) : null,
      source_url: env.getSession()?.current?.finalUrl || null,
    })
  }
  env.setOutput('Listings', JSON.stringify(listings))
  env.log.info(`Mapped ${listings.length} of ${rows.length} rows to listings`)
  return listings.length > 0
}

const searchGooglePlaces: ExecutorFn = async (env) => {
  const all = parseJsonArray(env.getInput('Queries')).map(String).map((s) => s.trim()).filter(Boolean)
  if (!all.length) {
    env.log.error('Queries is required')
    return false
  }
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    env.log.error('GOOGLE_PLACES_API_KEY is not set')
    return false
  }
  const perRun = Math.max(1, Math.floor(num(env.getInput('Max queries per run'), 8)))
  const pages = Math.min(3, Math.max(1, Math.floor(num(env.getInput('Pages per query'), 3))))
  let queries = all
  if (all.length > perRun) {
    const windows = Math.ceil(all.length / perRun)
    const start = (env.ctx.runIndex % windows) * perRun
    queries = all.slice(start, start + perRun)
    env.log.info(`Rotation window ${(env.ctx.runIndex % windows) + 1}/${windows}: queries ${start + 1}-${start + queries.length} of ${all.length}`)
  }
  try {
    const listings = await searchPlacesAsListings(queries, {
      pages,
      category: env.getInput('Category') || null,
      fetchDetails: bool(env.getInput('Fetch details'), true),
      log: (m) => env.log.info(m),
      deadline: env.ctx.deadline - 20_000,
    })
    env.ctx.summary.pages_crawled += queries.length
    env.setOutput('Listings', JSON.stringify(listings))
    env.log.info(`Total ${listings.length} unique places`)
    return true
  } catch (e: any) {
    env.log.error(`Places search failed: ${e?.message || e}`)
    return false
  }
}

const wait: ExecutorFn = async (env) => {
  const ms = Math.min(60_000, Math.max(0, num(env.getInput('Milliseconds'), 1000)))
  await sleep(ms)
  env.log.info(`Waited ${ms}ms`)
  return true
}

export const ExecutorRegistry: Record<TaskType, ExecutorFn> = {
  [TaskType.LAUNCH_BROWSER]: launchBrowser,
  [TaskType.NAVIGATE_URL]: navigateUrl,
  [TaskType.PAGE_TO_HTML]: pageToHtml,
  [TaskType.PAGE_TO_TEXT]: pageToText,
  [TaskType.EXTRACT_TEXT_FROM_ELEMENT]: extractTextFromElement,
  [TaskType.EXTRACT_LINKS]: extractLinks,
  [TaskType.CRAWL_PAGES]: crawlPages,
  [TaskType.EXTRACT_DATA_WITH_AI]: extractDataWithAi,
  [TaskType.EXTRACT_LISTINGS_WITH_AI]: extractListingsWithAi,
  [TaskType.DELIVER_TO_DIRECTORY]: deliverToDirectoryExec,
  [TaskType.DELIVER_VIA_WEBHOOK]: deliverViaWebhook,
  [TaskType.WAIT]: wait,
  [TaskType.FETCH_JSON]: fetchJson,
  [TaskType.MAP_JSON_TO_LISTINGS]: mapJsonToListings,
  [TaskType.SEARCH_GOOGLE_PLACES]: searchGooglePlaces,
}

export { closeSession }
