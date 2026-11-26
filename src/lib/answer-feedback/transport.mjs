const failure = code => { const e = new Error(code); e.code = code; throw e; };
export function canRetryFeedback(code) {
 return !['AI_DAILY_LIMIT','AI_RATE_LIMITED','AI_CONTENT_BLOCKED','AI_NOT_CONFIGURED','AI_CONFIGURATION_ERROR','FEEDBACK_UNAVAILABLE','NOT_FOUND','UNAUTHORIZED','BAD_INPUT','SESSION_CONTEXT_INVALID'].includes(code);
}
export function adaptFeedback(body, answerId) {
 const f = body?.feedback;
 if (!f || f.answerId !== answerId || !['behavioral','technical','hr'].includes(f.questionType)) failure('INVALID_OUTPUT');
 const scores={}, evidence=[], reasons={};
 for(const key of ['content','star','clarity','confidence']) {
  const item=f.scores?.[key], name=key==='star'?'structure':key;
  if(key==='star' && f.questionType!=='behavioral') {
   if(item?.score!==null || item?.applicable!==false) failure('INVALID_OUTPUT');
   scores[name]=null; continue;
  }
  if(!Number.isInteger(item?.score)||item.score<0||item.score>10||typeof item.reason!=='string'||!Array.isArray(item.quotes)||!item.quotes.length||!item.quotes.every(q=>typeof q==='string'&&q.length)) failure('INVALID_OUTPUT');
  scores[name]=item.score; reasons[name]=item.reason;
  for(const quote of item.quotes) evidence.push({criterion:name,quote,comment:item.reason,effect:'neutral'});
 }
 const values=Object.values(scores).filter(v=>v!==null);
 if(f.overallScore!==Math.round(values.reduce((a,b)=>a+b,0)/values.length*10)/10 || !Array.isArray(f.outline?.sections)||!f.outline.sections.every(s=>typeof s.guidance==='string'&&s.guidance.trim())||!['strengths','improvements'].every(k=>Array.isArray(f[k])&&f[k].length&&f[k].every(t=>typeof t==='string'&&t.trim()))) failure('INVALID_OUTPUT');
 const star=f.questionType==='behavioral';
 if(f.outline.kind!==(star?'star':'key_points') || (star&&f.outline.sections.length!==4)) failure('INVALID_OUTPUT');
 const outline=star?{format:'star',...Object.fromEntries(['situation','task','action','result'].map((k,i)=>[k,f.outline.sections[i].guidance]))}:{format:'key_points',points:f.outline.sections.map(s=>s.guidance)};
 return {feedbackId:f.id,answerId,questionType:f.questionType,scores,reasons,overall:f.overallScore,evidence,strengths:f.strengths,improvements:f.improvements,outline,createdAt:f.createdAt};
}
export async function loadFeedback(answerId,{signal,fetchImpl=globalThis.fetch}={}) {
 async function request(method) {
  let r; try {r=await fetchImpl(method==='GET'?`/api/evaluate-answer?answerId=${encodeURIComponent(answerId)}`:'/api/evaluate-answer',{method,signal,cache:'no-store',...(method==='POST'?{headers:{'Content-Type':'application/json'},body:JSON.stringify({answerId})}:{})});} catch {failure(signal?.aborted?'REQUEST_CANCELLED':'NETWORK_ERROR');}
  const body=await r.json().catch(()=>null);
  if(!r.ok) failure(body?.error?.code||({401:'UNAUTHORIZED',429:'AI_RATE_LIMITED',504:'AI_TIMEOUT'}[r.status])||'SERVER_ERROR');
  return body;
 }
 const saved=await request('GET');
 if(saved?.feedback) return adaptFeedback(saved,answerId);
 if(saved?.state==='generating') failure('GENERATION_IN_PROGRESS');
 if(!['not_evaluated','failed'].includes(saved?.state)) failure('INVALID_OUTPUT');
 return adaptFeedback(await request('POST'),answerId);
}
