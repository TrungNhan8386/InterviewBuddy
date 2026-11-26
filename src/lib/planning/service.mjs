import { createHash } from 'node:crypto';
import { planningInput, validatePlan, PlanError } from './contract.mjs';
import { todayInVietnam } from '../interview/session-contract.mjs';
export function createPlanningService({repository,provider,consume,today=()=>todayInVietnam()}) {
 return {async generate(body,{signal}={}) {
  if(signal?.aborted)throw new PlanError('REQUEST_CANCELLED',408);
  const context=planningInput(body,today(),await repository.context(body?.sourceSessionId,body?.targetPosition));
  const fingerprint=createHash('sha256').update(JSON.stringify(context)).digest('hex');
  const claim=await repository.claim(fingerprint);
  if(claim.kind==='ready')return {plan:claim.plan,alreadySaved:true};
  if(claim.kind!=='claimed')throw new PlanError('GENERATION_IN_PROGRESS',409);
  let release=true;
  try {
   const lifetime=signal?AbortSignal.any([signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000);
   for(let attempt=0;attempt<2;attempt++) {
    if(lifetime.aborted)throw new PlanError('AI_TIMEOUT',504);
    await consume();
    let tasks;
    try {tasks=validatePlan(await provider.generate(context,{signal:lifetime}),context);}catch(e){if(e.code==='INVALID_OUTPUT'&&attempt===0&&!lifetime.aborted)continue;throw e;}
    if(lifetime.aborted)throw new PlanError('AI_TIMEOUT',504);
    release=false;
    const plan=await repository.finish(claim.token,fingerprint,{...context,tasks});
    return {plan,alreadySaved:false};
   }
  } finally {if(release)await repository.release(claim.token).catch(()=>{});}
 }};
}
