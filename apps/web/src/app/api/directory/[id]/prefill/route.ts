import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { hasEditorAccess } from '@citybeat/lib/roles'
import { resolveEntitlements, resolveListingPatchAccess } from '@/lib/directory-entitlements'
import { checkRateLimit } from '@/lib/auth-security'
import { extractWebsitePrefill, publicWebsiteUrl } from '@/lib/website-prefill'
import { fetchPrefillPage } from '@/lib/website-prefill-fetch'
import { privilegedDenial } from '@/lib/privileged-access'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function POST(request: NextRequest, props: {params: Promise<{id:string}>}) {
  const user=await getServerUser()
  if(!user) return NextResponse.json({error:'Unauthorized'},{status:401})
  if(request.headers.get('origin')!==new URL(process.env.NEXT_PUBLIC_APP_URL || request.url).origin) return NextResponse.json({error:'Invalid origin'},{status:403})
  const {id}=await props.params
  if(!/^[A-Za-z0-9:_-]{1,160}$/.test(id)) return NextResponse.json({error:'Invalid listing'},{status:400})
  const profile=await getServerUserProfile(user.id)
  const staff=hasEditorAccess(profile)
  if(staff && privilegedDenial(profile,true)) return NextResponse.json({error:'Two-factor authentication required'},{status:403})
  const snapshot=await adminDb.collection('directory_listings').doc(id).get()
  if(!snapshot.exists) return NextResponse.json({error:'Listing not found'},{status:404})
  const listing=snapshot.data()!
  const access=resolveListingPatchAccess(listing,{userId:user.id,isStaff:staff,managerAllowance:resolveEntitlements(listing).additionalManagers})
  if(!access.canManage) return NextResponse.json({error:'Forbidden'},{status:403})
  const body=await request.json().catch(()=>null)
  if(body?.confirmed!==true) return NextResponse.json({error:'Confirm this is your business website.'},{status:400})
  let url: URL
  try {url=publicWebsiteUrl(body.url)} catch {return NextResponse.json({error:'Enter a public HTTPS business website.'},{status:400})}
  if(!(await checkRateLimit(`website-prefill:${user.id}:${id}`,{max:3,windowMs:60*60*1000})).ok) return NextResponse.json({error:'Preview limit reached. Try again in one hour.'},{status:429})
  try {
    const page=await fetchPrefillPage(url.href)
    return NextResponse.json(extractWebsitePrefill(page.html,page.url),{headers:{'Cache-Control':'no-store'}})
  } catch {return NextResponse.json({error:'Could not safely read this website. You can still enter the details manually.'},{status:422})}
}
