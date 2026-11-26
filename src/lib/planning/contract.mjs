import { unsafeGeneratedText } from '../ai/guardrails.mjs';
import { isUuid } from '../interview/session-contract.mjs';
export class PlanError extends Error { constructor(code,status=400){super(code);this.code=code;this.status=status;} }
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
export function planningInput(body,today,report) {
 if(!body||Object.keys(body).some(k=>!['interviewDate','sourceSessionId','language','acceptGeneralPlan','targetPosition'].includes(k))||!validDate(body.interviewDate)||body.interviewDate<today||!['vi','en'].includes(body.language??'vi')) throw new PlanError('BAD_INPUT');
 const dates=[]; for(let day=today;day<=body.interviewDate;day=new Date(Date.parse(day)+86400000).toISOString().slice(0,10)){dates.push(day);if(dates.length>30)throw new PlanError('PLAN_HORIZON_EXCEEDED');}
 if(!report && body.acceptGeneralPlan!==true) throw new PlanError('GENERAL_PLAN_CONFIRMATION',409);
 const targetPosition=report?.targetPosition||body.targetPosition;
 if(typeof targetPosition!=='string'||!targetPosition.trim()||targetPosition.length>200)throw new PlanError('BAD_INPUT');
 const criteria=Object.entries(report?.criteria??{}).filter(([,v])=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=10).sort((a,b)=>a[1]-b[1]);
 const weakCriteria=criteria.slice(0,2).map(([k])=>k==='structure'?'star':k);
 if(report&&!weakCriteria.length)throw new PlanError('NO_SCORED_ANSWERS',409);
 return {interviewDate:body.interviewDate,language:body.language??'vi',dates,remainingDays:dates.length,targetPosition:targetPosition.trim(),weakCriteria,general:!report,sourceSessionId:report?.sessionId??null};
}
export function validatePlan(output,c) {
 if(!Array.isArray(output?.tasks)||output.tasks.length!==c.dates.length)throw new PlanError('INVALID_OUTPUT',502);
 return output.tasks.map((t,i)=>{
  if(!t||t.date!==c.dates[i]||!(c.general?['content','star','clarity','confidence']:c.weakCriteria).includes(t.criterion)||!['task','rationale'].every(k=>typeof t[k]==='string'&&t[k].trim()&&t[k].length<=1200&&!unsafeGeneratedText(t[k]))) throw new PlanError('INVALID_OUTPUT',502);
  return {date:t.date,criterion:t.criterion,task:t.task.trim(),rationale:t.rationale.trim(),completed:false};
 });
}

// A stored response must carry a complete, internally consistent generation snapshot.
export function validateSavedPlan(plan) {
 const invalid=()=>{throw new PlanError('INVALID_OUTPUT',502);};
 const criteria=['content','star','clarity','confidence'];
 if(!plan||!validDate(plan.interviewDate)||!['vi','en'].includes(plan.language)
  ||typeof plan.targetPosition!=='string'||!plan.targetPosition.trim()||plan.targetPosition.length>200
  ||typeof plan.general!=='boolean'||!Array.isArray(plan.dates)||plan.dates.length<1||plan.dates.length>30
  ||plan.remainingDays!==plan.dates.length||!plan.dates.every(validDate)
  ||!Array.isArray(plan.weakCriteria)||!plan.weakCriteria.every(key=>criteria.includes(key))
  ||new Set(plan.weakCriteria).size!==plan.weakCriteria.length)invalid();
 if(plan.general ? plan.weakCriteria.length!==0||plan.sourceSessionId!==null
  : plan.weakCriteria.length<1||plan.weakCriteria.length>2||!isUuid(plan.sourceSessionId))invalid();
 if(plan.dates.at(-1)!==plan.interviewDate||plan.dates.some((day,index)=>
  Date.parse(day)!==Date.parse(plan.dates[0])+index*86400000))invalid();
 const tasks=validatePlan(plan,plan);
 if(plan.tasks.some(task=>task.completed!==false))invalid();
 return {...plan,tasks};
}
