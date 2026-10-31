import { NextRequest, NextResponse } from 'next/server'
import { listingShortDestination } from '@/lib/listing-campaign'

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const id = params.id?.trim()
  if (!/^[A-Za-z0-9:_-]{1,120}$/.test(id || '')) return NextResponse.redirect(new URL('/en/directory', request.url), 302)
  const destination = listingShortDestination(id, request.url)
  return NextResponse.redirect(destination, 302)
}
