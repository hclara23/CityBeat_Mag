import { validatePreviewUrl } from '@sanity/preview-url-secret'
import { sanityClient } from '@citybeat/lib/sanity/client'
import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'
import { NextRequest } from 'next/server'

const clientWithToken = sanityClient.withConfig({
  token: process.env.SANITY_API_TOKEN,
})

export async function GET(request: NextRequest) {
  const { isValid, redirectTo = '/' } = await validatePreviewUrl(
    clientWithToken,
    request.url,
  )

  if (!isValid) {
    return new Response('Invalid secret', { status: 401 })
  }

  draftMode().enable()

  redirect(redirectTo)
}
