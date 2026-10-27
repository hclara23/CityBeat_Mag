import { resolveHours } from './directory-hours'

const DAY = { Monday: 'Mo', Tuesday: 'Tu', Wednesday: 'We', Thursday: 'Th', Friday: 'Fr', Saturday: 'Sa', Sunday: 'Su' } as const

export function parsePostalAddress(value: string) {
  const parts = value.split(',').map((part) => part.trim()).filter(Boolean)
  const regionPart = parts.at(-1) || ''
  const regionMatch = regionPart.match(/^(TX|NM|Texas|New Mexico)\s+(\d{5}(?:-\d{4})?)$/i)
  const region = regionMatch?.[1].toUpperCase().replace('TEXAS', 'TX').replace('NEW MEXICO', 'NM') || undefined
  const postalCode = regionMatch?.[2]
  const addressLocality = parts.length >= 3 ? parts.at(-2) : undefined
  const streetAddress = parts.length >= 3 ? parts.slice(0, -2).join(', ') : value
  return {
    '@type': 'PostalAddress',
    streetAddress,
    ...(addressLocality ? { addressLocality } : {}),
    ...(region ? { addressRegion: region } : {}),
    ...(postalCode ? { postalCode } : {}),
    addressCountry: 'US',
  }
}

function to24Hour(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i)
  if (!match) return null
  let hour = Number(match[1])
  const minute = match[2] || '00'
  if (hour < 1 || hour > 12 || Number(minute) > 59) return null
  if (match[3].toUpperCase() === 'PM' && hour !== 12) hour += 12
  if (match[3].toUpperCase() === 'AM' && hour === 12) hour = 0
  return `${String(hour).padStart(2, '0')}:${minute}`
}

export function schemaOpeningHours(hours: unknown): string[] {
  // Read through resolveHours so the OSM `{ opening_hours: 'Mo-Fr 08:00-17:00' }`
  // shape reaches Google too. 138 listings in a 4,000-row sample of the live
  // collection store their real hours that way, and this function only ever
  // looked for per-day keys — so those businesses published no
  // openingHoursSpecification at all, which is exactly the rich-result field a
  // local directory exists to win. Anything resolveHours cannot read with
  // certainty comes back null and is omitted, as before: an empty map already
  // yielded [] here, so no listing has ever been described to Google as closed.
  const resolved = resolveHours(hours)
  if (!resolved) return []
  return Object.entries(resolved).flatMap(([day, value]) => {
    const code = DAY[day as keyof typeof DAY]
    if (!code || !value || /closed/i.test(value)) return []
    const match = value.match(/^\s*(.+?)\s*(?:-|–|—|to)\s*(.+?)\s*$/i)
    const opens = match ? to24Hour(match[1]) : null
    const closes = match ? to24Hour(match[2]) : null
    return opens && closes ? [`${code} ${opens}-${closes}`] : []
  })
}

const SCHEMA_TYPES: Record<string, string> = {
  Restaurant: 'Restaurant', Cafe: 'CafeOrCoffeeShop', 'Coffee Shop': 'CafeOrCoffeeShop', Bar: 'BarOrPub',
  'Auto Dealer': 'AutoDealer', 'Auto Repair': 'AutoRepair', Beauty: 'BeautySalon', Health: 'MedicalBusiness',
  Attorneys: 'Attorney', Financial: 'FinancialService', Insurance: 'InsuranceAgency', 'Real Estate': 'RealEstateAgent',
}

export function schemaTypeForCategory(category: string | null | undefined): string {
  return (category && SCHEMA_TYPES[category]) || 'LocalBusiness'
}
