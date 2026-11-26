import { PlanError } from './contract.mjs';
import { buildReport } from '../report/report-builder.mjs';
import { isUuid } from '../interview/session-contract.mjs';
export function createPlanningRepository(db) {
 async function rpc(name,args={}){const {data,error}=await db.rpc(name,args);if(error)throw new PlanError(['PGRST202','42883'].includes(error.code)?'DATABASE_NOT_READY':'SERVER_ERROR',503);if(data?.error)throw new PlanError(data.error,data.error==='PLAN_DAILY_LIMIT'?429:409);return data;}
 return {
  async context(id,position){
   if(id!==undefined&&!isUuid(id))throw new PlanError('BAD_INPUT');
   const pageSize=20;
   // RLS is applied by the signed-in client on every page. Do not load CV/JD snapshots.
   for(let offset=0;;offset+=pageSize){
    let query=db.from('interview_sessions').select('id,round_type,language,target_position,started_at,ended_at,questions(position,kind,content,created_at,answers(content,word_count,duration_seconds,feedbacks(content_score,structure_score,clarity_score,confidence_score,overall_score)))')
     .eq('status','completed').order('ended_at',{ascending:false}).order('id',{ascending:false});
    if(id)query=query.eq('id',id).limit(1);
    else query=query.range(offset,offset+pageSize-1);
    if(typeof position==='string'&&position.trim())query=query.eq('target_position',position.trim());
    const {data,error}=await query;
    if(error)throw new PlanError('SERVER_ERROR',503);
    if(!data?.length){if(id)throw new PlanError('NOT_FOUND',404);return null;}
    for(const session of data){
     try {
      const {criteria}=buildReport(session,session.questions);
      if(Object.values(criteria).some(value=>typeof value==='number'&&Number.isFinite(value)))
       return {criteria,targetPosition:session.target_position,sessionId:session.id};
     }catch(error){if(error.code!=='NO_SCORED_ANSWERS')throw error;}
    }
    // An explicit session is never silently replaced by a different one.
    if(id||data.length<pageSize)return null;
   }
  },
  read:()=>rpc('read_practice_plan'),
  claim:fingerprint=>rpc('claim_practice_plan',{p_fingerprint:fingerprint}),
  finish:(token,fingerprint,payload)=>rpc('finish_practice_plan',{p_token:token,p_fingerprint:fingerprint,p_payload:payload}),
  release:token=>rpc('release_practice_plan',{p_token:token}),
 };
}
