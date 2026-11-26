begin;
-- Initial UC-13: one current validated plan per candidate, tasks stored atomically.
create table public.practice_plans (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 id uuid not null default gen_random_uuid(), fingerprint text not null,
 payload jsonb not null check(jsonb_typeof(payload->'tasks')='array'), created_at timestamptz not null default now()
);
create table public.practice_plan_leases (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 token uuid not null, fingerprint text not null, expires_at timestamptz not null
);
create table public.practice_plan_usage (
 user_id uuid references public.profiles(id) on delete cascade, day date not null, count integer not null default 0,
 primary key(user_id,day)
);
-- Validate the entire calendar at the write boundary, including direct RPC calls.
-- This is immutable: dates are checked against the generation snapshot, not today's clock.
create function public.valid_practice_plan_payload(p_payload jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare day_count integer; first_day date; last_day date; item jsonb; criterion text; index integer;
begin
 if jsonb_typeof(p_payload) is distinct from 'object'
  or not (p_payload ?& array['interviewDate','language','targetPosition','sourceSessionId','general','dates','remainingDays','weakCriteria','tasks'])
  or (select count(*) from jsonb_object_keys(p_payload))<>9 then return false;end if;
 if jsonb_typeof(p_payload->'interviewDate') is distinct from 'string'
  or (p_payload->>'interviewDate') !~ '^\d{4}-\d{2}-\d{2}$'
  or jsonb_typeof(p_payload->'language') is distinct from 'string'
  or p_payload->>'language' not in ('vi','en')
  or jsonb_typeof(p_payload->'targetPosition') is distinct from 'string'
  or (p_payload->>'targetPosition') !~ '\S' or length(p_payload->>'targetPosition')>200
  or jsonb_typeof(p_payload->'general') is distinct from 'boolean'
  or jsonb_typeof(p_payload->'dates') is distinct from 'array'
  or jsonb_typeof(p_payload->'tasks') is distinct from 'array'
  or jsonb_typeof(p_payload->'weakCriteria') is distinct from 'array'
  or jsonb_typeof(p_payload->'remainingDays') is distinct from 'number'
  or (p_payload->>'remainingDays') !~ '^[0-9]+$' then return false;end if;
 day_count:=jsonb_array_length(p_payload->'dates');
 if day_count not between 1 and 30 or jsonb_array_length(p_payload->'tasks')<>day_count
  or (p_payload->>'remainingDays')::integer<>day_count
  or jsonb_array_length(p_payload->'weakCriteria')>2 then return false;end if;
 if jsonb_typeof(p_payload->'dates'->0) is distinct from 'string'
  or (p_payload->'dates'->>0) !~ '^\d{4}-\d{2}-\d{2}$' then return false;end if;
 first_day:=(p_payload->'dates'->>0)::date;last_day:=(p_payload->>'interviewDate')::date;
 if last_day-first_day<>day_count-1 then return false;end if;
 if (select count(*) from jsonb_array_elements(p_payload->'weakCriteria'))<>
    (select count(distinct value) from jsonb_array_elements(p_payload->'weakCriteria')) then return false;end if;
 for item in select value from jsonb_array_elements(p_payload->'weakCriteria') loop
  if jsonb_typeof(item)<>'string' or item #>> '{}' not in ('content','star','clarity','confidence') then return false;end if;
 end loop;
 if (p_payload->>'general')::boolean then
  if jsonb_array_length(p_payload->'weakCriteria')<>0 or p_payload->'sourceSessionId'<>'null'::jsonb then return false;end if;
 else
  if jsonb_array_length(p_payload->'weakCriteria') not between 1 and 2
   or jsonb_typeof(p_payload->'sourceSessionId') is distinct from 'string'
   or (p_payload->>'sourceSessionId') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then return false;end if;
 end if;
 for index in 0..day_count-1 loop
  if jsonb_typeof(p_payload->'dates'->index) is distinct from 'string'
   or p_payload->'dates'->>index<>to_char(first_day+index,'YYYY-MM-DD') then return false;end if;
  item:=p_payload->'tasks'->index;
  if jsonb_typeof(item) is distinct from 'object'
   or not (item ?& array['date','criterion','task','rationale','completed'])
   or (select count(*) from jsonb_object_keys(item))<>5
   or item->'date'<>p_payload->'dates'->index
   or jsonb_typeof(item->'criterion') is distinct from 'string'
   or jsonb_typeof(item->'task') is distinct from 'string'
   or jsonb_typeof(item->'rationale') is distinct from 'string'
   or (item->>'task') !~ '\S' or length(item->>'task')>1200
   or (item->>'rationale') !~ '\S' or length(item->>'rationale')>1200
   or item->'completed'<>'false'::jsonb then return false;end if;
  criterion:=item->>'criterion';
  if criterion not in ('content','star','clarity','confidence')
   or (not (p_payload->>'general')::boolean and not ((p_payload->'weakCriteria') ? criterion)) then return false;end if;
 end loop;
 return true;
exception when others then return false;
end $$;
alter table public.practice_plans add constraint practice_plan_calendar_valid
 check (public.valid_practice_plan_payload(payload));
revoke all on function public.valid_practice_plan_payload(jsonb) from public,anon,authenticated;
alter table public.practice_plans enable row level security;
alter table public.practice_plan_leases enable row level security;
alter table public.practice_plan_usage enable row level security;
create policy read_own_plan on public.practice_plans for select to authenticated using(user_id=(select auth.uid()));
grant select on public.practice_plans to authenticated;
revoke all on public.practice_plan_leases,public.practice_plan_usage from anon,authenticated;
create function public.read_practice_plan() returns jsonb language sql security definer set search_path='' as $$
 select payload || jsonb_build_object('id',id,'createdAt',created_at) from public.practice_plans where user_id=auth.uid()
$$;
create function public.claim_practice_plan(p_fingerprint text) returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); lease public.practice_plan_leases%rowtype; result jsonb; used integer;
begin
 if owner_id is null then raise exception 'Authentication required' using errcode='42501';end if;
 if p_fingerprint !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','BAD_INPUT');end if;
 perform 1 from public.profiles where id=owner_id for update;
 select public.read_practice_plan() into result from public.practice_plans where user_id=owner_id and fingerprint=p_fingerprint;
 if result is not null then return jsonb_build_object('kind','ready','plan',result);end if;
 select * into lease from public.practice_plan_leases where user_id=owner_id;
 if found and lease.expires_at>now() then return jsonb_build_object('kind','busy');end if;
 insert into public.practice_plan_usage(user_id,day) values(owner_id,(now() at time zone 'Asia/Ho_Chi_Minh')::date) on conflict do nothing;
 select count into used from public.practice_plan_usage where user_id=owner_id and day=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
 if used>=3 then return jsonb_build_object('error','PLAN_DAILY_LIMIT');end if;
 update public.practice_plan_usage set count=count+1 where user_id=owner_id and day=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
 insert into public.practice_plan_leases values(owner_id,gen_random_uuid(),p_fingerprint,now()+interval '60 seconds')
 on conflict(user_id) do update set token=excluded.token,fingerprint=excluded.fingerprint,expires_at=excluded.expires_at returning * into lease;
 return jsonb_build_object('kind','claimed','token',lease.token);
end $$;
create function public.finish_practice_plan(p_token uuid,p_fingerprint text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid();
begin
 if owner_id is null then raise exception 'Authentication required' using errcode='42501';end if;
 perform 1 from public.profiles where id=owner_id for update;
 if not exists(select 1 from public.practice_plan_leases where user_id=owner_id and token=p_token and fingerprint=p_fingerprint and expires_at>now()) then return jsonb_build_object('error','LEASE_LOST');end if;
 if not public.valid_practice_plan_payload(p_payload) then return jsonb_build_object('error','INVALID_OUTPUT');end if;
 if p_payload->>'sourceSessionId' is not null and not exists(
  select 1 from public.interview_sessions where id=(p_payload->>'sourceSessionId')::uuid and user_id=owner_id and status='completed'
 ) then return jsonb_build_object('error','NOT_FOUND');end if;
 insert into public.practice_plans(user_id,fingerprint,payload) values(owner_id,p_fingerprint,p_payload)
 on conflict(user_id) do update set id=gen_random_uuid(),fingerprint=excluded.fingerprint,payload=excluded.payload,created_at=now();
 delete from public.practice_plan_leases where user_id=owner_id;
 return public.read_practice_plan();
end $$;
create function public.release_practice_plan(p_token uuid) returns void language sql security definer set search_path='' as $$
 delete from public.practice_plan_leases where user_id=auth.uid() and token=p_token
$$;
create or replace function public.delete_own_practice_data() returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); sessions_deleted bigint; analyses_deleted bigint;
begin
 if owner_id is null then raise exception 'Authentication required' using errcode='42501';end if;
 perform 1 from public.profiles where id=owner_id for update;
 delete from public.practice_plan_leases where user_id=owner_id;
 delete from public.practice_plans where user_id=owner_id;
 delete from public.interview_sessions where user_id=owner_id;get diagnostics sessions_deleted=row_count;
 delete from public.fit_analyses where user_id=owner_id;get diagnostics analyses_deleted=row_count;
 -- Preserve daily counters, as with the shared AI quota; deletion cannot reset allowance.
 return jsonb_build_object('sessionsDeleted',sessions_deleted,'analysesDeleted',analyses_deleted);
end $$;
revoke all on function public.read_practice_plan(),public.claim_practice_plan(text),public.finish_practice_plan(uuid,text,jsonb),public.release_practice_plan(uuid),public.delete_own_practice_data() from public,anon;
grant execute on function public.read_practice_plan(),public.claim_practice_plan(text),public.finish_practice_plan(uuid,text,jsonb),public.release_practice_plan(uuid),public.delete_own_practice_data() to authenticated;
commit;
