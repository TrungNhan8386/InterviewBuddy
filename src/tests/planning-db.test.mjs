import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createTestDatabase,USER_B} from './interview-next-db.mjs';
import {savedPlanPayload} from './planning-fixtures.mjs';
test('planning SQL ownership, leases, replay, daily limit and purge',async t=>{
 const s=await createTestDatabase();t.after(()=>s.db.close());await s.db.exec('reset role');
 for(const name of ['20261107000000_settings_data.sql','20261125000000_practice_plans.sql']) await s.db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 await s.user();const rpc=async(name,args=[]) => (await s.db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) r`,args)).rows[0].r;
 assert.equal(await rpc('read_practice_plan'),null);
 const c=await rpc('claim_practice_plan',['a'.repeat(64)]);assert.equal(c.kind,'claimed');
 assert.equal((await rpc('claim_practice_plan',['b'.repeat(64)])).kind,'busy');
 const payload=savedPlanPayload();
 await s.user(USER_B);assert.equal((await rpc('finish_practice_plan',[c.token,'a'.repeat(64),payload])).error,'LEASE_LOST');
 assert.equal(await rpc('read_practice_plan'),null);
 await s.user();const saved=await rpc('finish_practice_plan',[c.token,'a'.repeat(64),payload]);assert.ok(saved.id);
 await s.user(USER_B);assert.equal(await rpc('read_practice_plan'),null);
 assert.equal((await s.db.query('select * from public.practice_plans')).rows.length,0);
 await s.user();
 assert.equal((await rpc('claim_practice_plan',['a'.repeat(64)])).kind,'ready');
 for(const key of ['b','c']) {const next=await rpc('claim_practice_plan',[key.repeat(64)]);await rpc('release_practice_plan',[next.token]);}
 assert.equal((await rpc('claim_practice_plan',['d'.repeat(64)])).error,'PLAN_DAILY_LIMIT');
 await rpc('delete_own_practice_data');assert.equal(await rpc('read_practice_plan'),null);
 assert.equal((await rpc('claim_practice_plan',['e'.repeat(64)])).error,'PLAN_DAILY_LIMIT');
});

test('finish RPC rejects malformed schedules and preserves both the previous plan and lease',async t=>{
 const s=await createTestDatabase();t.after(()=>s.db.close());await s.db.exec('reset role');
 for(const file of ['20261107000000_settings_data.sql','20261125000000_practice_plans.sql'])await s.db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 await s.user();
 const rpc=async(name,args=[])=>(await s.db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) r`,args)).rows[0].r;
 const first=await rpc('claim_practice_plan',['a'.repeat(64)]);
 const previous=await rpc('finish_practice_plan',[first.token,'a'.repeat(64),savedPlanPayload()]);
 const next=await rpc('claim_practice_plan',['b'.repeat(64)]);
 const cases={
  missing_day:p=>p.tasks.pop(), duplicate_date:p=>{p.tasks[1].date=p.tasks[0].date;},
  reversed_dates:p=>p.tasks.reverse(), empty_task:p=>{p.tasks[0].task='  ';},
  empty_reason:p=>{p.tasks[0].rationale='';}, unknown_criterion:p=>{p.tasks[0].criterion='invented';},
  whitespace_task:p=>{p.tasks[0].task='\n\t\r';}, whitespace_position:p=>{p.targetPosition='\t\n';},
  invalid_calendar:p=>{p.interviewDate='2026-02-30';}, wrong_count:p=>{p.remainingDays=3;},
  incoherent_dates:p=>{p.dates[1]='2026-11-27';}, invalid_language:p=>{p.language='xx';},
  invented_weakness:p=>{p.general=false;p.weakCriteria=['invented'];},
  unexpected_done:p=>{p.tasks[0].completed=true;}, missing_metadata:p=>{delete p.targetPosition;},
  null_task:p=>{p.tasks[0]=null;}, invalid_dates_type:p=>{p.dates='2026-11-25';},
  non_integer_count:p=>{p.remainingDays=2.1;}, invented_general_weakness:p=>{p.weakCriteria=['clarity'];},
  duplicate_weakness:p=>{p.general=false;p.weakCriteria=['clarity','clarity'];},
  oversized_task:p=>{p.tasks[0].task='x'.repeat(1201);},
 };
 for(const [name,mutate] of Object.entries(cases)){
  const payload=savedPlanPayload();mutate(payload);
  assert.equal((await rpc('finish_practice_plan',[next.token,'b'.repeat(64),payload])).error,'INVALID_OUTPUT',name);
  assert.equal((await rpc('read_practice_plan')).id,previous.id,name);
 }
 const valid=await rpc('finish_practice_plan',[next.token,'b'.repeat(64),savedPlanPayload()]);
 assert.ok(valid.id);assert.notEqual(valid.id,previous.id);
});

test('plan source must belong to the caller and table constraints also reject invalid calendars',async t=>{
 const s=await createTestDatabase();t.after(()=>s.db.close());await s.db.exec('reset role');
 for(const file of ['20261107000000_settings_data.sql','20261125000000_practice_plans.sql'])await s.db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 await s.user(USER_B);const foreign=await s.session();await s.db.query("update public.interview_sessions set status='completed' where id=$1",[foreign]);
 await s.user();const own=await s.session();await s.db.query("update public.interview_sessions set status='completed' where id=$1",[own]);
 const rpc=async(name,args=[])=>(await s.db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) r`,args)).rows[0].r;
 const claim=await rpc('claim_practice_plan',['a'.repeat(64)]);
 const payload={...savedPlanPayload(),general:false,weakCriteria:['clarity','content'],sourceSessionId:foreign};
 assert.equal((await rpc('finish_practice_plan',[claim.token,'a'.repeat(64),payload])).error,'NOT_FOUND');
 assert.equal(await rpc('read_practice_plan'),null);
 await s.db.exec('reset role');
 await assert.rejects(s.db.query('insert into public.practice_plans(user_id,fingerprint,payload) select user_id,$2,$3 from public.interview_sessions where id=$1',[own,'a'.repeat(64),{tasks:[{}]}]),{code:'23514'});
 await s.user();payload.sourceSessionId=own;
 const saved=await rpc('finish_practice_plan',[claim.token,'a'.repeat(64),payload]);
 assert.ok(saved.id);assert.equal(saved.sourceSessionId,own);
});
