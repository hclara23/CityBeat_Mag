import { NextRequest, NextResponse } from 'next/server'
import { getServerUser, getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasAdminAccess } from '@citybeat/lib/roles'
import { privilegedDenial } from '@/lib/privileged-access'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { supportSummary } from '@/lib/support-workflow'
import { checkRateLimit } from '@/lib/auth-security'

export const dynamic = 'force-dynamic'

function toMs(v: any): number {
  if (!v) return 0
  if (typeof v.toMillis === 'function') return v.toMillis()
  if (v?._seconds) return v._seconds * 1000
  if (typeof v === 'string') return Date.parse(v) || 0
  return 0
}

// Admin inbox of captured "request a quote" leads (quote_requests).
export async function GET() {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const profile = await getServerUserProfile(user.id)
  // Role AND second factor, together. This checked the role alone, so a staff
  // password with no TOTP enrollment behind it reached this API even though the
  // page in front of it only redirects. See lib/privileged-access.
  const denial = privilegedDenial(profile, hasAdminAccess(profile))
  if (denial) return NextResponse.json({ error: denial.error }, { status: denial.status })

  try {
    const snap = await adminDb.collection('quote_requests').orderBy('created_at','desc').limit(500).get()
    const leads = snap.docs
      // status 'spam' is set on bot submissions (see lib/form-spam.ts); kept in
      // the collection rather than deleted so a misclassification is reversible.
      .filter((d) => (d.data() as any).status !== 'spam')
      .map((d) => {
        const x = d.data() as any
        return {
          id: d.id,
          business_name: x.business_name || null,
          listing_id: x.listing_id || null,
          name: x.name || '',
          contact: x.contact || '',
          message: x.message || null,
          status: x.status || 'new',
          source: x.source || 'listing_quote',
          ...supportSummary(x),
          created_at: toMs(x.created_at),
        }
      })
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, 200)
    return NextResponse.json({ leads, capped: snap.size >= 500 || snap.docs.filter(d=>d.data().status!=='spam').length>200, viewer_id:user.id },{headers:{'Cache-Control':'no-store'}})
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Could not load leads' }, { status: 500 })
  }
}

// Staff can record a mailbox reply without creating a second email system or
// pretending that MXroute messages have been automatically synchronized.
export async function POST(request:NextRequest) {
  const user=await getServerUser()
  if(!user) return NextResponse.json({error:'Unauthorized'},{status:401})
  const profile=await getServerUserProfile(user.id)
  const denial=privilegedDenial(profile,hasAdminAccess(profile))
  if(denial) return NextResponse.json({error:denial.error},{status:denial.status})
  const body=await request.json().catch(()=>null)
  const name=typeof body?.name==='string'?body.name.trim():''
  const contact=typeof body?.contact==='string'?body.contact.trim():''
  const message=typeof body?.message==='string'?body.message.trim():''
  if(typeof body?.request_id!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.request_id)) return NextResponse.json({error:'Reload the inbox before logging a reply.'},{status:400})
  if(!name || name.length>120 || !contact || contact.length>200 || message.length<5 || message.length>4000) return NextResponse.json({error:'Enter a name, contact and message (5–4,000 characters).'},{status:400})
  if(!(await checkRateLimit(`support-log:${user.id}`,{max:30,windowMs:60*60*1000})).ok) return NextResponse.json({error:'Please wait before logging more replies.'},{status:429})
  try {
    const ref=adminDb.collection('quote_requests').doc(`manual_${body.request_id}`)
    const existing=await ref.get()
    if(existing.exists) return NextResponse.json({ok:true,id:ref.id})
    await ref.create({name,contact,message,status:'new',source:'manual_email',listing_id:null,created_at:FieldValue.serverTimestamp(),
      support_status:'open',support_assigned_to:user.id,support_assigned_name:String((profile as any)?.display_name || (profile as any)?.name || user.email || user.id).slice(0,120),support_revision:0,support_logged_by:user.id})
    return NextResponse.json({ok:true,id:ref.id},{status:201})
  }catch{return NextResponse.json({error:'Could not log this reply. The original email is unchanged.'},{status:500})}
}
