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

const EP_AREAS = ['El Paso, TX', 'East El Paso, TX', 'West El Paso, TX', 'Northeast El Paso, TX', 'Horizon City, TX', 'Socorro, TX', 'Canutillo, TX', 'Anthony, TX', 'Las Cruces, NM', 'Santa Teresa, NM', 'Sunland Park, NM']
const cross = (terms: string[], areas: string[]) => terms.flatMap((t) => areas.map((a) => `${t} in ${a}`))

const ELECTRICAL_QUERIES = cross(
  ['electrical contractor', 'residential electrician', 'commercial electrical contractor', 'industrial electrical contractor', 'electrician'],
  EP_AREAS
)
const AUTOMATION_QUERIES = cross(
  ['industrial automation company', 'control systems integrator', 'automation systems integrator', 'PLC programming services', 'SCADA integrator', 'industrial controls and instrumentation', 'robotics integrator', 'building automation systems'],
  ['El Paso, TX', 'Las Cruces, NM', 'Santa Teresa, NM', 'Socorro, TX']
)
const INDUSTRIAL_SUPPLY_QUERIES = cross(
  ['industrial supply', 'electrical supply store', 'industrial equipment supplier', 'bearings and power transmission supplier', 'fasteners supplier', 'welding supply', 'hydraulic and pneumatic supply', 'MRO supplies', 'industrial safety supply', 'wire and cable supplier', 'industrial tool supply'],
  ['El Paso, TX', 'Las Cruces, NM', 'Santa Teresa, NM', 'Horizon City, TX']
)

const TDLR_BASE = 'https://data.texas.gov/resource/7358-krk7.json'
const tdlrUrl = (licenseType: string) =>
  `${TDLR_BASE}?$limit=5000&$where=${encodeURIComponent(`license_type='${licenseType}' AND business_county='EL PASO'`)}`
const TDLR_FIELD_MAP = JSON.stringify({
  name: 'business_name',
  address: 'business_address_line1',
  city_state_zip: 'business_city_state_zip',
  phone: 'business_telephone',
  longitude: 'business_mailing.coordinates.0',
  latitude: 'business_mailing.coordinates.1',
})

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    key: 'tdlr-electrical-contractors',
    name: 'TDLR — licensed Electrical Contractors (El Paso County)',
    description:
      'Texas Dept. of Licensing & Regulation open-data license file (data.texas.gov 7358-krk7): every active Electrical Contractor licensed in El Paso County with business address, phone and coordinates — residential, commercial and industrial. Weekly refresh picks up newly licensed contractors. Multi-branch contractors are consolidated into one card.',
    enabled: true,
    interval_hours: 168,
    definition: {
      nodes: [
        { id: 'fetch', type: TaskType.FETCH_JSON, inputs: { URL: tdlrUrl('Electrical Contractor'), 'Max items': '5000' } },
        { id: 'map', type: TaskType.MAP_JSON_TO_LISTINGS, inputs: { JSON: '{{fetch.JSON}}', 'Field map': TDLR_FIELD_MAP, Category: 'Electrical Contractors', 'Title case names': 'true' } },
        { id: 'deliver', type: TaskType.DELIVER_TO_DIRECTORY, inputs: { Listings: '{{map.Listings}}', 'Default category': 'Electrical Contractors', 'Region filter': 'true', Publish: 'true', Consolidate: 'true' } },
      ],
    },
  },
  {
    key: 'places-electrical-contractors',
    name: 'Google Places — electrical contractors (residential · commercial · industrial)',
    description:
      'Places text search across El Paso / Doña Ana sub-areas for electrical contractors, residential electricians, commercial and industrial electrical contractors. 55 queries, 10 per run (rotating), up to 60 results each; phone + website via Place Details; real place ids; multi-location brands consolidated.',
    enabled: true,
    interval_hours: 24,
    definition: {
      nodes: [
        { id: 'search', type: TaskType.SEARCH_GOOGLE_PLACES, inputs: { Queries: JSON.stringify(ELECTRICAL_QUERIES), 'Max queries per run': '10', 'Pages per query': '3', Category: 'Electrical Contractors', 'Fetch details': 'true' } },
        { id: 'deliver', type: TaskType.DELIVER_TO_DIRECTORY, inputs: { Listings: '{{search.Listings}}', 'Default category': 'Electrical Contractors', 'Region filter': 'true', Publish: 'true', Consolidate: 'true' } },
      ],
    },
  },
  {
    key: 'places-automation-integrators',
    name: 'Google Places — automation & control systems integrators',
    description:
      'Places text search for industrial automation companies, control/automation systems integrators, PLC/SCADA, instrumentation, robotics and building-automation firms in El Paso, Las Cruces and Santa Teresa. 32 queries, 8 per run (rotating).',
    enabled: true,
    interval_hours: 24,
    definition: {
      nodes: [
        { id: 'search', type: TaskType.SEARCH_GOOGLE_PLACES, inputs: { Queries: JSON.stringify(AUTOMATION_QUERIES), 'Max queries per run': '8', 'Pages per query': '3', Category: 'Automation & Controls', 'Fetch details': 'true' } },
        { id: 'deliver', type: TaskType.DELIVER_TO_DIRECTORY, inputs: { Listings: '{{search.Listings}}', 'Default category': 'Automation & Controls', 'Region filter': 'true', Publish: 'true', Consolidate: 'true' } },
      ],
    },
  },
  {
    key: 'places-industrial-supply',
    name: 'Google Places — industrial supply companies',
    description:
      'Places text search for industrial supply, electrical supply, industrial equipment, bearings/power transmission, fasteners, welding, hydraulic/pneumatic, MRO, safety, wire & cable and industrial tool suppliers. 44 queries, 8 per run (rotating).',
    enabled: true,
    interval_hours: 24,
    definition: {
      nodes: [
        { id: 'search', type: TaskType.SEARCH_GOOGLE_PLACES, inputs: { Queries: JSON.stringify(INDUSTRIAL_SUPPLY_QUERIES), 'Max queries per run': '8', 'Pages per query': '3', Category: 'Industrial Supply', 'Fetch details': 'true' } },
        { id: 'deliver', type: TaskType.DELIVER_TO_DIRECTORY, inputs: { Listings: '{{search.Listings}}', 'Default category': 'Industrial Supply', 'Region filter': 'true', Publish: 'true', Consolidate: 'true' } },
      ],
    },
  },
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
