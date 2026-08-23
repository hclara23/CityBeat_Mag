// Task registry — mirrors ScrapeFlow's `lib/workflow/task/registry.ts`: every
// node type declares its label, credits, and typed inputs/outputs. The admin UI
// renders this to explain each node; the engine uses it for validation and
// implicit (same-name) output→input wiring.

import { TaskType, type WorkflowTask } from './types'

export const BROWSER_BACKENDS = ['auto', 'fetch', 'crawl4ai', 'puppeteer'] as const
export type BrowserBackend = (typeof BROWSER_BACKENDS)[number]

export const TaskRegistry: Record<TaskType, WorkflowTask> = {
  [TaskType.LAUNCH_BROWSER]: {
    type: TaskType.LAUNCH_BROWSER,
    label: 'Launch browser',
    description: 'Opens the start URL. Entry point of every workflow.',
    isEntryPoint: true,
    credits: 5,
    inputs: [
      { name: 'Website URL', type: 'STRING', required: true, helperText: 'e.g. https://example.org/directory' },
      {
        name: 'Backend',
        type: 'SELECT',
        options: [...BROWSER_BACKENDS],
        defaultValue: 'auto',
        helperText: 'auto = Crawl4AI when CRAWLER_URL is set, else plain fetch. puppeteer needs local Chromium.',
      },
    ],
    outputs: [{ name: 'Web page', type: 'BROWSER_INSTANCE' }],
  },
  [TaskType.NAVIGATE_URL]: {
    type: TaskType.NAVIGATE_URL,
    label: 'Navigate URL',
    description: 'Loads another URL in the same browser session.',
    credits: 2,
    inputs: [
      { name: 'Web page', type: 'BROWSER_INSTANCE', required: true },
      { name: 'URL', type: 'STRING', required: true },
    ],
    outputs: [{ name: 'Web page', type: 'BROWSER_INSTANCE' }],
  },
  [TaskType.PAGE_TO_HTML]: {
    type: TaskType.PAGE_TO_HTML,
    label: 'Get HTML from page',
    description: 'Outputs the raw HTML of the current page.',
    credits: 2,
    inputs: [{ name: 'Web page', type: 'BROWSER_INSTANCE', required: true }],
    outputs: [
      { name: 'HTML', type: 'STRING' },
      { name: 'Web page', type: 'BROWSER_INSTANCE' },
    ],
  },
  [TaskType.PAGE_TO_TEXT]: {
    type: TaskType.PAGE_TO_TEXT,
    label: 'Get text from page',
    description: 'Outputs the readable text of the current page (scripts/nav stripped).',
    credits: 2,
    inputs: [{ name: 'Web page', type: 'BROWSER_INSTANCE', required: true }],
    outputs: [
      { name: 'Text', type: 'LONG_TEXT' },
      { name: 'Web page', type: 'BROWSER_INSTANCE' },
    ],
  },
  [TaskType.EXTRACT_TEXT_FROM_ELEMENT]: {
    type: TaskType.EXTRACT_TEXT_FROM_ELEMENT,
    label: 'Extract text from element',
    description: 'cheerio CSS selector → text of the matched element(s).',
    credits: 2,
    inputs: [
      { name: 'HTML', type: 'STRING', required: true },
      { name: 'Selector', type: 'STRING', required: true, helperText: 'CSS selector, e.g. #main .listing' },
    ],
    outputs: [{ name: 'Extracted text', type: 'LONG_TEXT' }],
  },
  [TaskType.EXTRACT_LINKS]: {
    type: TaskType.EXTRACT_LINKS,
    label: 'Extract links',
    description: 'Collects absolute hrefs matching a selector / regex (JSON array).',
    credits: 1,
    inputs: [
      { name: 'HTML', type: 'STRING', required: true },
      { name: 'Selector', type: 'STRING', defaultValue: 'a[href]', helperText: 'CSS selector for anchors' },
      { name: 'Match', type: 'STRING', helperText: 'Optional regex the href must match, e.g. /list/member/' },
      { name: 'Max', type: 'NUMBER', defaultValue: '10', helperText: 'Max links to keep this run' },
      {
        name: 'Rotate',
        type: 'BOOLEAN',
        defaultValue: 'true',
        helperText: 'Window through the full link list across runs (run N takes slice N) so nightly runs cover everything.',
      },
    ],
    outputs: [{ name: 'Links', type: 'JSON' }],
  },
  [TaskType.CRAWL_PAGES]: {
    type: TaskType.CRAWL_PAGES,
    label: 'Crawl pages',
    description: 'Loads every link and concatenates their readable text, tagged by URL.',
    credits: 3,
    inputs: [
      { name: 'Links', type: 'JSON', required: true },
      { name: 'Delay ms', type: 'NUMBER', defaultValue: '1200', helperText: 'Pause between requests (be polite)' },
      { name: 'Max chars per page', type: 'NUMBER', defaultValue: '60000' },
    ],
    outputs: [{ name: 'Text', type: 'LONG_TEXT' }],
  },
  [TaskType.EXTRACT_DATA_WITH_AI]: {
    type: TaskType.EXTRACT_DATA_WITH_AI,
    label: 'Extract data with AI',
    description: 'Claude reads the text and returns JSON shaped by your prompt.',
    credits: 4,
    inputs: [
      { name: 'Text', type: 'LONG_TEXT', required: true },
      { name: 'Prompt', type: 'LONG_TEXT', required: true, helperText: 'Describe the JSON you want back' },
    ],
    outputs: [{ name: 'Extracted data', type: 'JSON' }],
  },
  [TaskType.EXTRACT_LISTINGS_WITH_AI]: {
    type: TaskType.EXTRACT_LISTINGS_WITH_AI,
    label: 'Extract business listings with AI',
    description: 'Claude pulls every business (name, address, phone, website, category) out of the text.',
    credits: 4,
    inputs: [
      { name: 'Text', type: 'LONG_TEXT', required: true },
      { name: 'Category hint', type: 'STRING', helperText: 'Optional default category when the page is vertical-specific' },
    ],
    outputs: [{ name: 'Listings', type: 'JSON' }],
  },
  [TaskType.DELIVER_TO_DIRECTORY]: {
    type: TaskType.DELIVER_TO_DIRECTORY,
    label: 'Deliver to CityBeat directory',
    description: 'Insert-only write of listings into `directory_listings` (El Paso / Doña Ana only, deduped).',
    credits: 1,
    inputs: [
      { name: 'Listings', type: 'JSON', required: true },
      { name: 'Default category', type: 'STRING', defaultValue: 'Professional Services' },
      { name: 'Region filter', type: 'BOOLEAN', defaultValue: 'true', helperText: 'Drop businesses outside El Paso / Doña Ana counties' },
      { name: 'Publish', type: 'BOOLEAN', defaultValue: 'true', helperText: 'false = insert unpublished for admin review' },
      {
        name: 'Consolidate',
        type: 'BOOLEAN',
        defaultValue: 'true',
        helperText: 'Merge same-brand listings (multiple locations) into one card with locations[] after inserting',
      },
    ],
    outputs: [{ name: 'Result', type: 'JSON' }],
  },
  [TaskType.FETCH_JSON]: {
    type: TaskType.FETCH_JSON,
    label: 'Fetch JSON',
    isEntryPoint: true,
    description: 'GETs a JSON or CSV open-data endpoint (Socrata dataset, or a flat government CSV dump) and outputs a JSON array of rows.',
    credits: 2,
    inputs: [
      { name: 'URL', type: 'STRING', required: true, helperText: 'https://data.texas.gov/resource/<id>.json?$where=... or a .csv bulk-download URL' },
      { name: 'Format', type: 'SELECT', options: ['auto', 'json', 'csv'], defaultValue: 'auto', helperText: 'auto detects by content-type / .csv extension' },
      { name: 'Max items', type: 'NUMBER', defaultValue: '5000', helperText: 'Set high for an unfiltered CSV dump (filter afterward with Map JSON rows → Row filter) so rows past the cap aren’t silently dropped before filtering' },
    ],
    outputs: [{ name: 'JSON', type: 'JSON' }],
  },
  [TaskType.MAP_JSON_TO_LISTINGS]: {
    type: TaskType.MAP_JSON_TO_LISTINGS,
    label: 'Map JSON rows to listings',
    description: 'Deterministically filters and maps each JSON row to a business listing via a field map (no AI).',
    credits: 1,
    inputs: [
      { name: 'JSON', type: 'JSON', required: true },
      {
        name: 'Field map',
        type: 'JSON',
        required: true,
        helperText:
          'Listing field → source path. Keys: name, address, city, state, zip, city_state_zip, phone, website, email, description, category, latitude, longitude. A path is dotted/indexed (e.g. "business_mailing.coordinates.1"); "A+B" joins two fields with a space (e.g. "FIRST_NME+LAST_NME"); a value starting with "=" is a literal (e.g. "=Licensed Dentist").',
      },
      {
        name: 'Row filter',
        type: 'JSON',
        helperText: 'Optional {field: value | [values]} — case-insensitive equality AND across keys, applied before mapping. e.g. {"COUNTY":"EL PASO","STATE":"TX","LIC_STA_DESC":"Active"}',
      },
      { name: 'Category', type: 'STRING', helperText: 'Category for every row (overrides map)' },
      { name: 'Title case names', type: 'BOOLEAN', defaultValue: 'true', helperText: 'Fix ALL-CAPS government data; "LAST, FIRST" → "First Last"' },
    ],
    outputs: [{ name: 'Listings', type: 'JSON' }],
  },
  [TaskType.SEARCH_GOOGLE_PLACES]: {
    type: TaskType.SEARCH_GOOGLE_PLACES,
    label: 'Search Google Places',
    isEntryPoint: true,
    description: 'Runs Places text searches (needs GOOGLE_PLACES_API_KEY) and outputs listings with real place ids, phone and website.',
    credits: 5,
    inputs: [
      { name: 'Queries', type: 'JSON', required: true, helperText: 'JSON array (or one per line): "electrical contractor in El Paso, TX"' },
      { name: 'Max queries per run', type: 'NUMBER', defaultValue: '8', helperText: 'Rotates through the list across runs' },
      { name: 'Pages per query', type: 'NUMBER', defaultValue: '3', helperText: '1-3 (20 results each)' },
      { name: 'Category', type: 'STRING', helperText: 'Category assigned to every result' },
      { name: 'Fetch details', type: 'BOOLEAN', defaultValue: 'true', helperText: 'Place Details for phone + website (small per-call cost)' },
    ],
    outputs: [{ name: 'Listings', type: 'JSON' }],
  },
  [TaskType.DELIVER_VIA_WEBHOOK]: {
    type: TaskType.DELIVER_VIA_WEBHOOK,
    label: 'Deliver via webhook',
    description: 'POSTs a JSON body to a URL.',
    credits: 1,
    inputs: [
      { name: 'Target URL', type: 'STRING', required: true },
      { name: 'Body', type: 'JSON', required: true },
    ],
    outputs: [{ name: 'Status', type: 'STRING' }],
  },
  [TaskType.WAIT]: {
    type: TaskType.WAIT,
    label: 'Wait',
    description: 'Sleeps N milliseconds (rate limiting).',
    credits: 0,
    inputs: [{ name: 'Milliseconds', type: 'NUMBER', defaultValue: '1000' }],
    outputs: [],
  },
}

export function getTask(type: string): WorkflowTask | null {
  return (TaskRegistry as Record<string, WorkflowTask>)[type] || null
}
