import type { ApartmentCommunity } from './apartments'
import integrity from './apartment-integrity.json'
import caseAssociates from './apartment-case.json'

export const RESEARCHED_APARTMENTS: readonly ApartmentCommunity[] = [...integrity, ...caseAssociates].map(row => ({
  ...row, type: 'apartments',
  summary: { en: `${row.name} is a rental community in ${row.city}. Contact management for current availability, rental terms, and amenities.`, es: `${row.name} es una comunidad de alquiler en ${row.city}. Contacte a la administración para conocer disponibilidad, condiciones y servicios actuales.` },
  highlights: { en: [], es: [] },
}))
