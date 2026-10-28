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
const tdlrWhere = (where: string) => `${TDLR_BASE}?$limit=5000&$where=${encodeURIComponent(where)}`
const tdlrUrl = (licenseType: string) => tdlrWhere(`license_type='${licenseType}' AND business_county='EL PASO'`)
const WEST_TEXAS_COUNTIES = [
  'ANDREWS',
  'BREWSTER',
  'CRANE',
  'ECTOR',
  'HUDSPETH',
  'JEFF DAVIS',
  'LOVING',
  'MIDLAND',
  'PECOS',
  'PRESIDIO',
  'REEVES',
  'TERRELL',
  'UPTON',
  'WARD',
  'WINKLER',
]
const countyWhere = (field: string, counties: string[] = WEST_TEXAS_COUNTIES) =>
  counties.map((county) => `${field}='${county}'`).join(' OR ')
const titleCaseCountyWhere = (field: string) =>
  WEST_TEXAS_COUNTIES.map((county) =>
    `${field}='${county.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())}'`
  ).join(' OR ')
const TDLR_FIELD_MAP = JSON.stringify({
  name: 'business_name',
  address: 'business_address_line1',
  city_state_zip: 'business_city_state_zip',
  phone: 'business_telephone',
  longitude: 'business_mailing.coordinates.0',
  latitude: 'business_mailing.coordinates.1',
})

// Factory for a "Places sweep → deliver" template — cuts the boilerplate shared
// by every Google Places vertical below (all use the identical 2-node shape).
function placesTemplate(opts: {
  key: string
  name: string
  description: string
  queries: string[]
  category: string
  maxPerRun: number
  intervalHours?: number
  publish?: boolean
}): WorkflowTemplate {
  return {
    key: opts.key,
    name: opts.name,
    description: opts.description,
    // Every Places template is seeded DISABLED. Its output is Google Maps
    // Platform Content, which the directory sink now refuses to store, so an
    // enabled one would only burn Places API quota producing rows that are then
    // thrown away. The executor refuses too (executors.ts), which is what covers
    // the workflows already seeded into Firestore with enabled:true.
    enabled: false,
    interval_hours: opts.intervalHours ?? 24,
    definition: {
      nodes: [
        {
          id: 'search',
          type: TaskType.SEARCH_GOOGLE_PLACES,
          inputs: {
            Queries: JSON.stringify(opts.queries),
            'Max queries per run': String(opts.maxPerRun),
            'Pages per query': '3',
            Category: opts.category,
            'Fetch details': 'true',
          },
        },
        {
          id: 'deliver',
          type: TaskType.DELIVER_TO_DIRECTORY,
          inputs: {
            Listings: '{{search.Listings}}',
            'Default category': opts.category,
            'Region filter': 'true',
            Publish: opts.publish === false ? 'false' : 'true',
            Consolidate: 'true',
          },
        },
      ],
    },
  }
}

const HOME_SERVICES_QUERIES = cross(
  ['plumbing company', 'plumber', 'roofing contractor', 'landscaping company', 'lawn care service', 'pest control company', 'air conditioning repair', 'HVAC company', 'garage door repair', 'solar panel installer', 'general contractor', 'house cleaning service'],
  ['El Paso, TX', 'Horizon City, TX', 'Socorro, TX', 'Las Cruces, NM']
)
const AUTO_REPAIR_QUERIES = cross(
  ['auto repair shop', 'auto body shop', 'tire shop', 'oil change service', 'transmission repair shop', 'auto detailing', 'towing company', 'car mechanic'],
  ['El Paso, TX', 'Horizon City, TX', 'Canutillo, TX', 'Las Cruces, NM', 'Santa Teresa, NM']
)
const REAL_ESTATE_QUERIES = cross(['real estate agent', 'real estate broker', 'property management company', 'realtor'], EP_AREAS)
const INSURANCE_QUERIES = cross(['insurance agency', 'auto insurance agent', 'life insurance agent', 'home insurance agent'], EP_AREAS)
const ATTORNEY_QUERIES = cross(
  ['immigration attorney', 'personal injury attorney', 'family law attorney', 'criminal defense attorney', 'divorce lawyer', 'bankruptcy attorney', 'DUI attorney'],
  ['El Paso, TX', 'Horizon City, TX', 'Las Cruces, NM', 'Santa Teresa, NM', 'Socorro, TX', 'Sunland Park, NM']
)
const HEALTH_QUERIES = cross(
  ['dentist', 'pediatrician', 'obstetrician gynecologist', 'urgent care clinic', 'chiropractor', 'optometrist', 'medical spa', 'mental health counselor', 'family medicine clinic', 'physical therapy clinic'],
  ['El Paso, TX', 'Horizon City, TX', 'Las Cruces, NM', 'Santa Teresa, NM']
)
const EVENT_SERVICES_QUERIES = cross(
  ['wedding venue', 'quinceañera hall', 'event planner', 'wedding photographer', 'DJ service', 'florist for weddings', 'party rental company', 'banquet hall'],
  ['El Paso, TX', 'Horizon City, TX', 'Canutillo, TX', 'Las Cruces, NM', 'Socorro, TX']
)
const BEAUTY_QUERIES = cross(
  ['barbershop', 'hair salon', 'nail salon', 'day spa', 'medical spa', 'eyelash extensions studio', 'tattoo shop'],
  ['El Paso, TX', 'Horizon City, TX', 'Canutillo, TX', 'Las Cruces, NM', 'Santa Teresa, NM', 'Socorro, TX']
)
const CHILDCARE_QUERIES = cross(
  ['daycare center', 'preschool', 'montessori school', 'tutoring center', 'driving school', 'music lessons school', 'dance studio for kids'],
  ['El Paso, TX', 'Horizon City, TX', 'Canutillo, TX', 'Las Cruces, NM', 'Santa Teresa, NM', 'Socorro, TX']
)
const RETAIL_QUERIES = cross(
  ['boutique clothing store', 'western wear store', 'furniture store', 'gift shop', 'home decor store', 'shoe store'],
  ['El Paso, TX', 'Horizon City, TX', 'Canutillo, TX', 'Las Cruces, NM', 'Santa Teresa, NM', 'Socorro, TX']
)
const ARTS_CULTURE_QUERIES = cross(
  ['art gallery', 'art studio', 'pottery studio', 'theater company', 'dance company', 'museum'],
  ['El Paso, TX', 'Horizon City, TX', 'Las Cruces, NM', 'Santa Teresa, NM', 'Socorro, TX']
)
const LOGISTICS_QUERIES = cross(
  ['customs broker', 'freight forwarder', 'trucking company', 'warehousing company', 'logistics company', 'cargo shipping company', '3PL company'],
  ['El Paso, TX', 'Santa Teresa, NM', 'Las Cruces, NM', 'Horizon City, TX']
)
const BUSINESS_SERVICES_QUERIES = cross(['staffing agency', 'commercial cleaning company', 'security guard company', 'janitorial services'], EP_AREAS)

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
        { id: 'map', type: TaskType.MAP_JSON_TO_LISTINGS, inputs: { JSON: '{{fetch.JSON}}', 'Field map': TDLR_FIELD_MAP, 'Minimum date field': 'license_expiration_date_mmddccyy', 'Minimum date': 'today', Category: 'Electrical Contractors', 'Title case names': 'true' } },
        { id: 'deliver', type: TaskType.DELIVER_TO_DIRECTORY, inputs: { Listings: '{{map.Listings}}', 'Default category': 'Electrical Contractors', 'Region filter': 'true', Publish: 'true', Consolidate: 'true' } },
      ],
    },
  },
  {
    key: 'places-electrical-contractors',
    name: 'Google Places — electrical contractors (residential · commercial · industrial)',
    description:
      'Places text search across El Paso / Doña Ana sub-areas for electrical contractors, residential electricians, commercial and industrial electrical contractors. 55 queries, 10 per run (rotating), up to 60 results each; phone + website via Place Details; real place ids; multi-location brands consolidated.',
    enabled: false, // Google Places ingest disabled - see executors.ts
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
    enabled: false, // Google Places ingest disabled - see executors.ts
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
    enabled: false, // Google Places ingest disabled - see executors.ts
    interval_hours: 24,
    definition: {
      nodes: [
        { id: 'search', type: TaskType.SEARCH_GOOGLE_PLACES, inputs: { Queries: JSON.stringify(INDUSTRIAL_SUPPLY_QUERIES), 'Max queries per run': '8', 'Pages per query': '3', Category: 'Industrial Supply', 'Fetch details': 'true' } },
        { id: 'deliver', type: TaskType.DELIVER_TO_DIRECTORY, inputs: { Listings: '{{search.Listings}}', 'Default category': 'Industrial Supply', 'Region filter': 'true', Publish: 'true', Consolidate: 'true' } },
      ],
    },
  },
  {
    key: 'tdlr-beauty-establishments',
    name: 'TDLR — licensed cosmetology establishments (Beauty)',
    description:
      'TDLR open-data license file: every licensed cosmetology shop in El Paso County — full-service salons, nail/manicure, esthetician/skincare, eyelash-extension and mobile establishments. All 8 establishment sub-types (1,639 shops), 99.9% with phone and coordinates. This is shop-level licensing (a fixed, inspected location), so it never returns individual stylist/technician licenses.',
    enabled: true,
    interval_hours: 168,
    definition: {
      nodes: [
        { id: 'fetch', type: TaskType.FETCH_JSON, inputs: { URL: tdlrWhere("business_county='EL PASO' AND license_type LIKE '%Establishment%'"), 'Max items': '5000' } },
        { id: 'map', type: TaskType.MAP_JSON_TO_LISTINGS, inputs: { JSON: '{{fetch.JSON}}', 'Field map': TDLR_FIELD_MAP, 'Minimum date field': 'license_expiration_date_mmddccyy', 'Minimum date': 'today', Category: 'Beauty', 'Title case names': 'true' } },
        { id: 'deliver', type: TaskType.DELIVER_TO_DIRECTORY, inputs: { Listings: '{{map.Listings}}', 'Default category': 'Beauty', 'Region filter': 'true', Publish: 'true', Consolidate: 'true' } },
      ],
    },
  },
  {
    key: 'hhs-childcare',
    name: 'Texas HHS — licensed child care operations (El Paso County)',
    description:
      'Texas Health & Human Services Child Care Regulation open-data file (data.texas.gov bc5r-88dy): every active licensed/registered daycare, child-care home and listed family home in El Paso County — name, address, phone, email, website, operation type. ~383 operations. Weekly refresh.',
    enabled: true,
    interval_hours: 168,
    definition: {
      nodes: [
        {
          id: 'fetch',
          type: TaskType.FETCH_JSON,
          inputs: { URL: 'https://data.texas.gov/resource/bc5r-88dy.json?$limit=5000&$where=' + encodeURIComponent("county='EL PASO' AND operation_status='Y'"), 'Max items': '5000' },
        },
        {
          id: 'map',
          type: TaskType.MAP_JSON_TO_LISTINGS,
          inputs: {
            JSON: '{{fetch.JSON}}',
            'Field map': JSON.stringify({
              name: 'operation_name',
              address: 'address_line',
              city: 'city',
              state: 'state',
              phone: 'phone_number',
              email: 'email_address',
              website: 'website_address',
              description: 'operation_type',
            }),
            Category: 'Childcare & Education',
            'Title case names': 'true',
          },
        },
        { id: 'deliver', type: TaskType.DELIVER_TO_DIRECTORY, inputs: { Listings: '{{map.Listings}}', 'Default category': 'Childcare & Education', 'Region filter': 'true', Publish: 'true', Consolidate: 'true' } },
      ],
    },
  },
  {
    key: 'tdlr-west-texas-electrical-contractors',
    name: 'TDLR — licensed Electrical Contractors (West Texas)',
    description:
      'Review-first expansion from the official TDLR open-data license file (data.texas.gov 7358-krk7) for electrical contractors across 15 West Texas counties. The template is disabled and creates unpublished candidates until an operator audits source quality and duplicates.',
    enabled: false,
    interval_hours: 168,
    definition: {
      nodes: [
        { id: 'fetch', type: TaskType.FETCH_JSON, inputs: { URL: tdlrWhere(`license_type='Electrical Contractor' AND (${countyWhere('business_county')})`), 'Max items': '5000' } },
        { id: 'map', type: TaskType.MAP_JSON_TO_LISTINGS, inputs: { JSON: '{{fetch.JSON}}', 'Field map': TDLR_FIELD_MAP, 'Minimum date field': 'license_expiration_date_mmddccyy', 'Minimum date': 'today', Category: 'Electrical Contractors', 'Title case names': 'true' } },
        { id: 'deliver', type: TaskType.DELIVER_TO_DIRECTORY, inputs: { Listings: '{{map.Listings}}', 'Default category': 'Electrical Contractors', 'Region filter': 'true', Publish: 'false', Consolidate: 'true' } },
      ],
    },
  },
  {
    key: 'tdlr-west-texas-beauty-establishments',
    name: 'TDLR — licensed cosmetology establishments (West Texas)',
    description:
      'Review-first expansion from the official TDLR open-data license file for fixed cosmetology establishments across 15 West Texas counties. Individual practitioner licenses are excluded. The template is disabled and creates unpublished candidates for duplicate and quality review.',
    enabled: false,
    interval_hours: 168,
    definition: {
      nodes: [
        { id: 'fetch', type: TaskType.FETCH_JSON, inputs: { URL: tdlrWhere(`license_type LIKE '%Establishment%' AND (${countyWhere('business_county')})`), 'Max items': '5000' } },
        { id: 'map', type: TaskType.MAP_JSON_TO_LISTINGS, inputs: { JSON: '{{fetch.JSON}}', 'Field map': TDLR_FIELD_MAP, 'Minimum date field': 'license_expiration_date_mmddccyy', 'Minimum date': 'today', Category: 'Beauty', 'Title case names': 'true' } },
        { id: 'deliver', type: TaskType.DELIVER_TO_DIRECTORY, inputs: { Listings: '{{map.Listings}}', 'Default category': 'Beauty', 'Region filter': 'true', Publish: 'false', Consolidate: 'true' } },
      ],
    },
  },
  {
    key: 'hhs-west-texas-childcare',
    name: 'Texas HHS — active child care operations (West Texas)',
    description:
      'Review-first expansion from the official Texas HHS Child Care Regulation open-data file (data.texas.gov bc5r-88dy) for active operations across 15 West Texas counties. The template is disabled and keeps imported candidates unpublished pending review.',
    enabled: false,
    interval_hours: 168,
    definition: {
      nodes: [
        { id: 'fetch', type: TaskType.FETCH_JSON, inputs: { URL: 'https://data.texas.gov/resource/bc5r-88dy.json?$limit=5000&$where=' + encodeURIComponent(`operation_status='Y' AND (${countyWhere('county')})`), 'Max items': '5000' } },
        { id: 'map', type: TaskType.MAP_JSON_TO_LISTINGS, inputs: { JSON: '{{fetch.JSON}}', 'Field map': JSON.stringify({ name: 'operation_name', address: 'address_line', city: 'city', state: 'state', zip: 'zipcode', phone: 'phone_number', description: 'operation_type' }), Category: 'Childcare & Education', 'Title case names': 'true' } },
        { id: 'deliver', type: TaskType.DELIVER_TO_DIRECTORY, inputs: { Listings: '{{map.Listings}}', 'Default category': 'Childcare & Education', 'Region filter': 'true', Publish: 'false', Consolidate: 'true' } },
      ],
    },
  },
  {
    key: 'tabc-west-texas-hospitality',
    name: 'TABC — active hospitality businesses (West Texas)',
    description:
      'Review-first expansion from the official daily TABC License Information dataset (data.texas.gov 7hf9-qc9f) for active restaurants, bars and hospitality businesses across 15 West Texas counties. The template is disabled and keeps candidates unpublished until audited.',
    enabled: false,
    interval_hours: 168,
    definition: {
      nodes: [
        { id: 'fetch', type: TaskType.FETCH_JSON, inputs: { URL: 'https://data.texas.gov/resource/7hf9-qc9f.json?$limit=5000&$where=' + encodeURIComponent(`primary_status='Active' AND (${titleCaseCountyWhere('county')})`), 'Max items': '5000' } },
        { id: 'map', type: TaskType.MAP_JSON_TO_LISTINGS, inputs: { JSON: '{{fetch.JSON}}', 'Field map': JSON.stringify({ name: 'trade_name', address: 'address', city: 'city', state: 'state', zip: 'zip', description: 'license_type' }), Category: 'Restaurant', 'Title case names': 'true' } },
        { id: 'deliver', type: TaskType.DELIVER_TO_DIRECTORY, inputs: { Listings: '{{map.Listings}}', 'Default category': 'Restaurant', 'Region filter': 'true', Publish: 'false', Consolidate: 'true' } },
      ],
    },
  },
  {
    key: 'tsbde-dentists',
    name: 'TSBDE — licensed dentists (El Paso County)',
    description:
      'Texas State Board of Dental Examiners bulk CSV (ls.tsbde.texas.gov, regenerated daily): every currently-active licensed dentist with a practice address in El Paso County — ~397. No separate practice/business name is published, so each card is the dentist by name (e.g. "Iven Gonzalez"). The whole statewide file (~40k rows) is fetched and filtered client-side (no server-side query support on this endpoint).',
    enabled: true,
    interval_hours: 168,
    definition: {
      nodes: [
        { id: 'fetch', type: TaskType.FETCH_JSON, inputs: { URL: 'https://ls.tsbde.texas.gov/lib/csv/Dentist.csv', Format: 'csv', 'Max items': '60000' } },
        {
          id: 'map',
          type: TaskType.MAP_JSON_TO_LISTINGS,
          inputs: {
            JSON: '{{fetch.JSON}}',
            'Field map': JSON.stringify({
              name: 'FIRST_NME+LAST_NME',
              address: 'ADDRESS1',
              city: 'CITY',
              state: 'STATE',
              zip: 'ZIP',
              phone: 'PHONE',
              description: '=Licensed Dentist',
            }),
            'Row filter': JSON.stringify({ COUNTY: 'EL PASO', STATE: 'TX', LIC_STA_DESC: 'Active' }),
            Category: 'Health',
            'Title case names': 'true',
          },
        },
        { id: 'deliver', type: TaskType.DELIVER_TO_DIRECTORY, inputs: { Listings: '{{map.Listings}}', 'Default category': 'Health', 'Region filter': 'true', Publish: 'true', Consolidate: 'true' } },
      ],
    },
  },
  {
    key: 'cbp-customs-brokers',
    name: 'CBP — permitted customs brokers (El Paso port of entry)',
    description:
      'U.S. Customs and Border Protection\'s public "Permitted Customs Brokers" bulk CSV, filtered to a City/State of El Paso, TX — ~37 permit holders with phone and/or email. Most rows have no street address (CBP publishes city-level contact info only), so these cards show "El Paso, TX" plus phone/email. The CBP download filename changes periodically (dated); if a run starts failing with HTTP 404, refresh the URL from https://www.cbp.gov/about/contact/brokers-listing.',
    enabled: true,
    interval_hours: 720,
    definition: {
      nodes: [
        {
          id: 'fetch',
          type: TaskType.FETCH_JSON,
          inputs: { URL: 'https://www.cbp.gov/sites/default/files/2026-05/TA-015%20Broker%20Permit_Contact%20List%20Final%2005.2026.csv', Format: 'csv', 'Max items': '5000' },
        },
        {
          id: 'map',
          type: TaskType.MAP_JSON_TO_LISTINGS,
          inputs: {
            JSON: '{{fetch.JSON}}',
            'Field map': JSON.stringify({
              name: 'Permitted Broker Name',
              city: 'City',
              state: 'State',
              phone: 'Work Phone Number',
              email: 'Email Address',
              description: '=Licensed U.S. Customs Broker',
            }),
            'Row filter': JSON.stringify({ City: 'EL PASO', State: 'TX' }),
            Category: 'Logistics & Freight',
            'Title case names': 'true',
          },
        },
        { id: 'deliver', type: TaskType.DELIVER_TO_DIRECTORY, inputs: { Listings: '{{map.Listings}}', 'Default category': 'Logistics & Freight', 'Region filter': 'true', Publish: 'true', Consolidate: 'true' } },
      ],
    },
  },
  placesTemplate({
    key: 'places-home-services',
    name: 'Google Places — home services (plumbing · roofing · landscaping · HVAC · pest · solar · contractors)',
    description:
      'Places text search for plumbing, roofing, landscaping/lawn care, pest control, HVAC/AC repair, garage door, solar installers, general contractors and house cleaning. 48 queries, 10 per run (rotating).',
    queries: HOME_SERVICES_QUERIES,
    category: 'Home Services',
    maxPerRun: 10,
  }),
  placesTemplate({
    key: 'places-auto-repair',
    name: 'Google Places — auto repair, body shops, tires & towing',
    description: 'Places text search for auto repair shops, body shops, tire shops, oil change, transmission repair, detailing and towing companies. 40 queries, 10 per run (rotating).',
    queries: AUTO_REPAIR_QUERIES,
    category: 'Auto Repair',
    maxPerRun: 10,
  }),
  placesTemplate({
    key: 'places-real-estate',
    name: 'Google Places — real estate agents, brokers & property management',
    description:
      'Places text search for real estate agents, brokers, property management companies and realtors across 11 El Paso / Doña Ana sub-areas. 44 queries, 10 per run (rotating). (TREC\'s open-data license file has no address/phone, so this is the only automated source with contactable info.)',
    queries: REAL_ESTATE_QUERIES,
    category: 'Real Estate',
    maxPerRun: 10,
  }),
  placesTemplate({
    key: 'places-insurance',
    name: 'Google Places — insurance agencies',
    description: 'Places text search for insurance agencies and auto/life/home insurance agents across 11 sub-areas. 44 queries, 10 per run (rotating).',
    queries: INSURANCE_QUERIES,
    category: 'Insurance',
    maxPerRun: 10,
  }),
  placesTemplate({
    key: 'places-attorneys',
    name: 'Google Places — attorneys by practice area',
    description:
      'Places text search for immigration, personal injury, family law, criminal defense, divorce and bankruptcy attorneys. 42 queries, 10 per run (rotating). (No open bulk dataset exists for the State Bar of Texas — confirmed via research; this is the only automated source.)',
    queries: ATTORNEY_QUERIES,
    category: 'Attorneys',
    maxPerRun: 10,
  }),
  placesTemplate({
    key: 'places-health',
    name: 'Google Places — healthcare practices (dental · pediatric · urgent care · chiro · optometry · med spa · mental health)',
    description: 'Places text search for dentists, pediatricians, OB/GYNs, urgent care clinics, chiropractors, optometrists, medical spas, mental health counselors, family medicine and physical therapy clinics. 40 queries, 10 per run (rotating).',
    queries: HEALTH_QUERIES,
    category: 'Health',
    maxPerRun: 10,
  }),
  placesTemplate({
    key: 'places-event-services',
    name: 'Google Places — event & wedding services (venues · quinceañera · DJ · photography · rentals)',
    description: 'Places text search for wedding venues, quinceañera halls, event planners, wedding photographers, DJ services, event florists, party rental companies and banquet halls. 40 queries, 10 per run (rotating).',
    queries: EVENT_SERVICES_QUERIES,
    category: 'Event Services',
    maxPerRun: 10,
  }),
  placesTemplate({
    key: 'places-beauty',
    name: 'Google Places — barbershops, salons, spas & nail/lash studios',
    description:
      'Places supplement to the TDLR cosmetology-establishment feed — mainly picks up barbershops (not separately shop-licensed by TDLR) plus any salon/spa/nail/lash studio the license file missed. 42 queries, 10 per run (rotating).',
    queries: BEAUTY_QUERIES,
    category: 'Beauty',
    maxPerRun: 10,
  }),
  placesTemplate({
    key: 'places-childcare-education',
    name: 'Google Places — childcare & education (daycare · preschool · tutoring · driving/music/dance schools)',
    description: 'Places supplement to the HHS licensed-daycare feed, plus preschools, tutoring centers, driving schools, music lesson schools and kids\' dance studios. 42 queries, 10 per run (rotating).',
    queries: CHILDCARE_QUERIES,
    category: 'Childcare & Education',
    maxPerRun: 10,
  }),
  placesTemplate({
    key: 'places-retail',
    name: 'Google Places — retail (boutiques · western wear · furniture · gifts · home decor)',
    description: 'Places text search for boutique clothing, western wear, furniture, gift shops, home decor and shoe stores. 36 queries, 10 per run (rotating).',
    queries: RETAIL_QUERIES,
    category: 'Retail',
    maxPerRun: 10,
  }),
  placesTemplate({
    key: 'places-arts-culture',
    name: 'Google Places — arts & culture (galleries · studios · theater · dance companies · museums)',
    description: 'Places text search for art galleries, art/pottery studios, theater companies, dance companies and museums. 30 queries, 10 per run (rotating).',
    queries: ARTS_CULTURE_QUERIES,
    category: 'Arts & Culture',
    maxPerRun: 10,
  }),
  placesTemplate({
    key: 'places-logistics-freight',
    name: 'Google Places — logistics & freight (customs brokers · freight forwarders · 3PL · trucking)',
    description: 'Places text search across the border/industrial corridor (El Paso, Santa Teresa, Las Cruces, Horizon City) for customs brokers, freight forwarders, trucking companies, warehousing, logistics companies and 3PL. 28 queries, 8 per run (rotating). Complements the CBP customs-broker feed.',
    queries: LOGISTICS_QUERIES,
    category: 'Logistics & Freight',
    maxPerRun: 8,
  }),
  placesTemplate({
    key: 'places-business-services',
    name: 'Google Places — business services (staffing · commercial cleaning · security · janitorial)',
    description: 'Places text search for staffing agencies, commercial cleaning companies, security guard companies and janitorial services. 44 queries, 10 per run (rotating).',
    queries: BUSINESS_SERVICES_QUERIES,
    category: 'Professional Services',
    maxPerRun: 10,
  }),
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
  // --- Daily sources added 2026-10-24 -----------------------------------------
  //
  // WHY: the only 24h workflow (the El Paso Hispanic Chamber GrowthZone crawl)
  // had to be disabled — that host now answers 403 from Cloudflare bot
  // protection to a plain browser UA as well as ours, so the source has declined
  // automated access. Everything still enabled runs at 168h or 720h, leaving
  // directory growth weekly at best against 9,790 listings.
  //
  // All three below were verified by live fetch before being written: real HTTP
  // 200, real El Paso record counts, robots.txt and terms checked. They are
  // government open data, which exists to be consumed — not a crawl of someone's
  // members area.
  {
    key: 'comptroller-el-paso-new-permits',
    name: 'TX Comptroller — new sales-tax permits (El Paso County)',
    description:
      'Texas Comptroller Active Sales Tax Permit Holders (data.texas.gov jrea-zgmq, licenseId PUBLIC_DOMAIN): every business location holding an active Texas sales-tax permit in El Paso County — 19,286 after the NAICS exclusions below (re-measured 2026-10-28; this said 21,219). THE RELIABLE SOURCE: Socrata answers in under 3s from Cloud Run, where Overpass fails at the connection level. This workflow deliberately takes only the NEWEST permits each run (order by outlet_permit_issue_date DESC, 400 rows, NULL issue dates excluded) rather than the whole file. Measured volume is 323 new permits per 30 days and 1,005 per 90 — about 11 a day, not the 17-29 per weekday this once claimed — so a 400-row window spans roughly a month (2026-09-22 .. 2026-10-24 when checked) and is wide headroom against a 24h interval. The full 21,219 back-catalogue is NOT loaded here: the directory sink runs a sequential name-match query per candidate, and 21k of those cannot finish inside the route 300s budget — load the backlog deliberately from /admin/scrapeflow instead. NAICS 454110 and 454390 (home-based online and direct sellers, ~1,800 rows) and 611110 (public elementary and secondary schools, which hold sales-tax permits for fundraisers and are not directory businesses — 14 of a 400-row window) are excluded in the query because they are not storefronts. No phone or website in this dataset, so rows depend on citybeat-enrich-contacts. Publish was FALSE pending review; a 400-row batch was then reviewed through the real mapper and region filter on 2026-10-24 and the composition is genuine local inventory — 37 hobby/game shops, 18 mobile food services, 34 restaurants across four NAICS, 10 auto dealers, plus skin studios and a vineyard — so it is now TRUE. These rows arrive with NO phone or website and depend on citybeat-enrich-contacts before they are contactable.',
    enabled: true,
    interval_hours: 24,
    definition: {
      nodes: [
        {
          id: 'fetch',
          type: TaskType.FETCH_JSON,
          inputs: {
            URL:
              'https://data.texas.gov/resource/jrea-zgmq.json?$order=' +
              encodeURIComponent('outlet_permit_issue_date DESC') +
              '&$limit=400&$where=' +
              encodeURIComponent(
                // `outlet_permit_issue_date IS NOT NULL` is load-bearing, not
                // defensive. SoQL sorts NULLs FIRST on a DESC order, and 19 El
                // Paso rows have no issue date at all (verified against the live
                // dataset 2026-10-28). So the "newest 400 permits" window was
                // really 19 permanently-pinned 1961 records — SKY CHEFS #255,
                // AMERICAN AIRLINES — plus the newest 381. They are inserted on
                // the first run and skipped as existing on every run after, so
                // they cost 4.75% of each night's window forever and the loss
                // was invisible: the run still reports COMPLETED.
                "outlet_county_code='071' AND outlet_permit_issue_date IS NOT NULL" +
                  " AND outlet_naics_code NOT IN ('454110','454390','611110')"
              ),
            'Max items': '400',
          },
        },
        {
          id: 'map',
          type: TaskType.MAP_JSON_TO_LISTINGS,
          inputs: {
            JSON: '{{fetch.JSON}}',
            'Field map': JSON.stringify({
              name: 'outlet_name',
              address: 'outlet_address',
              city: 'outlet_city',
              state: 'outlet_state',
              zip: 'outlet_zip_code',
            }),
            Category: 'Professional Services',
            'Title case names': 'true',
          },
        },
        {
          id: 'deliver',
          type: TaskType.DELIVER_TO_DIRECTORY,
          inputs: {
            Listings: '{{map.Listings}}',
            'Default category': 'Professional Services',
            'Region filter': 'true',
            Publish: 'true',
            Consolidate: 'true',
          },
        },
      ],
    },
  },
  {
    key: 'fmcsa-border-carriers',
    name: 'FMCSA — active motor carriers (El Paso + Dona Ana)',
    description:
      'FMCSA Company Census (data.transportation.gov az4n-8mr2, refreshed daily; that host robots.txt has zero Disallow rules): 5,822 active motor carriers across El Paso County and Dona Ana County — trucking, freight and customs logistics, a real border vertical given the ports of entry. Name maps dba_name|legal_name because only 24% of carriers file a DBA while legal_name is always present. This is the only verified daily source that covers the New Mexico side, which the Texas Comptroller file structurally cannot. Ordered by mcs150_date DESC so each run sees the most recently-filed carriers; because that date refreshes when a carrier files its biennial update, the window rotates through the set over time instead of re-reading a fixed head. 98% of rows carry a PHONE, so these listings are contactable the moment they land — which matters more than usual now that claim verification can text a code. Publish is FALSE: a large share of active carriers are sole proprietors filed under a personal name at what is frequently a home address, and publishing those as businesses is a different proposition from publishing an inspected storefront. Review a batch at /admin/scrapeflow before flipping it.',
    enabled: true,
    interval_hours: 24,
    definition: {
      nodes: [
        {
          id: 'fetch',
          type: TaskType.FETCH_JSON,
          inputs: {
            URL:
              'https://data.transportation.gov/resource/az4n-8mr2.json?$order=' +
              encodeURIComponent('mcs150_date DESC') +
              '&$limit=600&$where=' +
              encodeURIComponent(
                "status_code='A' AND upper(phy_city) in('EL PASO','SOCORRO','HORIZON CITY','VINTON','CLINT','SAN ELIZARIO','CANUTILLO','FABENS','TORNILLO','ANTHONY','LAS CRUCES','SANTA TERESA','SUNLAND PARK','MESILLA')"
              ),
            'Max items': '600',
          },
        },
        {
          id: 'map',
          type: TaskType.MAP_JSON_TO_LISTINGS,
          inputs: {
            JSON: '{{fetch.JSON}}',
            'Field map': JSON.stringify({
              name: 'dba_name|legal_name',
              address: 'phy_street',
              city: 'phy_city',
              state: 'phy_state',
              zip: 'phy_zip',
              phone: 'phone',
            }),
            Category: 'Logistics & Freight',
            'Title case names': 'true',
          },
        },
        {
          id: 'deliver',
          type: TaskType.DELIVER_TO_DIRECTORY,
          inputs: {
            Listings: '{{map.Listings}}',
            'Default category': 'Logistics & Freight',
            'Region filter': 'true',
            Publish: 'false',
            Consolidate: 'true',
          },
        },
      ],
    },
  },
  {
    key: 'tabc-el-paso-hospitality',
    name: 'TABC — active hospitality businesses (El Paso County)',
    description:
      'TABC License Information (data.texas.gov 7hf9-qc9f, refreshed daily): 1,892 active restaurant, bar and hospitality licences in El Paso County, each with a trade name and street address. The phone column is EMPTY for every El Paso row (verified across all 1,892), so it is not mapped and these rows depend on citybeat-enrich-contacts; trade_name is populated on 86%, and the mapper drops the remainder as invalid. The repo already carried this dataset as tabc-west-texas-hospitality — a 15-county, review-first expansion at interval_hours 168 with Publish false — whose own description called the source daily while polling it weekly. This is the El Paso-scoped daily counterpart, published like the other county-scoped licence sources (tdlr-electrical-contractors, tdlr-beauty-establishments): a TABC licence is a fixed, inspected premises, so the trade name is a real storefront. All 1,892 fit in one run, so this fully loads the source and thereafter costs only existence checks.',
    enabled: true,
    interval_hours: 24,
    definition: {
      nodes: [
        {
          id: 'fetch',
          type: TaskType.FETCH_JSON,
          inputs: {
            URL:
              'https://data.texas.gov/resource/7hf9-qc9f.json?$limit=2500&$where=' +
              encodeURIComponent("primary_status='Active' AND upper(county)='EL PASO'"),
            'Max items': '2500',
          },
        },
        {
          id: 'map',
          type: TaskType.MAP_JSON_TO_LISTINGS,
          inputs: {
            JSON: '{{fetch.JSON}}',
            'Field map': JSON.stringify({
              name: 'trade_name',
              address: 'address',
              city: 'city',
              state: 'state',
              zip: 'zip',
            }),
            Category: 'Restaurant',
            'Title case names': 'true',
          },
        },
        {
          id: 'deliver',
          type: TaskType.DELIVER_TO_DIRECTORY,
          inputs: {
            Listings: '{{map.Listings}}',
            'Default category': 'Restaurant',
            'Region filter': 'true',
            Publish: 'true',
            Consolidate: 'true',
          },
        },
      ],
    },
  },
]

export function getTemplate(key: string): WorkflowTemplate | null {
  return WORKFLOW_TEMPLATES.find((t) => t.key === key) || null
}
