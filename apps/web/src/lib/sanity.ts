import { createClient } from '@sanity/client'

const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production'
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2021-06-07'
const projectIdPattern = /^[a-z0-9-]+$/

type SanityParams = Record<string, any>
type SanityClient = ReturnType<typeof createClient>

let cdnClient: SanityClient | null = null
let serverClient: SanityClient | null = null

function getProjectId() {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || ''
  return projectIdPattern.test(projectId) ? projectId : ''
}

export function isSanityConfigured() {
  return Boolean(getProjectId())
}

function getClient({ useCdn, token }: { useCdn: boolean; token?: string }) {
  const projectId = getProjectId()

  if (!projectId) {
    throw new Error('Sanity project ID is not configured.')
  }

  if (useCdn) {
    cdnClient ??= createClient({
      projectId,
      dataset,
      apiVersion,
      useCdn: true,
    })
    return cdnClient
  }

  serverClient ??= createClient({
    projectId,
    dataset,
    apiVersion,
    useCdn: false,
    token,
  })
  return serverClient
}

export const sanityClient = {
  fetch<T = any>(query: string, params?: SanityParams) {
    const client = getClient({ useCdn: true })
    return params ? client.fetch<T>(query, params) : client.fetch<T>(query)
  },
}

export const sanityServerClient = {
  fetch<T = any>(query: string, params?: SanityParams) {
    const client = getClient({
      useCdn: false,
      token: process.env.SANITY_API_TOKEN,
    })
    return params ? client.fetch<T>(query, params) : client.fetch<T>(query)
  },
}

export async function getSanityData<T = unknown>(query: string, params?: SanityParams) {
  try {
    return await sanityClient.fetch<T>(query, params)
  } catch (error) {
    console.error('Sanity fetch error:', error)
    throw error
  }
}

export function getSanityWriteClient() {
  const projectId = getProjectId()
  if (!projectId) {
    throw new Error('Sanity project ID is not configured.')
  }
  return createClient({
    projectId,
    dataset,
    apiVersion,
    useCdn: false,
    token: process.env.SANITY_API_TOKEN,
  })
}
