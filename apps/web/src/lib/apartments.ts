import { M7_APARTMENTS } from './apartment-m7'
import { RESEARCHED_APARTMENTS } from './apartment-researched'
import { getPropertyCompany, type PropertyCompany } from './property-companies'
export type ApartmentLocale = 'en' | 'es'
export type CommunityType = 'apartments' | 'rental-homes' | 'single-family' | 'duplex' | 'condo' | 'townhome' | 'commercial' | 'other-rental'
export type ApartmentCommunity = {
  slug: string
  name: string
  address: string
  zip: string
  phone: string
  website: string
  type: CommunityType
  summary: Record<ApartmentLocale, string>
  highlights: Record<ApartmentLocale, string[]>
  detailSource?: string
  companyId?: string
  source?: string
  city?: string
  state?: string
  submitted?: boolean
  companyDetails?: PropertyCompany
}

// Curated public directory records, not claimed businesses or paid endorsements.
// Contact numbers are those published by RPM and may be leasing tracking lines.
export const APARTMENT_SOURCE = 'https://rpmliving.com/find-a-community-post-search/'
export const APARTMENT_VERIFIED = '2026-10-30'
export const APARTMENT_MANAGER = 'RPM Living'
export const apartmentCompanyId = (community: ApartmentCommunity) => community.companyId || 'rpm-living'
export const apartmentCompany = (community: ApartmentCommunity) => getPropertyCompany(apartmentCompanyId(community)) || community.companyDetails!
export const apartmentSource = (community: ApartmentCommunity) => community.source || APARTMENT_SOURCE
export const APARTMENT_COMMUNITIES: readonly ApartmentCommunity[] = [
  {
    slug: 'alza-dwellings', name: 'ALZA Dwellings', address: '1831 Murchison Drive', zip: '79902', phone: '9152655427', website: 'https://www.alzadwellings.com/', type: 'apartments',
    summary: { en: 'Studio, one- and two-bedroom apartments on Murchison Drive near Scenic Drive.', es: 'Estudios y apartamentos de una y dos recámaras en Murchison Drive, cerca de Scenic Drive.' },
    highlights: { en: ['Studio, 1–2 bedrooms', 'Pool', 'Fitness center', 'Pet friendly'], es: ['Estudios, 1–2 recámaras', 'Alberca', 'Gimnasio', 'Admite mascotas'] }, detailSource: 'https://www.alzadwellings.com/amenities',
  },
  {
    slug: 'desert-commons-east', name: 'Desert Commons East', address: '2801 N Zaragoza', zip: '79938', phone: '9152493364', website: 'https://www.desertcommonseast.com/', type: 'apartments',
    summary: { en: 'An El Paso apartment community on North Zaragoza. Contact the leasing team for floor plans and amenities.', es: 'Una comunidad de apartamentos en North Zaragoza, El Paso. Consulta los planos y las amenidades con el equipo de arrendamiento.' },
    highlights: { en: [], es: [] },
  },
  {
    slug: 'desert-commons-west', name: 'Desert Commons West', address: '208 Isela Rubalcava Blvd', zip: '79932', phone: '9156215651', website: 'https://www.desertcommonswest.com/', type: 'apartments',
    summary: { en: 'One-, two- and three-bedroom apartments with a pool, fitness center and dog park.', es: 'Apartamentos de una, dos y tres recámaras con alberca, gimnasio y parque para perros.' },
    highlights: { en: ['1–3 bedrooms', 'Pool', 'Fitness center', 'Dog park'], es: ['1–3 recámaras', 'Alberca', 'Gimnasio', 'Parque para perros'] }, detailSource: 'https://www.desertcommonswest.com/',
  },
  {
    slug: 'ridgemar', name: 'Ridgemar', address: '10701 Vista Del Sol Drive', zip: '79935', phone: '9152853253', website: 'https://www.ridgemarapts.com/', type: 'apartments',
    summary: { en: 'Pet-friendly one-, two- and three-bedroom apartments on Vista Del Sol Drive.', es: 'Apartamentos de una, dos y tres recámaras que admiten mascotas en Vista Del Sol Drive.' },
    highlights: { en: ['1–3 bedrooms', 'Pool', 'Laundry facilities', 'Pet friendly'], es: ['1–3 recámaras', 'Alberca', 'Lavandería', 'Admite mascotas'] }, detailSource: 'https://www.ridgemarapts.com/',
  },
  {
    slug: 'sun-hollow', name: 'Sun Hollow', address: '1601 Lee Trevino Drive', zip: '79936', phone: '9152371481', website: 'https://www.sunhollowapts.com/', type: 'apartments',
    summary: { en: 'One-, two- and three-bedroom apartments on Lee Trevino Drive with a pool and fitness center.', es: 'Apartamentos de una, dos y tres recámaras en Lee Trevino Drive con alberca y gimnasio.' },
    highlights: { en: ['1–3 bedrooms', 'Pool', 'Fitness center'], es: ['1–3 recámaras', 'Alberca', 'Gimnasio'] }, detailSource: 'https://www.sunhollowapts.com/',
  },
  {
    slug: 'lake-fairway', name: 'Lake Fairway', address: '1642 Lomaland Drive', zip: '79935', phone: '9152776378', website: 'https://www.lakefairway.com/', type: 'apartments',
    summary: { en: 'Studio, one- and two-bedroom apartments on Lomaland Drive with two pools and shared laundry facilities.', es: 'Estudios y apartamentos de una y dos recámaras en Lomaland Drive con dos albercas y lavanderías compartidas.' },
    highlights: { en: ['Studio, 1–2 bedrooms', 'Two pools', 'Laundry facilities', 'Pet friendly'], es: ['Estudios, 1–2 recámaras', 'Dos albercas', 'Lavandería', 'Admite mascotas'] }, detailSource: 'https://www.lakefairway.com/',
  },
  {
    slug: 'spring-park', name: 'Spring Park', address: '9535 Acer Drive', zip: '79925', phone: '9152334859', website: 'https://www.springparkelpaso.com/', type: 'apartments',
    summary: { en: 'One-, two- and three-bedroom apartments with washer/dryer connections, a fitness center and dog park.', es: 'Apartamentos de una, dos y tres recámaras con conexiones para lavadora y secadora, gimnasio y parque para perros.' },
    highlights: { en: ['1–3 bedrooms', 'Washer/dryer connections', 'Fitness center', 'Dog park'], es: ['1–3 recámaras', 'Conexiones para lavadora y secadora', 'Gimnasio', 'Parque para perros'] }, detailSource: 'https://www.springparkelpaso.com/',
  },
  {
    slug: 'independence-place-el-paso', name: 'Independence Place El Paso', address: '4011 Alabama Street', zip: '79930', phone: '9152867583', website: 'https://www.ipelpaso.com/', type: 'apartments',
    summary: { en: 'One- through four-bedroom apartments with furnished layouts offered on Alabama Street.', es: 'Apartamentos de una a cuatro recámaras con opciones amuebladas en Alabama Street.' },
    highlights: { en: ['1–4 bedrooms', 'Furnished options', 'Pool', 'Pet friendly'], es: ['1–4 recámaras', 'Opciones amuebladas', 'Alberca', 'Admite mascotas'] }, detailSource: 'https://www.ipelpaso.com/',
  },
  {
    slug: 'the-legends-of-el-paso', name: 'The Legends of El Paso', address: '200 Desert Pass Street', zip: '79912', phone: '9152857674', website: 'https://www.livelegendsofelpaso.com/', type: 'apartments',
    summary: { en: 'One- and two-bedroom apartments with dog parks, a pool and fitness center on Desert Pass Street.', es: 'Apartamentos de una y dos recámaras con parques para perros, alberca y gimnasio en Desert Pass Street.' },
    highlights: { en: ['1–2 bedrooms', 'Pool', 'Fitness center', 'Washer/dryer connections'], es: ['1–2 recámaras', 'Alberca', 'Gimnasio', 'Conexiones para lavadora y secadora'] }, detailSource: 'https://www.livelegendsofelpaso.com/',
  },
  {
    slug: 'terralane-at-campo-del-sol', name: 'TerraLane at Campo Del Sol', address: '51046 Agave Court', zip: '79934', phone: '9156668044', website: 'https://www.tlcatcampodelsol.com/', type: 'rental-homes',
    summary: { en: 'A single-family rental-home community offering three- and four-bedroom homes. Included alongside apartments as another local RPM Living community.', es: 'Una comunidad de casas unifamiliares de renta con tres y cuatro recámaras. Incluida junto a los apartamentos como otra comunidad local administrada por RPM Living.' },
    highlights: { en: ['3–4 bedrooms', 'Attached two-car garages', 'Pet friendly', 'Lazy river and splash pad'], es: ['3–4 recámaras', 'Cochera adjunta para dos autos', 'Admite mascotas', 'Río lento y zona de juegos acuáticos'] }, detailSource: 'https://www.tlcatcampodelsol.com/',
  },
  ...M7_APARTMENTS,
  ...RESEARCHED_APARTMENTS,
]

export function communityTypeLabel(type: CommunityType, locale: ApartmentLocale) {
  return PROPERTY_TYPES[type][locale]
}

export const PROPERTY_TYPES: Record<CommunityType, Record<ApartmentLocale, string>> = {
  apartments: { en: 'Apartment complex', es: 'Complejo de apartamentos' },
  'rental-homes': { en: 'Rental community', es: 'Comunidad de alquiler' },
  'single-family': { en: 'Single-family home', es: 'Casa unifamiliar' },
  duplex: { en: 'Duplex', es: 'Dúplex' },
  condo: { en: 'Condo', es: 'Condominio' },
  townhome: { en: 'Townhome', es: 'Casa adosada' },
  commercial: { en: 'Commercial building', es: 'Edificio comercial' },
  'other-rental': { en: 'Other rental property', es: 'Otra propiedad de alquiler' },
}

const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim()

export function searchApartments(query = '', zip = '', type = '', catalog: readonly ApartmentCommunity[] = APARTMENT_COMMUNITIES) {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  return catalog.filter(community => {
    if (zip && community.zip !== zip) return false
    if (type && community.type !== type) return false
    const text = normalize([community.name, community.address, community.zip, community.city || 'El Paso', community.state || 'TX', apartmentCompany(community).name,
      community.summary.en, community.summary.es, ...community.highlights.en, ...community.highlights.es,
      communityTypeLabel(community.type, 'en'), communityTypeLabel(community.type, 'es')].join(' '))
    return words.every(word => text.includes(word))
  })
}

export function getApartment(slug: string) {
  return APARTMENT_COMMUNITIES.find(community => community.slug === slug)
}

export function apartmentPhone(phone: string) {
  return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`
}
