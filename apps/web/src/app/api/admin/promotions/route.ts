import { NextRequest,NextResponse } from 'next/server'
import { adminDb } from '@citybeat/lib/firebase/admin'
import { automationAdmin } from '@/lib/admin-automation-auth'
import { checkRateLimit } from '@/lib/auth-security'
import { promotionDraft,postizConfiguration,postizRequest,facebookChannels,facebookSchedule,PromotionError } from '@/lib/postiz-promotion'
export const dynamic='force-dynamic'
const drafts=()=>adminDb.collection('listing_promotion_drafts')
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export async function GET(request:NextRequest) {
  const auth=await automationAdmin(request);if(auth.error)return auth.error
  try{
    const [listings,recent]=await Promise.all([adminDb.collection('directory_listings').where('tier','in',['premium','featured']).limit(50).get(),drafts().orderBy('created_at','desc').limit(20).get()])
    let configured=false,channels:{id:string;name:string}[]=[],connection_error=false
    try{const config=postizConfiguration();configured=Boolean(config);if(config)channels=facebookChannels(await postizRequest(config,'/integrations'))}catch{connection_error=true}
    const eligible=listings.docs.flatMap(d=>{try{const draft=promotionDraft({listing_id:d.id},d.data());return [{id:d.id,name:draft.listing_name,city:draft.city}]}catch{return []}})
    return NextResponse.json({configured,connection_error,channels,listings:eligible,drafts:recent.docs.map(d=>({id:d.id,...d.data()}))},{headers:{'Cache-Control':'no-store'}})
  }catch{return NextResponse.json({error:'Could not load promotion tools.'},{status:500})}
}
export async function POST(request:NextRequest) {
  const auth=await automationAdmin(request);if(auth.error)return auth.error
  const body=await request.json().catch(()=>null)
  if(!body || !['save','schedule'].includes(body.action))return NextResponse.json({error:'Invalid promotion action.'},{status:400})
  if(!(await checkRateLimit(`promotion:${auth.user!.id}`,{max:20,windowMs:60*60*1000})).ok)return NextResponse.json({error:'Please wait before creating more promotions.'},{status:429})
  try{
    if(body.action==='save'){
      if(!uuid.test(body.request_id || '') || !/^[A-Za-z0-9:_-]{1,120}$/.test(body.listing_id || ''))throw new PromotionError('Invalid draft request.')
      const listing=await adminDb.collection('directory_listings').doc(body.listing_id).get()
      if(!listing.exists)throw new PromotionError('Listing not found.',404)
      const draft=promotionDraft(body,listing.data()!)
      const ref=drafts().doc(body.request_id)
      await adminDb.runTransaction(async tx=>{
        const existing=await tx.get(ref),data=existing.data()
        if(data && (data.status!=='draft' || data.listing_id!==draft.listing_id || data.caption!==draft.caption))throw new PromotionError('This request already has a different or submitted draft. Refresh before continuing.',409)
        if(!existing.exists)tx.create(ref,{...draft,status:'draft',created_by:auth.user!.id,created_at:new Date().toISOString()})
      })
      return NextResponse.json({ok:true,id:ref.id,status:'draft'})
    }
    if(body.approved!==true)throw new PromotionError('Review and approve the exact caption and schedule first.')
    if(!uuid.test(body.draft_id || ''))throw new PromotionError('Choose a saved draft.')
    const config=postizConfiguration();if(!config)throw new PromotionError('Postiz is not connected. Your local draft is saved.',503)
    const channels=facebookChannels(await postizRequest(config,'/integrations'))
    if(!channels.some(c=>c.id===body.channel_id))throw new PromotionError('Choose an available connected Facebook page.')
    const ref=drafts().doc(body.draft_id)
    const payload=await adminDb.runTransaction(async tx=>{
      const snap=await tx.get(ref),data=snap.data()
      if(!data || data.status!=='draft')throw new PromotionError('This draft was already submitted or needs review. Do not duplicate it.',409)
      const listing=await tx.get(adminDb.collection('directory_listings').doc(data.listing_id))
      if(!listing.exists)throw new PromotionError('Listing no longer exists.',404)
      promotionDraft(data,listing.data()!)
      const payload=facebookSchedule(data.caption,body.channel_id,body.date)
      tx.update(ref,{status:'submitting',approved_by:auth.user!.id,approved_at:new Date().toISOString(),scheduled_at:payload.date,channel_id:body.channel_id})
      return payload
    })
    try{
      const result=await postizRequest(config,'/posts',payload)
      const postId=Array.isArray(result)?result.find(x=>x.integration===body.channel_id)?.postId:undefined
      if(typeof postId!=='string' || !postId)throw new Error('Missing Postiz confirmation')
      await ref.update({status:'accepted_by_postiz',postiz_post_id:postId,updated_at:new Date().toISOString()})
      return NextResponse.json({ok:true,status:'accepted_by_postiz',post_id:postId})
    }catch{
      await ref.update({status:'needs_review',updated_at:new Date().toISOString()}).catch(()=>{})
      return NextResponse.json({error:'Submission outcome needs review. Check Postiz before creating another post; no automatic retry was made.'},{status:502})
    }
  }catch(error){return NextResponse.json({error:error instanceof PromotionError?error.message:'Could not save promotion.'},{status:error instanceof PromotionError?error.status:500})}
}
