export * from './i18n'
export * from './geo'
export * from './tracking'

export const API_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://citybeatmag.co'
export const SANITY_PROJECT_ID = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || ''
export const SANITY_DATASET = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production'
