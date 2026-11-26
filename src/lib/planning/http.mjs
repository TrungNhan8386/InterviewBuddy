import { PlanError } from './contract.mjs';
export function planningHandlers({authenticate,makeService,makeRepository}) {
 const messages={BAD_INPUT:'Check the date, language and target position.',PLAN_HORIZON_EXCEEDED:'The initial planner supports up to 30 days including today.',GENERAL_PLAN_CONFIRMATION:'Complete an interview first, or explicitly accept a general plan.',PLAN_DAILY_LIMIT:'Daily plan limit reached. Resets at 00:00 Vietnam time.',AI_DAILY_LIMIT:'Daily AI limit reached. Resets at 00:00 Vietnam time.',SERVER_ERROR:'Could not finish the request. The previous plan is unchanged.',GENERATION_IN_PROGRESS:'A plan is being generated. Please wait.'};
 const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 async function handle(request,generate) {
  try {
   const auth=await authenticate(request);if(!auth)throw new PlanError('UNAUTHORIZED',401);
   if(!generate)return json({plan:await makeRepository(auth).read()});
   if(!request.headers.get('content-type')?.startsWith('application/json'))throw new PlanError('BAD_INPUT');
   const reader=request.body?.getReader();if(!reader)throw new PlanError('BAD_INPUT');
   const chunks=[];let length=0;
   try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>2048){await reader.cancel();throw new PlanError('BAD_INPUT');}chunks.push(value);}}finally{reader.releaseLock();}
   const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
   let body;try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new PlanError('BAD_INPUT');}
   const result=await makeService(auth).generate(body,{signal:request.signal});return json(result,result.alreadySaved?200:201);
  } catch(e){const code=e instanceof PlanError||e.name==='AiLimitError'?e.code:'SERVER_ERROR';const status=e instanceof PlanError?e.status:code==='AI_DAILY_LIMIT'?429:500;return json({error:{code,message:messages[code]||'The plan could not be generated. Try again later; existing data is preserved.'}},status);}
 }
 return {GET:r=>handle(r,false),POST:r=>handle(r,true)};
}
