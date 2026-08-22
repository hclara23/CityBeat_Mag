// Bundled workflow templates. Seeded once into `scrapeflow_workflows` (keyed by
// `template_key`) and offered as "New from template" in /admin/scrapeflow.
// Source sites are public member/business directories for the El Paso–Las
// Cruces region. Add more by appending here or from the admin JSON editor.

import { TaskType, type WorkflowDefinition } from './types'

export interface WorkflowTemplate {
  key: string
  name: string
  description: string
  enabled: boolean
  interval_hours: number
  definition: WorkflowDefinition
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    key: 'ephcc-growthzone',
    name: 'El Paso Hispanic Chamber — member directory',
    description:
      'Public GrowthZone member directory (A–Z pages). Each run crawls the next 3 letter pages, Claude extracts every member (name/address/phone/site/category), and new El Paso-area businesses are inserted into the directory. Covers the full alphabet in ~9 nightly runs, then keeps cycling to pick up new members.',
    enabled: true,
    interval_hours: 24,
    definition: {
      nodes: [
        {
          id: 'launch',
          type: TaskType.LAUNCH_BROWSER,
          inputs: { 'Website URL': 'https://elpasohispanicchamberofcommerce.growthzoneapp.com/businessdirectory', Backend: 'auto' },
        },
        { id: 'html', type: TaskType.PAGE_TO_HTML, inputs: {} },
        {
          id: 'letters',
          type: TaskType.EXTRACT_LINKS,
          inputs: { Selector: 'a[href*="FindStartsWith"]', Match: 'FindStartsWith\\?term=[A-Z]$', Max: '3', Rotate: 'true' },
        },
        { id: 'crawl', type: TaskType.CRAWL_PAGES, inputs: { Links: '{{letters.Links}}', 'Delay ms': '1500', 'Max chars per page': '60000' } },
        { id: 'extract', type: TaskType.EXTRACT_LISTINGS_WITH_AI, inputs: { Text: '{{crawl.Text}}' } },
        {
          id: 'deliver',
          type: TaskType.DELIVER_TO_DIRECTORY,
          inputs: { Listings: '{{extract.Listings}}', 'Default category': 'Professional Services', 'Region filter': 'true', Publish: 'true' },
        },
      ],
    },
  },
  {
    key: 'elpaso-chamber',
    name: 'El Paso Chamber — member directory (needs Crawl4AI)',
    description:
      'web.elpaso.org blocks plain HTTP fetch (403). Deploy services/crawler and set CRAWLER_URL/CRAWLER_SECRET on the web app, then enable this. Category pages are crawled 3 per run with rotation.',
    enabled: false,
    interval_hours: 24,
    definition: {
      nodes: [
        { id: 'launch', type: TaskType.LAUNCH_BROWSER, inputs: { 'Website URL': 'https://web.elpaso.org/directory/', Backend: 'crawl4ai' } },
        { id: 'html', type: TaskType.PAGE_TO_HTML, inputs: {} },
        {
          id: 'cats',
          type: TaskType.EXTRACT_LINKS,
          inputs: { Selector: 'a[href]', Match: 'web\\.elpaso\\.org/(directory|list|search)', Max: '3', Rotate: 'true' },
        },
        { id: 'crawl', type: TaskType.CRAWL_PAGES, inputs: { Links: '{{cats.Links}}', 'Delay ms': '2000' } },
        { id: 'extract', type: TaskType.EXTRACT_LISTINGS_WITH_AI, inputs: { Text: '{{crawl.Text}}' } },
        { id: 'deliver', type: TaskType.DELIVER_TO_DIRECTORY, inputs: { Listings: '{{extract.Listings}}', 'Default category': 'Professional Services' } },
      ],
    },
  },
  {
    key: 'single-page-listings',
    name: 'Template — single listing page → directory',
    description:
      'Starter for any public page that lists local businesses (an association roster, "best of" list, sponsor page, shopping-center tenant list…). Change the URL and optional Category hint, run a Dry run to preview, then enable.',
    enabled: false,
    interval_hours: 168,
    definition: {
      nodes: [
        { id: 'launch', type: TaskType.LAUNCH_BROWSER, inputs: { 'Website URL': 'https://example.org/el-paso-business-list', Backend: 'auto' } },
        { id: 'text', type: TaskType.PAGE_TO_TEXT, inputs: {} },
        { id: 'extract', type: TaskType.EXTRACT_LISTINGS_WITH_AI, inputs: { Text: '{{text.Text}}', 'Category hint': '' } },
        {
          id: 'deliver',
          type: TaskType.DELIVER_TO_DIRECTORY,
          inputs: { Listings: '{{extract.Listings}}', 'Default category': 'Professional Services', 'Region filter': 'true', Publish: 'false' },
        },
      ],
    },
  },
  {
    key: 'index-then-detail-pages',
    name: 'Template — index page → detail pages → directory',
    description:
      'Starter for directories where each business has its own page. Set the index URL and a regex for detail links (e.g. /list/member/ for ChamberMaster sites, /businessdirectory/Details/ for GrowthZone). Rotation walks the whole index over successive runs.',
    enabled: false,
    interval_hours: 24,
    definition: {
      nodes: [
        { id: 'launch', type: TaskType.LAUNCH_BROWSER, inputs: { 'Website URL': 'https://example.org/list', Backend: 'auto' } },
        { id: 'html', type: TaskType.PAGE_TO_HTML, inputs: {} },
        { id: 'links', type: TaskType.EXTRACT_LINKS, inputs: { Selector: 'a[href]', Match: '/list/member/', Max: '15', Rotate: 'true' } },
        { id: 'crawl', type: TaskType.CRAWL_PAGES, inputs: { Links: '{{links.Links}}', 'Delay ms': '1500', 'Max chars per page': '20000' } },
        { id: 'extract', type: TaskType.EXTRACT_LISTINGS_WITH_AI, inputs: { Text: '{{crawl.Text}}' } },
        { id: 'deliver', type: TaskType.DELIVER_TO_DIRECTORY, inputs: { Listings: '{{extract.Listings}}', Publish: 'false' } },
      ],
    },
  },
]

export function getTemplate(key: string): WorkflowTemplate | null {
  return WORKFLOW_TEMPLATES.find((t) => t.key === key) || null
}
