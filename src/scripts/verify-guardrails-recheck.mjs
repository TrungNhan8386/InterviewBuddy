import {readFile,writeFile} from 'node:fs/promises';
import {createInterviewerProvider} from '../lib/interview/interviewer-provider.mjs';
import {createGeminiProvider} from '../lib/analysis/gemini.mjs';
import {scoreAnalysis} from '../lib/analysis/scoring.mjs';
if(!process.argv.includes('--live')||!process.env.GEMINI_API_KEY)throw new Error('Use --live with private credentials (uses Gemini quota).');
const original=JSON.parse(await readFile('../docs/test/results/scrum123/live.json','utf8'));const cases=[];
for(const item of original.cases.filter(x=>x.status==='error')){
 let httpStatus=null;const fetchImpl=async(...args)=>{const r=await fetch(...args);httpStatus=r.status;return r;};const result={id:item.id,mode:item.mode,recheckOf:'live.json',httpStatus:null};
 try{result.output=item.mode==='analysis'?scoreAnalysis(await createGeminiProvider({fetchImpl}).analyze(item.input),item.input):await createInterviewerProvider({fetchImpl}).next(item.input);result.status='valid';}catch(e){result.status=e.code==='AI_CONTENT_BLOCKED'?'provider-blocked':'error';result.code=e.code??'UNEXPECTED_ERROR';}
 result.httpStatus=httpStatus;cases.push(result);await writeFile('../docs/test/results/scrum123/recheck.json',JSON.stringify({boundary:'Separate diagnostic recheck; original failed attempts retained, not replaced. Real Gemini, synthetic data, no DB writes.',cases},null,2));console.log(result.id,result.status,httpStatus);await new Promise(r=>setTimeout(r,8000));
}
