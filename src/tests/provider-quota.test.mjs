import test from 'node:test';
import assert from 'node:assert/strict';
import { createGeminiProvider } from '../lib/analysis/gemini.mjs';
import { createInterviewerProvider } from '../lib/interview/interviewer-provider.mjs';
import { interviewerFixtures } from '../lib/interview/interviewer-fixtures.mjs';
import { CHAT_TEXT } from '../lib/interview-chat/text.ts';
import { RESULT_TEXT } from '../lib/analysis/result-text.ts';
import { createTestDatabase } from './interview-next-db.mjs';
import { createNextService } from '../lib/interview/next-service.mjs';
const input=interviewerFixtures.find(x=>x.id==='backend-en-vague').input;
const privateBody='PRIVATE_PROVIDER_BODY_DO_NOT_FORWARD';
const env={GEMINI_API_KEY:'offline-only-test-key',GEMINI_MODEL:'offline-test-model'};
for(const mode of ['analysis','generate','stream-http','stream-in-band'])test(`${mode}: quota is explicit, sanitized and never automatically retried`,async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;return mode==='stream-in-band'
  ? new Response('data: '+JSON.stringify({error:{code:429,message:privateBody}})+'\n\n',{headers:{'Content-Type':'text/event-stream'}})
  :new Response(privateBody,{status:429});};
 const run=async()=>{
  if(mode==='analysis')return createGeminiProvider({env,fetchImpl}).analyze({cvText:'Synthetic CV',jdText:'Synthetic JD',language:'en'});
  const p=createInterviewerProvider({env,fetchImpl});if(mode==='generate')return p.next(input);
  for await(const item of p.stream(input))assert.fail('Quota must not emit a valid question: '+item.type);
 };
 await assert.rejects(run,error=>{assert.equal(error.code,'AI_RATE_LIMITED');assert.equal(error.status,429);assert.match(error.message,/provider/i);assert.match(error.message,/quota/i);assert.equal(error.message.includes(privateBody),false);return true;});
 assert.equal(calls,1);
});
test('provider quota preserves saved answer and releases the turn so one manual retry recovers without duplicates',async()=>{
 const store=await createTestDatabase();let limited=false;let calls=0;
 try{
  const sessionId=await store.session();
  const provider=createInterviewerProvider({env,fetchImpl:async(_url,options)=>{
   calls++;if(limited)return new Response(privateBody,{status:429});
   const data=JSON.parse(JSON.parse(options.body).contents[0].parts[0].text);const turns=data.completedTurns;
   return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({action:turns.length?'follow_up':'next_topic',topic:turns.at(-1)?.topic??'React',question:turns.length?'Bạn sẽ kiểm thử lỗi mạng trong component đó như thế nào?':'Bạn sẽ xử lý các trạng thái API trong React như thế nào?',reason:'Kiểm tra cơ chế xử lý lỗi.'})}]}}]});
  }});
  const next=createNextService({repository:store.repository,provider});const opening=await next({sessionId,afterAnswerId:null});const answerId=await store.answer(opening.question.id);
  limited=true;await assert.rejects(next({sessionId,afterAnswerId:answerId}),{code:'AI_RATE_LIMITED',status:429});
  assert.equal(calls,2,'No automatic provider retry');
  const count=async(table)=>(await store.db.query(`select count(*)::int as n from public.${table}`)).rows[0].n;
  assert.equal(await count('questions'),1);assert.equal(await count('answers'),1);
  limited=false;const recovered=await next({sessionId,afterAnswerId:answerId});const replay=await next({sessionId,afterAnswerId:answerId});
  assert.deepEqual(replay,recovered);assert.equal(calls,3);assert.equal(await count('questions'),2);assert.equal(await count('answers'),1);
 }finally{await store.db.close();}
});
for(const language of ['vi','en'])test(`${language}: Analysis and Chat distinguish provider quota from app daily allowance`,()=>{
 const chat=CHAT_TEXT[language].errors;const analysis=RESULT_TEXT[language].errors;
 assert.match(chat.AI_RATE_LIMITED,language==='vi'?/nhà cung cấp/i:/provider/i);
 assert.match(analysis.RATE_LIMIT,language==='vi'?/nhà cung cấp/i:/provider/i);
 assert.match(chat.AI_RATE_LIMITED,/quota/i);assert.match(analysis.RATE_LIMIT,/quota/i);
 assert.match(chat.AI_RATE_LIMITED,language==='vi'?/đã lưu/i:/saved/i);
 assert.match(analysis.RATE_LIMIT,/JD.*CV|CV.*JD/);
 assert.notEqual(chat.AI_RATE_LIMITED,chat.AI_DAILY_LIMIT);assert.notEqual(analysis.RATE_LIMIT,analysis.DAILY_LIMIT);
 assert.doesNotMatch(chat.AI_RATE_LIMITED,/00:00|0:00|few minutes|ít phút/i);
});
