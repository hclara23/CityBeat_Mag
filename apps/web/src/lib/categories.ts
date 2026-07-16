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
  'Attorneys',
  'Title & Notary',
  'Insurance',
  'Financial',
  'Marketing',
  'Web Development',
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
  Attorneys: 'Abogados',
  'Title & Notary': 'Títulos y Notaría',
  Insurance: 'Seguros',
  Financial: 'Servicios Financieros',
  Marketing: 'Marketing',
  'Web Development': 'Desarrollo Web',
}

// Localized display label. Value stays English everywhere else.
export function categoryLabel(category: string | null | undefined, locale: string): string {
  if (!category) return locale === 'es' ? 'Negocio' : 'Business'
  if (locale === 'es') return ES_LABELS[category] || category
  return category
}
