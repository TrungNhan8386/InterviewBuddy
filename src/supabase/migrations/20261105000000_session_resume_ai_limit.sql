-- InterviewBuddy – SCRUM-80, SCRUM-81: save answers, resume sessions, daily AI call limit.
-- Apply after 20261103000000_interview_next.sql (Supabase > SQL Editor > New query > Run).

-- ---------------------------------------------------------------------------
-- 1. Save one answer (SCRUM-80)
-- ---------------------------------------------------------------------------
-- Security invoker: RLS on interview_sessions, questions and answers still
-- decides what the caller can see and write. Locking the session row puts the
-- save in the same queue as claim_interview_next / finish_interview_next.
-- Only the latest question of an in-progress session can be answered, and
-- saving the same question twice returns the answer already stored, so a
-- retried request after a network error is safe.
create function public.save_interview_answer(
  p_session_id uuid, p_question_id uuid, p_content text,
  p_input_mode text default 'text', p_duration_seconds numeric default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  s_status text;
  q_position smallint;
  latest_position smallint;
  saved public.answers%rowtype;
  body text := btrim(coalesce(p_content, ''));
begin
  select status into s_status from public.interview_sessions where id = p_session_id for update;
  if not found then return jsonb_build_object('error', 'NOT_FOUND'); end if;

  select position into q_position from public.questions
    where id = p_question_id and session_id = p_session_id;
  if not found then return jsonb_build_object('error', 'NOT_FOUND'); end if;

  select * into saved from public.answers where question_id = p_question_id;
  if found then
    return jsonb_build_object('alreadySaved', true, 'answer', jsonb_build_object(
      'id', saved.id, 'questionId', saved.question_id, 'createdAt', saved.created_at));
  end if;

  if s_status <> 'in_progress' then return jsonb_build_object('error', 'SESSION_CLOSED'); end if;
  select max(position) into latest_position from public.questions where session_id = p_session_id;
  if q_position <> latest_position then return jsonb_build_object('error', 'STALE_TURN'); end if;
  if char_length(body) not between 1 and 12000
      or p_input_mode is null or p_input_mode not in ('text', 'voice')
      or (p_duration_seconds is not null and p_duration_seconds not between 0 and 3600) then
    return jsonb_build_object('error', 'BAD_INPUT');
  end if;

  insert into public.answers (question_id, content, input_mode, duration_seconds, word_count)
    values (p_question_id, body, p_input_mode, round(p_duration_seconds, 1),
      array_length(regexp_split_to_array(body, '\s+'), 1))
    returning * into saved;
  return jsonb_build_object('alreadySaved', false, 'answer', jsonb_build_object(
    'id', saved.id, 'questionId', saved.question_id, 'createdAt', saved.created_at));
end;
$$;

revoke all on function public.save_interview_answer(uuid, uuid, text, text, numeric) from public, anon;
grant execute on function public.save_interview_answer(uuid, uuid, text, text, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Daily AI call limit (SCRUM-81)
-- ---------------------------------------------------------------------------
-- One row per user per day (Vietnam time). Users can read their own count but
-- never write it; only consume_ai_call() adds to it, so the limit cannot be
-- reset from the browser. Deleting CV and history (Settings) does not reset it.
create table public.ai_usage_daily (
  user_id    uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  calls      integer not null default 0 check (calls >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.ai_usage_daily enable row level security;
revoke all on public.ai_usage_daily from public, anon, authenticated;
grant select on public.ai_usage_daily to authenticated;
create policy "ai_usage_daily: read own rows" on public.ai_usage_daily
  for select to authenticated using (user_id = (select auth.uid()));

-- Counts one Gemini call for the signed-in user if today's count is below
-- p_limit. The server passes the limit (AI_DAILY_LIMIT); a user calling this
-- directly can only use up their own quota, never lower their count.
create function public.consume_ai_call(p_limit integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  used integer;
begin
  if uid is null then return jsonb_build_object('error', 'UNAUTHORIZED'); end if;
  if p_limit is null or p_limit not between 1 and 10000 then
    return jsonb_build_object('error', 'BAD_INPUT');
  end if;

  insert into public.ai_usage_daily as u (user_id, usage_date, calls)
    values (uid, today, 1)
    on conflict (user_id, usage_date) do update
      set calls = u.calls + 1, updated_at = now()
      where u.calls < p_limit
    returning calls into used;

  if used is null then
    select calls into used from public.ai_usage_daily where user_id = uid and usage_date = today;
    return jsonb_build_object('allowed', false, 'used', used, 'limit', p_limit,
      'resetAt', ((today + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh'));
  end if;
  return jsonb_build_object('allowed', true, 'used', used, 'limit', p_limit,
    'resetAt', ((today + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh'));
end;
$$;

revoke all on function public.consume_ai_call(integer) from public, anon;
grant execute on function public.consume_ai_call(integer) to authenticated;
