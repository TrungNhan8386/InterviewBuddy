import test from 'node:test';
import assert from 'node:assert/strict';
import { adaptFeedback, loadFeedback, canRetryFeedback } from '../lib/answer-feedback/transport.mjs';
import { validateFeedback } from '../lib/feedback/contract.mjs';
import { context, validOutput, answerId } from './feedback-fixtures.mjs';
import { createFeedbackHandlers } from '../lib/feedback/http.mjs';
test('UI transport and actual backend HTTP contract agree without compatibility relaxation',async()=>{
 let generations=0;
 const feedback={...validateFeedback(validOutput(),context),id:'saved',answerId,createdAt:'2026-11-25T00:00:00Z'};
 const h=createFeedbackHandlers({authenticate:async()=>({}),makeService:()=>({read:async()=>({feedback:null,state:'not_evaluated'}),evaluate:async()=>{generations++;return {feedback,state:'ready',alreadySaved:false};}})});
 const result=await loadFeedback(answerId,{fetchImpl:(url,options)=>h[options.method](new Request('http://local'+url,options))});
 assert.equal(result.overall,6.5);assert.equal(generations,1);assert.equal(result.reasons.structure,feedback.scores.star.reason);
});
test('backend feedback preserves evidence, nullable STAR and outline in the UI', () => {
 const feedback = {...validateFeedback(validOutput('technical'), {...context,type:'technical'}), id:'id', answerId, createdAt:'2026-11-25T00:00:00Z'};
 const result = adaptFeedback({feedback,state:'ready'},answerId);
 assert.equal(result.overall,6.7); assert.equal(result.scores.structure,null);
 assert.equal(result.evidence[0].comment,feedback.scores.content.reason);
 assert.equal(result.outline.format,'key_points');
 assert.throws(()=>adaptFeedback({feedback:{...feedback,answerId:'other'}},answerId));
});
test('stored read does not POST; new evaluation sends only answerId',async()=>{
 const body={feedback:{...validateFeedback(validOutput(),context),id:'id',answerId,createdAt:'2026-11-25T00:00:00Z'},state:'ready'};
 const calls=[]; const fetchImpl=async(url,options)=>{calls.push({url,...options});return Response.json(calls.length===1?{feedback:null,state:'not_evaluated'}:body);};
 await loadFeedback(answerId,{fetchImpl}); assert.deepEqual(JSON.parse(calls[1].body),{answerId});
 calls.length=0; await loadFeedback(answerId,{fetchImpl:async(url,opts)=>{calls.push(opts);return Response.json(body);}}); assert.equal(calls.length,1);
 assert.equal(canRetryFeedback('AI_DAILY_LIMIT'),false); assert.equal(canRetryFeedback('AI_TIMEOUT'),true);
});
