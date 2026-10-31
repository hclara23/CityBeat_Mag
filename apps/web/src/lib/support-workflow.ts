export const SUPPORT_STATUSES=['open','in_progress','waiting','resolved'] as const
export type SupportStatus=typeof SUPPORT_STATUSES[number]
export type SupportActor={id:string;name:string}
export class SupportError extends Error { constructor(message:string,public status=400){super(message)} }
export function supportPatch(input: any, current: Record<string,any>, actor: SupportActor, now=new Date().toISOString()) {
  if(!input || typeof input!=='object') throw new SupportError('Invalid update.')
  if(!Number.isInteger(input.expected_revision) || input.expected_revision!==(Number(current.support_revision)||0)) throw new SupportError('This request changed. Reload before saving.',409)
  if(!SUPPORT_STATUSES.includes(input.status)) throw new SupportError('Choose a valid support status.')
  if(!['keep','me','unassigned'].includes(input.assignment)) throw new SupportError('Choose a valid assignment.')
  const note=typeof input.note==='string'?input.note.trim():''
  if(note.length>2000) throw new SupportError('Notes must be 2,000 characters or less.')
  const assigned=input.assignment==='me'?actor.id:input.assignment==='unassigned'?null:current.support_assigned_to || null
  const assignedName=input.assignment==='me'?actor.name:input.assignment==='unassigned'?null:current.support_assigned_name || null
  if(input.status!=='open' && !assigned) throw new SupportError('Assign a responsible person before changing this status.')
  if(input.status==='resolved' && note.length<8) throw new SupportError('Add a brief resolution note before resolving.')
  return {
    support_status:input.status as SupportStatus, support_assigned_to:assigned,support_assigned_name:assignedName,
    support_note:note,support_updated_at:now,support_updated_by:actor.id,
    support_resolved_at:input.status==='resolved'?(current.support_status==='resolved'?current.support_resolved_at || now:now):null,
    support_revision:(Number(current.support_revision)||0)+1,
  }
}
export function supportSummary(data: Record<string,any>) {
  return {
    support_status:SUPPORT_STATUSES.includes(data.support_status)?data.support_status:'open',
    support_assigned_to:data.support_assigned_to || null,support_assigned_name:data.support_assigned_name || null,
    support_note:data.support_note || '',support_updated_at:data.support_updated_at || null,
    support_resolved_at:data.support_resolved_at || null,support_revision:Number(data.support_revision)||0,
  }
}
