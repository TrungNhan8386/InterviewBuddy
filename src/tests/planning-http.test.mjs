import test from 'node:test';
import assert from 'node:assert/strict';
import {planningHandlers} from '../lib/planning/http.mjs';
import {createPlanningProvider} from '../lib/planning/provider.mjs';
test('planning HTTP requires auth, limits body and reads without generation',async()=>{
 let generated=0;
 const options={authenticate:async()=>({}),makeRepository:()=>({read:async()=>({id:'old'})}),makeService:()=>({generate:async()=>{generated++;return {alreadySaved:false,plan:{id:'new'}};}})};
 const h=planningHandlers(options);
 assert.equal((await (await h.GET(new Request('http://local'))).json()).plan.id,'old');assert.equal(generated,0);
 assert.equal((await planningHandlers({...options,authenticate:async()=>null}).GET(new Request('http://local'))).status,401);
 const post=body=>new Request('http://local',{method:'POST',headers:{'Content-Type':'application/json'},body});
 assert.equal((await h.POST(post('x'.repeat(2049)))).status,400);assert.equal(generated,0);
 assert.equal((await h.POST(post('{'))).status,400);
 assert.equal((await h.POST(post('{}'))).status,201);
});
test('planning provider maps rate limits without leaking credentials',async()=>{
 let calls=0;const p=createPlanningProvider({GEMINI_API_KEY:'synthetic-key',GEMINI_MODEL:'test-model'},async()=>{calls++;return new Response('',{status:429});});
 await assert.rejects(p.generate({dates:['2026-11-25'],weakCriteria:['clarity']},{signal:new AbortController().signal}),{code:'AI_RATE_LIMITED'});assert.equal(calls,1);
});
