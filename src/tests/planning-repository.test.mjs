import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlanningRepository } from '../lib/planning/repository.mjs';

const scored = {
 id: '00000000-0000-4000-8000-000000000011', status: 'completed', round_type: 'technical', language: 'en',
 target_position: 'Developer', started_at: '2026-11-20T00:00:00Z', ended_at: '2026-11-20T00:10:00Z',
 questions: [{position:1,kind:'main',content:'Explain React state.',answers:{content:'I use state for interactive values.',feedbacks:{content_score:8,structure_score:null,clarity_score:4,confidence_score:6,overall_score:6}}}],
};
const unscored = { ...scored, id:'00000000-0000-4000-8000-000000000012',ended_at:'2026-11-25T00:10:00Z',questions:[] };
// Only the external PostgREST transport is replaced. Repository selection and buildReport run unchanged.
function database(rows, fail = false) {
 return { from() {
  let result=[...rows],start=0,end=Infinity;const ordering=[];
  const q={select(){return q;},eq(key,value){result=result.filter(row=>row[key]===value);return q;},
   order(key,{ascending}){ordering.push({key,ascending});return q;},
   limit(n){end=start+n;return q;},range(first,last){start=first;end=last+1;return q;},
   then(resolve){result.sort((a,b)=>{for(const {key,ascending} of ordering){const difference=a[key]<b[key]?-1:a[key]>b[key]?1:0;if(difference)return difference*(ascending?1:-1);}return 0;});return Promise.resolve({data:result.slice(start,end),error:fail?{code:'offline'}:null}).then(resolve);}};
  return q;
 }};
}
test('latest unscored sessions do not hide an older scored report across pages',async()=>{
 const rows=Array.from({length:45},(_,i)=>({...unscored,id:`new-${i}`}));
 const context=await createPlanningRepository(database([...rows,scored])).context();
 assert.equal(context?.sessionId,scored.id);
 assert.deepEqual(context.criteria,{content:8,structure:null,clarity:4,confidence:6});
});
test('explicit unscored session does not silently select another session',async()=>{
 assert.equal(await createPlanningRepository(database([unscored,scored])).context(unscored.id),null);
});
test('report fallback stays within completed sessions and selected position',async()=>{
 const wrongPosition={...scored,id:'other',target_position:'Designer',ended_at:'2026-11-24T00:00:00Z'};
 const unfinished={...scored,id:'unfinished',status:'in_progress',ended_at:'2026-11-26T00:00:00Z'};
 const repo=createPlanningRepository(database([unscored,wrongPosition,unfinished,scored]));
 assert.equal((await repo.context(undefined,'Developer')).sessionId,scored.id);
 await assert.rejects(repo.context(scored.id,'Designer'),{code:'NOT_FOUND'});
 await assert.rejects(createPlanningRepository(database([],true)).context(),{code:'SERVER_ERROR'});
});
