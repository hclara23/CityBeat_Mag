import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const id = params.id?.trim()
  if (!/^[A-Za-z0-9_-]{3,160}$/.test(id || '')) return NextResponse.redirect(new URL('/en/directory', request.url), 302)
  const destination = new URL(`/en/directory/${encodeURIComponent(id)}`, request.url)
  destination.hash = request.nextUrl.hash
  return NextResponse.redirect(destination, 302)
}
