import { createClient } from 'next-sanity'

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'dev_project'
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'development'
const apiVersion = '2024-01-01'

export const sanityClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: process.env.NODE_ENV === 'production',
})

// Client for server-side operations (with write token)
export const sanityServerClient = createClient({
  projectId,
  dataset,
  apiVersion,
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
})

export default sanityClient
