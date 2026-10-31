import { NextRequest, NextResponse } from 'next/server'
import { listingShortDestination } from '@/lib/listing-campaign'

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const id = params.id?.trim()
  const valid=/^[A-Za-z0-9:_-]{1,120}$/.test(id || '')
  const destination=valid?listingShortDestination(id,request.url):null
  // Cloud Run exposes an internal host in request.url. A relative Location
  // preserves the visitor's public origin without trusting forwarded hosts.
  return new NextResponse(null,{status:302,headers:{
    Location:destination?`${destination.pathname}${destination.search}${destination.hash}`:'/en/directory',
    'Cache-Control':'no-store',
  }})
}
