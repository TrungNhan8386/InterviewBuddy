import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInterviewerOutput } from '../lib/interview/interviewer-contract.mjs';
import { buildInterviewerRequest } from '../lib/interview/interviewer-prompt.mjs';
import { createInterviewerProvider } from '../lib/interview/interviewer-provider.mjs';
import { scoreAnalysis } from '../lib/analysis/scoring.mjs';
import { fixtures } from './helpers.mjs';
import { createGeminiProvider } from '../lib/analysis/gemini.mjs';
import { interviewerFixtures } from '../lib/interview/interviewer-fixtures.mjs';
import { createTestDatabase } from './interview-next-db.mjs';
import { createNextService } from '../lib/interview/next-service.mjs';
import { protectedRequirement } from '../lib/ai/guardrails.mjs';
const input=interviewerFixtures.find(x=>x.id==='backend-en-vague').input;
const decision=question=>({action:'follow_up',topic:input.history.at(-1).topic,question,reason:'Clarify the implementation.'});
for(const q of ['Are you married?','What is your religion?','Bạn đã kết hôn chưa?','Bạn có dự định sinh con không?','You are stupid and worthless.','Why are you so stupid?'])test('reject candidate-directed unsafe output: '+q,()=>assert.throws(()=>validateInterviewerOutput(decision(q),input),{code:'INVALID_OUTPUT'}));
for(const q of ['How would you prevent gender bias in a hiring application?','How would you test SQL injection prevention?','How would you handle a user reporting harassment?','How would you validate the age of a database record?','Bạn sẽ kiểm thử quyền truy cập của người dùng như thế nào?'])test('allow legitimate professional question: '+q,()=>assert.equal(validateInterviewerOutput(decision(q),input).question,q));
test('analysis rejects an offensive generated summary while preserving normal fixtures',()=>{
 const f=fixtures[0];assert.doesNotThrow(()=>scoreAnalysis(f.aiResponse,f.input));
 assert.throws(()=>scoreAnalysis({...f.aiResponse,summary:'You are worthless.'},f.input),{code:'INVALID_AI_RESPONSE'});
});
test('provider safety settings explicitly cover hate and harassment',()=>{
 const req=buildInterviewerRequest(input);
 for(const category of ['HARM_CATEGORY_HATE_SPEECH','HARM_CATEGORY_HARASSMENT'])assert.ok(req.safetySettings?.some(x=>x.category===category&&x.threshold==='BLOCK_MEDIUM_AND_ABOVE'));
});
test('unsafe stream prefix is rejected before that text is emitted',async()=>{
 const raw=JSON.stringify(decision('Are you married?'));
 const provider=createInterviewerProvider({env:{GEMINI_API_KEY:'offline-only',GEMINI_MODEL:'offline'},fetchImpl:async()=>new Response('data: '+JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:raw}]}}]})+'\n\n',{headers:{'Content-Type':'text/event-stream'}})});
 const emitted=[];await assert.rejects(async()=>{for await(const x of provider.stream(input))emitted.push(x);},{code:'INVALID_OUTPUT'});
 assert.equal(emitted.length,0);
});
test('protected demographic requirement is not confused with a professional bias-prevention skill',()=>{
 for(const label of ['Age','Gender','Giới tính','Tôn giáo','Age > 30'])assert.equal(protectedRequirement(label),true,label);
 for(const label of ['Language models','Gender bias prevention','Age of a database record','Race condition testing'])assert.equal(protectedRequirement(label),false,label);
});
test('a protected attribute cannot become a scored requirement even if quoted in both documents',()=>{
 const input={cvText:'Synthetic profile. Gender',jdText:'Synthetic JD. Gender',language:'en'};
 const raw={requirements:[{skill:'Gender',importance:'required',matched:true,jdEvidence:'Gender',cvEvidence:'Gender',reason:'Document match.'}],summary:'Skills review.',coaching:{beforeInterview:[],improvements:[],strengths:[{skill:'Gender',advice:'Discuss the requirement.'}]}};
 assert.throws(()=>scoreAnalysis(raw,input),{code:'INVALID_AI_RESPONSE'});
});
test('unsafe generated question is not persisted and a safe retry can claim the same turn',async()=>{
 const store=await createTestDatabase();let unsafe=true;
 try{
  const sessionId=await store.session();const provider={model:'offline',next:async()=>({action:'next_topic',question:unsafe?'Are you married?':'Bạn sẽ kiểm thử REST API như thế nào?',topic:'API testing',reason:'Check the implementation.'})};
  const next=createNextService({repository:store.repository,provider});const body={sessionId,afterAnswerId:null};
  await assert.rejects(next(body),{code:'INVALID_OUTPUT'});assert.equal((await store.db.query('select count(*)::int as n from public.questions')).rows[0].n,0);
  unsafe=false;await next(body);assert.equal((await store.db.query('select count(*)::int as n from public.questions')).rows[0].n,1);
 }finally{await store.db.close();}
});
for(const finishReason of ['SAFETY','BLOCKLIST','PROHIBITED_CONTENT','SPII'])test('provider block reason '+finishReason+' is a content block, not malformed output',async()=>{
 const envelope={candidates:[{finishReason,content:{parts:[]}}]};
 const env={GEMINI_API_KEY:'offline-only',GEMINI_MODEL:'offline'};
 const json=async()=>Response.json(envelope);
 await assert.rejects(createGeminiProvider({env,fetchImpl:json}).analyze(fixtures[0].input),{code:'AI_CONTENT_BLOCKED'});
 await assert.rejects(createInterviewerProvider({env,fetchImpl:json}).next(input),{code:'AI_CONTENT_BLOCKED'});
 const stream=createInterviewerProvider({env,fetchImpl:async()=>new Response('data: '+JSON.stringify(envelope)+'\n\n',{headers:{'Content-Type':'text/event-stream'}})});
 await assert.rejects(async()=>{for await(const x of stream.stream(input))assert.fail('Blocked frame emitted: '+x.type);},{code:'AI_CONTENT_BLOCKED'});
});
