import { DIRECTORY_CATEGORIES } from '@/lib/categories'

// NAICS → CityBeat directory category.
//
// WHY THIS EXISTS. The Texas Comptroller feed is the directory's only reliably
// growing source, and it filed every row under one blanket category: the first
// batch put donut shops, a golf company and a wireless dealer in "Professional
// Services" alongside actual professional services. The dataset carries
// `outlet_naics_code` — a precise federal industry classifier — and nothing
// read it. Category drives the browse pages, the category SEO surfaces and the
// sales verticals, so a directory where 19,286 businesses share one category
// is a directory nobody can browse.
//
// TWO DESIGN RULES, both deliberate:
//
//   1. LONGEST PREFIX WINS. NAICS is hierarchical — 2-digit sector, 3-digit
//      subsector, 4-digit industry group, 6-digit national industry — so
//      `722515` is matched before `7225`, which is matched before `722`, which
//      is matched before `72`. That lets a sector have a sane default while
//      specific codes inside it are still routed precisely.
//
//   2. NO GUESSING. An unmapped code returns null and the caller keeps its
//      configured default. A confident-but-wrong category is worse than an
//      honest "Professional Services", because a wrong one is invisible: it
//      looks categorised. Coverage is therefore partial on purpose, and
//      measurable — see naics.test.ts, which asserts against the real
//      distribution of El Paso codes.
//
// Every value must be a member of DIRECTORY_CATEGORIES; a typo would write a
// category no browse page lists, so the table is validated at module load.

const NAICS_CATEGORY: Record<string, string> = {
  // ─── 11/21/22 Agriculture, mining, utilities ─────────────────────────────
  '11': 'Professional Services',
  '21': 'Industrial Supply',
  '22': 'Home Services', // utilities: water/sewer/electric services to premises

  // ─── 23 Construction → trades ────────────────────────────────────────────
  '23': 'Home Services',
  '238210': 'Electrical Contractors', // the directory has its own vertical
  '238220': 'Home Services', // plumbing, HVAC
  '238290': 'Automation & Controls', // other building equipment contractors
  '238160': 'Home Services', // roofing
  '238990': 'Home Services',

  // ─── 31-33 Manufacturing ─────────────────────────────────────────────────
  '31': 'Retail',
  '32': 'Industrial Supply',
  '33': 'Industrial Supply',
  '311811': 'Retail', // retail bakeries — storefronts, not factories
  '312120': 'Bar', // breweries
  '312130': 'Bar', // wineries
  '312140': 'Bar', // distilleries
  '334513': 'Automation & Controls', // industrial process control instruments
  '335': 'Industrial Supply',

  // ─── 42 Wholesale ────────────────────────────────────────────────────────
  '42': 'Industrial Supply',

  // ─── 44-45 Retail ────────────────────────────────────────────────────────
  '44': 'Retail',
  '45': 'Retail',
  '441': 'Auto Dealer',
  '4411': 'Auto Dealer',
  '441110': 'Auto Dealer',
  '441120': 'Auto Dealer',
  '441210': 'Auto Dealer', // recreational vehicle
  '441222': 'Auto Dealer', // boat
  '441227': 'Auto Dealer', // motorcycle/ATV
  '4413': 'Auto Repair', // auto parts, accessories and tire stores
  '441330': 'Auto Repair',
  '441340': 'Auto Repair',
  '446': 'Health', // health and personal care stores
  '446110': 'Health', // pharmacies and drug stores
  '44611': 'Health',
  '4461': 'Health',
  // Cosmetics and beauty-supply stores sit inside the "Health and Personal
  // Care" subsector, so the 446 prefix filed them as Health. A beauty supply
  // shop belongs with salons, not pharmacies — caught by reviewing the real
  // backfill output rather than the table in the abstract.
  '446120': 'Beauty',
  '444': 'Retail', // building material and garden supply (home centers)
  '453920': 'Arts & Culture', // art dealers
  '459920': 'Arts & Culture', // art dealers (2022 revision)
  '451140': 'Arts & Culture', // musical instrument stores
  '459130': 'Arts & Culture',

  // ─── 48-49 Transportation and warehousing ────────────────────────────────
  '48': 'Logistics & Freight',
  '49': 'Logistics & Freight',
  '484': 'Logistics & Freight',
  '4885': 'Logistics & Freight', // freight transportation arrangement
  '488510': 'Logistics & Freight', // freight forwarders, customs brokers
  '493': 'Logistics & Freight',
  '492': 'Logistics & Freight',
  '485310': 'Logistics & Freight', // taxi — moving people, but same vertical

  // ─── 51 Information ──────────────────────────────────────────────────────
  '51': 'Professional Services',
  '512131': 'Entertainment', // motion picture theaters
  '5121': 'Entertainment',
  '513210': 'Web Development', // software publishers
  '511210': 'Web Development', // software publishers (pre-2022)
  '5182': 'Web Development', // data processing, hosting
  '518210': 'Web Development',
  '516': 'Marketing', // broadcasting (2022) — ad-funded media
  '515': 'Marketing', // broadcasting (pre-2022)
  '541870': 'Marketing',

  // ─── 52 Finance and insurance ────────────────────────────────────────────
  '52': 'Financial',
  '5221': 'Financial',
  '5222': 'Financial',
  '523': 'Financial',
  '5242': 'Insurance', // agencies and brokerages
  '524210': 'Insurance',
  '5241': 'Insurance', // carriers
  '524': 'Insurance',
  // Title insurance carriers are inside the insurance subsector, so the 5241
  // prefix filed Sierra Title, Weststar Title and Chicago Title under
  // Insurance — while the directory has a dedicated Title & Notary vertical
  // that closing-related searches actually use. 9 rows in El Paso County.
  '524127': 'Title & Notary', // direct title insurance carriers
  '524128': 'Title & Notary', // other direct title-adjacent carriers

  // ─── 53 Real estate and rental ───────────────────────────────────────────
  '53': 'Real Estate',
  '531': 'Real Estate',
  // 531 is three unrelated audiences, and mapping it wholesale filed all of
  // them as Real Estate: El Paso County holds 9 agent/broker offices (531210)
  // against 30 residential lessors (531110) and 57 self-storage operators
  // (531130). "Chimneys Apartments Limited Partnership" and "My Storage" are
  // real businesses people search for, but they are not what a reader or a
  // sales rep means by Real Estate, and at 10:1 they drowned out the offices.
  // Commercial and land lessors (531120/531190) stay — leasing premises IS
  // what a business looks for under Real Estate — as do managers and
  // appraisers.
  '531110': 'Apartments & Rentals', // lessors of residential buildings
  '531130': 'Self Storage', // miniwarehouses and self-storage units
  '531210': 'Real Estate', // offices of real estate agents and brokers
  '531311': 'Real Estate',
  '532': 'Event Services', // rental and leasing — party/equipment rental
  '532283': 'Home Services',
  '532412': 'Industrial Supply', // heavy equipment rental
  '532310': 'Home Services', // general rental centers

  // ─── 54 Professional, scientific and technical ───────────────────────────
  '54': 'Professional Services',
  '5411': 'Attorneys',
  '541110': 'Attorneys',
  '541120': 'Title & Notary', // offices of notaries
  '541191': 'Title & Notary', // title abstract and settlement offices
  '5412': 'Financial', // accounting, tax prep, bookkeeping, payroll
  '541211': 'Financial',
  '541213': 'Financial',
  '5413': 'Professional Services', // architecture, engineering
  '541330': 'Professional Services',
  '541430': 'Marketing', // graphic design
  '5415': 'Web Development', // computer systems design and related
  '541511': 'Web Development',
  '541512': 'Web Development',
  '541513': 'Web Development',
  '541519': 'Web Development',
  '5418': 'Marketing', // advertising, PR and related
  '541810': 'Marketing',
  '541820': 'Marketing',
  '541921': 'Event Services', // photography studios
  '541922': 'Event Services', // commercial photography
  '541940': 'Health', // veterinary services

  // ─── 56 Administrative and support ───────────────────────────────────────
  '56': 'Professional Services',
  '561730': 'Home Services', // landscaping
  '561710': 'Home Services', // pest control
  '561720': 'Home Services', // janitorial
  '561740': 'Home Services', // carpet and upholstery cleaning
  '561790': 'Home Services',
  '561920': 'Event Services', // convention and trade show organizers
  '562': 'Home Services', // waste management

  // ─── 61 Educational services ─────────────────────────────────────────────
  '61': 'Childcare & Education',

  // ─── 62 Health care and social assistance ────────────────────────────────
  '62': 'Health',
  '6244': 'Childcare & Education', // child day care services
  '624410': 'Childcare & Education',

  // ─── 71 Arts, entertainment and recreation ───────────────────────────────
  '71': 'Entertainment',
  '711110': 'Arts & Culture', // theater companies and dinner theaters
  '711130': 'Arts & Culture', // musical groups and artists
  '711510': 'Arts & Culture', // independent artists, writers, performers
  '712': 'Arts & Culture', // museums, historical sites
  '713940': 'Fitness', // fitness and recreational sports centers
  '713910': 'Fitness', // golf courses and country clubs
  '713950': 'Entertainment', // bowling

  // ─── 72 Accommodation and food services ──────────────────────────────────
  '72': 'Restaurant',
  '721': 'Entertainment', // accommodation — hotels are a visitor surface
  '722': 'Restaurant',
  '722410': 'Bar', // drinking places (alcoholic beverages)
  '722511': 'Restaurant', // full-service
  '722513': 'Restaurant', // limited-service
  '722514': 'Restaurant', // cafeterias
  '722515': 'Coffee Shop', // snack and nonalcoholic beverage bars
  '722310': 'Event Services', // food service contractors
  '722320': 'Event Services', // caterers
  '722330': 'Restaurant', // mobile food services (food trucks)

  // ─── 81 Other services ──────────────────────────────────────────────────
  '81': 'Professional Services',
  '8111': 'Auto Repair',
  '811111': 'Auto Repair',
  '811121': 'Auto Repair',
  '8112': 'Professional Services', // electronic and precision equipment repair
  '811412': 'Home Services', // appliance repair
  '8113': 'Industrial Supply', // commercial machinery repair
  '8121': 'Beauty',
  '812111': 'Beauty', // barber shops
  '812112': 'Beauty', // beauty salons
  '812113': 'Beauty', // nail salons
  '812199': 'Beauty', // other personal care (skin, med spa)
  '8123': 'Home Services', // laundry and dry cleaning
  '812930': 'Logistics & Freight', // parking lots and garages
  '8129': 'Event Services', // other personal services (party, pet care)
  // 813 is religious, grantmaking, civic and professional ORGANISATIONS. It was
  // briefly mapped to Arts & Culture, which filed "Calvary Fellowship Of New
  // Beginnings" as an arts venue. A church, a chamber of commerce and a trade
  // association are not arts and culture; they keep the generic category, which
  // is also what normalize.ts's keyword rules already do with /church/.
  '813': 'Professional Services',
}

// A value outside DIRECTORY_CATEGORIES would be written straight into
// `listing.category` and then match no browse page, no category slug and no
// search facet — a silent dead end. Caught here, at import, rather than in a
// nightly cron's output.
const ALLOWED = new Set<string>(DIRECTORY_CATEGORIES)
for (const [code, category] of Object.entries(NAICS_CATEGORY)) {
  if (!ALLOWED.has(category)) {
    throw new Error(`naics.ts: "${category}" (code ${code}) is not in DIRECTORY_CATEGORIES`)
  }
}

/**
 * The directory category for a NAICS code, or null when there is no confident
 * mapping — in which case the caller must keep its configured default rather
 * than inventing one.
 *
 * Accepts the loose shapes government feeds actually emit: a number, a padded
 * or truncated string, or a code with trailing junk. Anything under two digits
 * carries no sector information and is rejected.
 */
export function naicsCategory(raw: unknown): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.length < 2) return null
  // Longest prefix first: 722515 beats 7225 beats 722 beats 72.
  for (let length = Math.min(digits.length, 6); length >= 2; length--) {
    const hit = NAICS_CATEGORY[digits.slice(0, length)]
    if (hit) return hit
  }
  return null
}

/** Codes the table knows about, for coverage reporting. */
export const NAICS_PREFIX_COUNT = Object.keys(NAICS_CATEGORY).length
