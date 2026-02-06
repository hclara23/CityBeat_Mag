import { createClient } from '@sanity/client'

export const sanityClient = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || '',
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2021-06-07',
  useCdn: true,
  token: process.env.SANITY_API_TOKEN,
})

export async function getSanityData(query: string) {
  try {
    return await sanityClient.fetch(query)
  } catch (error) {
    console.error('Sanity fetch error:', error)
    throw error
  }
}
