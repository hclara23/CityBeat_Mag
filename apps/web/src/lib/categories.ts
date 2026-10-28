// Directory categories. `listing.category` is stored in ENGLISH (stable value
// used for filtering, SEO slugs, and ingest), and we translate ONLY for display
// so nothing downstream breaks. Mirrors the ingest verticals in
// packages/lib/src/directory/crawlee-ingest.ts.

export const DIRECTORY_CATEGORIES = [
  'Restaurant',
  'Cafe',
  'Coffee Shop',
  'Bar',
  'Retail',
  'Auto Dealer',
  'Auto Repair',
  'Home Services',
  'Beauty',
  'Health',
  'Fitness',
  'Entertainment',
  'Arts & Culture',
  'Professional Services',
  'Real Estate',
  // Split out of 'Real Estate' on 2026-10-28. NAICS 531 lumps three unrelated
  // audiences together: in El Paso County it is 9 agent/broker offices against
  // 30 residential lessors and 57 self-storage operators, so a single category
  // made the Real Estate page read as an apartment list and buried the agents
  // the sales pitch targets. Renters and people moving house search for these
  // directly, so they are their own destinations rather than a sub-filter.
  'Apartments & Rentals',
  'Self Storage',
  'Attorneys',
  'Title & Notary',
  'Insurance',
  'Financial',
  'Marketing',
  'Web Development',
  'Electrical Contractors',
  'Automation & Controls',
  'Industrial Supply',
  'Event Services',
  'Childcare & Education',
  'Logistics & Freight',
] as const

const ES_LABELS: Record<string, string> = {
  Restaurant: 'Restaurante',
  Cafe: 'Café',
  'Coffee Shop': 'Cafetería',
  Bar: 'Bar',
  Retail: 'Tienda',
  'Auto Dealer': 'Concesionario de Autos',
  'Auto Repair': 'Taller Mecánico',
  'Home Services': 'Servicios para el Hogar',
  Beauty: 'Belleza',
  Health: 'Salud',
  Fitness: 'Gimnasio',
  Entertainment: 'Entretenimiento',
  'Arts & Culture': 'Arte y Cultura',
  'Professional Services': 'Servicios Profesionales',
  'Real Estate': 'Bienes Raíces',
  'Apartments & Rentals': 'Apartamentos y Alquileres',
  'Self Storage': 'Bodegas de Almacenamiento',
  Attorneys: 'Abogados',
  'Title & Notary': 'Títulos y Notaría',
  Insurance: 'Seguros',
  Financial: 'Servicios Financieros',
  Marketing: 'Marketing',
  'Web Development': 'Desarrollo Web',
  'Electrical Contractors': 'Contratistas Eléctricos',
  'Automation & Controls': 'Automatización y Control',
  'Industrial Supply': 'Suministros Industriales',
  'Event Services': 'Servicios para Eventos',
  'Childcare & Education': 'Cuidado Infantil y Educación',
  'Logistics & Freight': 'Logística y Carga',
}

// Localized display label. Value stays English everywhere else.
export function categoryLabel(category: string | null | undefined, locale: string): string {
  if (!category) return locale === 'es' ? 'Negocio' : 'Business'
  const canonical = Object.keys(ES_LABELS).find((key) => key.toLowerCase() === category.trim().toLowerCase()) || category
  if (locale === 'es') return ES_LABELS[canonical] || category
  return category
}
