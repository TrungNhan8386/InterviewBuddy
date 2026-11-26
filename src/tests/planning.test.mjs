import test from 'node:test';
import assert from 'node:assert/strict';
import { planningInput, validatePlan } from '../lib/planning/contract.mjs';
import { createPlanningService } from '../lib/planning/service.mjs';
test('calendar dates include today, cross year and exclude inapplicable STAR',()=>{
 const c=planningInput({interviewDate:'2027-01-01',language:'vi'},'2026-12-30',{criteria:{content:8,structure:null,clarity:4,confidence:6},targetPosition:'Dev'});
 assert.deepEqual(c.dates,['2026-12-30','2026-12-31','2027-01-01']); assert.deepEqual(c.weakCriteria,['clarity','confidence']);
 assert.throws(()=>planningInput({interviewDate:'2026-02-30'},'2026-02-01',null));
 assert.throws(()=>planningInput({interviewDate:'2026-11-24'},'2026-11-25',null));
 assert.throws(()=>planningInput({interviewDate:'2026-11-26'},'2026-11-25',null),/GENERAL_PLAN_CONFIRMATION/);
});
test('plan rejects duplicate dates, invented criteria and empty work',()=>{
 const c=planningInput({interviewDate:'2026-11-26',acceptGeneralPlan:true,targetPosition:'Dev'},'2026-11-25',null);
 const output={tasks:c.dates.map(date=>({date,criterion:'content',task:'Explain one concrete project decision.',rationale:'Practice a precise technical explanation.'}))};
 assert.equal(validatePlan(output,c).length,2);
 assert.throws(()=>validatePlan({tasks:[output.tasks[0],output.tasks[0]]},c));
 assert.throws(()=>validatePlan({tasks:output.tasks.map(t=>({...t,task:''}))},c));
});
test('service replays before AI, keeps old plan on invalid output, counts attempts',async()=>{
 const c={interviewDate:'2026-11-25',acceptGeneralPlan:true,targetPosition:'Dev'}; let calls=0,released=0,finished=0;
 const repo={context:async()=>null,claim:async()=>({kind:'ready',plan:{id:'saved'}}),release:async()=>released++,finish:async()=>finished++};
 const s=createPlanningService({repository:repo,provider:{generate:async()=>{calls++;return {}; }},consume:async()=>{},today:()=> '2026-11-25'});
 assert.equal((await s.generate(c)).plan.id,'saved'); assert.equal(calls,0);
 repo.claim=async()=>({kind:'claimed',token:'lease'});
 await assert.rejects(s.generate(c),{code:'INVALID_OUTPUT'}); assert.equal(calls,2); assert.equal(finished,0); assert.equal(released,1);
});
test('valid generation persists only validated dates and bills once; cancellation bills nothing',async()=>{
 let calls=0,finished=0;
 const repository={context:async()=>null,claim:async()=>({kind:'claimed',token:'lease'}),finish:async(token,fingerprint,payload)=>{finished++;return payload;},release:async()=>{}};
 const s=createPlanningService({repository,provider:{generate:async c=>({tasks:c.dates.map(date=>({date,criterion:'clarity',task:'Explain a concrete decision.',rationale:'Practice a concise explanation.'}))})},consume:async()=>{calls++;},today:()=> '2026-11-25'});
 const body={interviewDate:'2026-11-25',acceptGeneralPlan:true,targetPosition:'Dev'};
 const result=await s.generate(body);assert.equal(result.plan.tasks.length,1);assert.equal(finished,1);assert.equal(calls,1);
 const controller=new AbortController();controller.abort();await assert.rejects(s.generate(body,{signal:controller.signal}),{code:'REQUEST_CANCELLED'});assert.equal(calls,1);
});
