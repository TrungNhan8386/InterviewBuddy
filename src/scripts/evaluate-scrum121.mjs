// Explicit provider-only replay; no Supabase writes, no automatic retries.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { buildInterviewerRequest, PROMPT_VERSION } from '../lib/interview/interviewer-prompt.mjs';
import { validateInterviewerInput, validateInterviewerOutput } from '../lib/interview/interviewer-contract.mjs';
const phase=process.argv[2];
if (!['baseline','candidate'].includes(phase) || !process.argv.includes('--live')) throw new Error('Use baseline|candidate --live (uses Gemini quota).');
if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_MODEL) throw new Error('Configure GEMINI_API_KEY and GEMINI_MODEL privately before a live replay.');
const sessions=JSON.parse(await readFile(new URL('../../docs/test/fixtures/scrum121-reviewed-sessions.json',import.meta.url),'utf8'));
const dir=new URL('../../docs/test/results/scrum121/',import.meta.url);await mkdir(dir,{recursive:true});
const result={phase,promptVersion:PROMPT_VERSION,model:process.env.GEMINI_MODEL,boundary:'Real Gemini REST replay of complete synthetic saved sessions; provider-only, no UI/Auth/Supabase write acceptance.',automaticRetries:0,attempts:[]};
let stopped=false;
for(const s of sessions) for(const count of [1,3]) {
 const history=s.questions.filter(q=>q.answers?.content).slice(0,count).map(q=>({kind:q.kind,topic:q.topic,question:q.content,answer:q.answers.content}));
 const input=validateInterviewerInput({settings:{type:s.round_type,difficulty:s.difficulty,language:s.language,targetPosition:s.target_position,durationMinutes:s.duration_minutes,plannedQuestions:s.planned_questions},state:{status:'in_progress',elapsedSeconds:90},jdText:s.jd_text,cvText:s.cv_text,history});
 const entry={id:s.alias+'-after-'+count,language:s.language,historyLength:history.length,latestQuestion:history.at(-1).question,latestAnswer:history.at(-1).answer};
 if(stopped){result.attempts.push({...entry,status:'not-run-after-rate-limit'});continue;}
 const start=Date.now();
 try{
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL}:generateContent`,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},body:JSON.stringify(buildInterviewerRequest(input)),signal:AbortSignal.timeout(30000)});
  if(!response.ok){await response.body?.cancel();entry.status='provider-error';entry.httpStatus=response.status;if(response.status===429)stopped=true;}
  else{const body=await response.json();const candidate=body.candidates?.[0];if(body.promptFeedback?.blockReason||candidate?.finishReason==='SAFETY')entry.status='provider-content-blocked';else{const raw=(candidate?.content?.parts??[]).filter(p=>!p.thought).map(p=>p.text??'').join('');entry.output=validateInterviewerOutput(JSON.parse(raw),input);entry.status='valid';}}
 }catch(error){entry.status='error';entry.code=/^[A-Z_]+$/.test(error?.code??'')?error.code:error.name==='TimeoutError'?'AI_TIMEOUT':'INVALID_OUTPUT';}
 entry.elapsedMs=Date.now()-start;result.attempts.push(entry);await writeFile(new URL(phase+'.json',dir),JSON.stringify(result,null,2)+'\n');console.log(entry.id,entry.status,entry.output?.action??entry.httpStatus??entry.code);
 await new Promise(resolve=>setTimeout(resolve,Math.max(0,8000-(Date.now()-start))));
}
await writeFile(new URL(phase+'.json',dir),JSON.stringify(result,null,2)+'\n');
