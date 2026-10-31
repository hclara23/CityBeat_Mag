export type PropertyCompany = {
  id: string; name: string; aliases: string[]; website: string; portfolioSource: string
  phone: string; region: string; inventoryNote: { en: string; es: string }
}

// Public source attribution establishes a directory relationship, never account access.
export const PROPERTY_COMPANIES: readonly PropertyCompany[] = [
  { id: 'integrity-asset-management', name: 'Integrity Asset Management', aliases: [], website: 'https://www.integrityamc.com/', portfolioSource: 'https://www.integrityamc.com/multi-family-communities', phone: '9157725170', region: 'El Paso / San Elizario', inventoryNote: { en: 'Communities published in the management company’s multifamily directory.', es: 'Comunidades publicadas en el directorio multifamiliar de la administradora.' } },
  { id: 'case-associates', name: 'Case & Associates', aliases: [], website: 'https://www.caseusa.com/', portfolioSource: 'https://www.caseusa.com/apartments/tx/el-paso/', phone: '9184921983', region: 'El Paso', inventoryNote: { en: 'Nine El Paso communities in the official regional directory.', es: 'Nueve comunidades de El Paso en el directorio regional oficial.' } },
  { id: 'rpm-living', name: 'RPM Living', aliases: [], website: 'https://rpmliving.com/',
    portfolioSource: 'https://rpmliving.com/find-a-community-post-search/', phone: '', region: 'El Paso',
    inventoryNote: { en: '10 El Paso communities in the official directory.', es: '10 comunidades de El Paso en el directorio oficial.' } },
  { id: 'm7-elp', name: 'M7 ELP', aliases: ['Monterrey Asset', 'Monterrey Properties'], website: 'https://www.m7elp.com/',
    portfolioSource: 'https://www.m7elp.com/search.html', phone: '9155924549', region: 'El Paso',
    inventoryNote: { en: '19 El Paso locations in the official locator. Combined community entries retain their published grouping; the Alamogordo location is outside this local catalog.', es: '19 ubicaciones de El Paso en el localizador oficial. Las comunidades agrupadas conservan su agrupación publicada; la ubicación en Alamogordo está fuera de este catálogo local.' } },
  { id: 'haggerty-company', name: 'Haggerty Company Property Management', aliases: ['Century 21 Haggerty'], website: 'https://www.haggertyrentals.com/',
    portfolioSource: 'https://www.haggertyrentals.com/vacancies', phone: '9157573445', region: 'El Paso / Las Cruces',
    inventoryNote: { en: 'Apartment-community inventory has not been confirmed. Public vacancies include individual homes and do not establish the total managed portfolio. The company may submit its community roster for review.', es: 'El inventario de comunidades de apartamentos no está confirmado. Las vacantes públicas incluyen casas individuales y no representan el total administrado. La empresa puede enviar su cartera de comunidades para revisión.' } },
]
export const getPropertyCompany = (id: string) => PROPERTY_COMPANIES.find(company => company.id === id)
export const PROPERTY_PORTFOLIO_MONTHLY_CENTS = 999
export const PROPERTY_PORTFOLIO_REGULAR_CENTS = 1999
export const PROPERTY_PORTFOLIO_PROMO = 'property_portfolio_founders'
