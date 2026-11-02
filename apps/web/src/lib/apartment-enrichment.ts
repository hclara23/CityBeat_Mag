import records from './apartment-enrichment.json'

type Localized = Record<'en' | 'es', string>
export type ApartmentPhoto = { url: string; sourceUrl: string; caption: Localized }
export type ApartmentResearch = {
  checkedAt: string
  summary: Localized
  highlights: Record<'en' | 'es', string[]>
  layouts?: Localized
  neighborhood?: Localized
  verificationNote?: Localized
  floorplansUrl?: string
  galleryUrl?: string
  photos: ApartmentPhoto[]
  sources: string[]
}

export const APARTMENT_RESEARCH: Record<string, ApartmentResearch> = records
