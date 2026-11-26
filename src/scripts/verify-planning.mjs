import { planningInput, validatePlan } from '../lib/planning/contract.mjs';
import { createPlanningProvider } from '../lib/planning/provider.mjs';
import { todayInVietnam } from '../lib/interview/session-contract.mjs';
const live=process.argv.includes('--live');
const today=todayInVietnam();
const context=planningInput({interviewDate:today,acceptGeneralPlan:true,targetPosition:'Frontend Intern',language:'en'},today,null);
const start=performance.now();
try {
 const output=live?await createPlanningProvider().generate(context,{signal:AbortSignal.timeout(20000)}):{tasks:[{date:today,criterion:'clarity',task:'Explain one React project decision using a concrete example.',rationale:'Practice a precise explanation before the interview.'}]};
 const tasks=validatePlan(output,context);
 console.log(JSON.stringify({mode:live?'live-provider-only':'offline-fixture',valid:true,taskCount:tasks.length,elapsedMs:Math.round(performance.now()-start),supabaseTested:false}));
} catch(e) {
 console.log(JSON.stringify({mode:live?'live-provider-only':'offline-fixture',valid:false,code:e.code||'SERVER_ERROR',supabaseTested:false}));process.exitCode=1;
}
