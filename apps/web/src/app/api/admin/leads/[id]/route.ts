import { NextRequest,NextResponse } from 'next/server'
import { getServerUser,getServerUserProfile } from '@citybeat/lib/firebase/server'
import { hasAdminAccess } from '@citybeat/lib/roles'
import { privilegedDenial } from '@/lib/privileged-access'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { supportPatch,SupportError } from '@/lib/support-workflow'
export const dynamic='force-dynamic'
export async function PATCH(request:NextRequest,props:{params:Promise<{id:string}>}) {
  const user=await getServerUser()
  if(!user) return NextResponse.json({error:'Unauthorized'},{status:401})
  const profile=await getServerUserProfile(user.id)
  const denial=privilegedDenial(profile,hasAdminAccess(profile))
  if(denial) return NextResponse.json({error:denial.error},{status:denial.status})
  const {id}=await props.params
  if(!/^[A-Za-z0-9_-]{1,160}$/.test(id)) return NextResponse.json({error:'Invalid request ID'},{status:400})
  const input=await request.json().catch(()=>null)
  try {
    const ref=adminDb.collection('quote_requests').doc(id)
    const result=await adminDb.runTransaction(async tx=>{
      const snap=await tx.get(ref)
      if(!snap.exists || snap.data()?.status==='spam') throw new SupportError('Request not found',404)
      const previous=snap.data()!
      const actor={id:user.id,name:String((profile as any)?.display_name || (profile as any)?.name || user.email || user.id).slice(0,120)}
      const patch=supportPatch(input,previous,actor)
      tx.update(ref,patch)
      tx.set(ref.collection('support_events').doc(),{
        ...patch,actor_id:actor.id,actor_name:actor.name,
        previous_status:previous.support_status || 'open',previous_assigned_to:previous.support_assigned_to || null,
      })
      return patch
    })
    return NextResponse.json({ok:true,...result},{headers:{'Cache-Control':'no-store'}})
  }catch(error){
    return NextResponse.json({error:error instanceof SupportError?error.message:'Could not save support update.'},{status:error instanceof SupportError?error.status:500})
  }
}
