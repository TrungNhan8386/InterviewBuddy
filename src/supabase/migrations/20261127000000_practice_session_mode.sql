-- InterviewBuddy – UC-10 practice sessions follow the saved questions (SCRUM-205). Owner: Khang.
-- Apply after 20261124000000_practice_questions.sql:
-- Supabase dashboard > SQL Editor > New query > paste this file > Run.
--
-- Test cases UC10-02 and UC10-03 (Build 2):
-- * "Practice this question": a session with only that question. No follow-up,
--   no next question, no time limit, no report. The chat page links back to the report.
-- * "Start practice session": the saved questions of the report, in list order.
--   The questions come from practice_questions, never from the AI.
--
-- 1. interview_sessions.practice_mode / practice_question_ids / practice_source_session_id
--    mark such a session and keep its ordered question list.
-- 2. start_practice_session(id, mode) replaces start_practice_session(id).
-- 3. practice_next_turn() gives the next saved question (or ends the session).
--    /api/interview/next calls it before the AI engine; for a normal interview it
--    returns { kind: 'not_practice' } and the engine runs as before.
-- Contract: docs/api/PRACTICE_API_v1.md

alter table public.interview_sessions
  add column practice_mode text check (practice_mode in ('single', 'all')),
  add column practice_question_ids uuid[],
  add column practice_source_session_id uuid references public.interview_sessions (id) on delete set null,
  add constraint interview_sessions_practice_fields check (
    (practice_mode is null and practice_question_ids is null)
    or (practice_mode is not null and cardinality(practice_question_ids) between 1 and 10));

create index interview_sessions_practice_source_idx
  on public.interview_sessions (practice_source_session_id) where practice_source_session_id is not null;

comment on column public.interview_sessions.practice_mode is
  'UC-10: single = one practice question, all = every saved practice question in order. Null for normal interviews.';
comment on column public.interview_sessions.practice_question_ids is
  'UC-10: practice_questions ids asked in this order. Question n of the session is element n.';
comment on column public.interview_sessions.practice_source_session_id is
  'UC-10: the reported interview the practice questions came from (for "Back to report").';

create function public.practice_topic(p_criterion text, p_language text)
returns text language sql immutable set search_path = '' as $$
  select case when p_language = 'en' then
    case p_criterion when 'content' then 'Practice: content' when 'structure' then 'Practice: STAR structure'
      when 'clarity' then 'Practice: clarity' else 'Practice: confidence' end
  else
    case p_criterion when 'content' then 'Luyện tập: nội dung' when 'structure' then 'Luyện tập: cấu trúc STAR'
      when 'clarity' then 'Luyện tập: mạch lạc' else 'Luyện tập: tự tin' end
  end;
$$;

drop function public.start_practice_session(uuid);

-- Security invoker: RLS on practice_questions, interview_sessions and questions
-- still decides what the caller can read and write.
-- p_mode 'single': only this question. p_mode 'all': every saved question of the
-- same report in list order (the page passes the first one).
-- Returns { sessionId, resumed } or { error: 'NOT_FOUND' | 'BAD_INPUT' }.
create function public.start_practice_session(p_practice_question_id uuid, p_mode text default 'single')
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  pq  public.practice_questions%rowtype;
  src public.interview_sessions%rowtype;
  cur public.interview_sessions%rowtype;
  first_q public.practice_questions%rowtype;
  ids uuid[];
  new_id uuid;
begin
  if p_mode is null or p_mode not in ('single', 'all') then
    return jsonb_build_object('error', 'BAD_INPUT');
  end if;
  select * into pq from public.practice_questions
    where id = p_practice_question_id and user_id = (select auth.uid()) for update;
  if not found then return jsonb_build_object('error', 'NOT_FOUND'); end if;

  select * into src from public.interview_sessions where id = pq.session_id;
  if not found then return jsonb_build_object('error', 'NOT_FOUND'); end if;

  -- Pressing the button again while that practice is still open opens it again.
  -- There is no time limit, so an open practice stays open until it is finished or ended.
  if p_mode = 'single' then
    if pq.practice_session_id is not null then
      select * into cur from public.interview_sessions
        where id = pq.practice_session_id and status = 'in_progress' and practice_mode = 'single';
      if found then return jsonb_build_object('sessionId', cur.id, 'resumed', true); end if;
    end if;
    ids := array[pq.id];
  else
    select * into cur from public.interview_sessions
      where practice_source_session_id = src.id and practice_mode = 'all' and status = 'in_progress'
      order by created_at desc limit 1;
    if found then return jsonb_build_object('sessionId', cur.id, 'resumed', true); end if;
    select array_agg(id order by position) into ids
      from public.practice_questions where session_id = src.id;
  end if;

  select * into first_q from public.practice_questions where id = ids[1];

  -- Same settings, JD and CV as the reported interview. duration_minutes keeps a
  -- valid value for the column check, but practice sessions have no time limit:
  -- practice_next_turn() never looks at it and the chat page hides the timer.
  insert into public.interview_sessions (
    fit_analysis_id, title, round_type, difficulty, language, planned_questions,
    jd_text, cv_text, target_position, interview_date, duration_minutes, input_mode,
    started_at, source_practice_question_id,
    practice_mode, practice_question_ids, practice_source_session_id)
  values (
    src.fit_analysis_id, left('Practice: ' || coalesce(src.target_position, src.round_type), 200),
    src.round_type, src.difficulty, first_q.language, cardinality(ids),
    src.jd_text, src.cv_text, src.target_position, null, 15, src.input_mode,
    clock_timestamp(), first_q.id,
    p_mode, ids, src.id)
  returning id into new_id;

  insert into public.questions (session_id, position, kind, topic, content)
    values (new_id, 1, 'main', public.practice_topic(first_q.criterion, first_q.language), first_q.content);

  if p_mode = 'single' then
    update public.practice_questions set practice_session_id = new_id where id = pq.id;
  end if;
  return jsonb_build_object('sessionId', new_id, 'resumed', false);
end;
$$;

revoke all on function public.start_practice_session(uuid, text) from public, anon;
grant execute on function public.start_practice_session(uuid, text) to authenticated;

-- Next turn of a practice session, with the same answers as claim_interview_next
-- in its "ready" form: { kind: 'ready', response: { sessionId, action, question } }.
-- Normal interviews: { kind: 'not_practice' }. Errors: NOT_FOUND, STALE_TURN.
-- Safe to repeat: asking again after the same answer returns the question already saved.
create function public.practice_next_turn(p_session_id uuid, p_after_answer_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  s public.interview_sessions%rowtype;
  q public.questions%rowtype;
  answer_id uuid;
  prev_answer uuid;
  n integer;
  pq public.practice_questions%rowtype;
  saved public.questions%rowtype;
begin
  select * into s from public.interview_sessions
    where id = p_session_id and user_id = (select auth.uid()) for update;
  if not found then return jsonb_build_object('error', 'NOT_FOUND'); end if;
  if s.practice_mode is null then return jsonb_build_object('kind', 'not_practice'); end if;
  if s.status <> 'in_progress' then
    return jsonb_build_object('kind', 'ready', 'response', jsonb_build_object(
      'sessionId', s.id, 'action', 'end', 'question', null));
  end if;

  select * into q from public.questions where session_id = s.id order by position desc limit 1;
  if q.id is not null then
    select id into answer_id from public.answers where question_id = q.id;
    if answer_id is null then
      -- The latest question is still open: show it again (reload, or a repeated request).
      select ans.id into prev_answer from public.questions prev
        join public.answers ans on ans.question_id = prev.id
        where prev.session_id = s.id and prev.position = q.position - 1;
      if p_after_answer_id is distinct from prev_answer then return jsonb_build_object('error', 'STALE_TURN'); end if;
      return jsonb_build_object('kind', 'ready', 'response', jsonb_build_object(
        'sessionId', s.id, 'action', 'next_topic',
        'question', jsonb_build_object('id', q.id, 'content', q.content, 'topic', q.topic, 'kind', q.kind, 'position', q.position)));
    end if;
    if p_after_answer_id is distinct from answer_id then return jsonb_build_object('error', 'STALE_TURN'); end if;
  elsif p_after_answer_id is not null then
    return jsonb_build_object('error', 'STALE_TURN');
  end if;

  n := coalesce(q.position, 0);
  -- Every saved question has been answered: the practice ends (no report for practice).
  if n >= cardinality(s.practice_question_ids) then
    update public.interview_sessions set status = 'completed', ended_at = coalesce(ended_at, clock_timestamp())
      where id = s.id;
    return jsonb_build_object('kind', 'ready', 'response', jsonb_build_object(
      'sessionId', s.id, 'action', 'end', 'question', null));
  end if;

  select * into pq from public.practice_questions where id = s.practice_question_ids[n + 1];
  if not found then
    -- The question was deleted (Settings > delete history): end instead of asking the AI.
    update public.interview_sessions set status = 'completed', ended_at = coalesce(ended_at, clock_timestamp())
      where id = s.id;
    return jsonb_build_object('kind', 'ready', 'response', jsonb_build_object(
      'sessionId', s.id, 'action', 'end', 'question', null));
  end if;

  insert into public.questions (session_id, position, kind, topic, content)
    values (s.id, n + 1, 'main', public.practice_topic(pq.criterion, pq.language), pq.content)
    returning * into saved;
  return jsonb_build_object('kind', 'ready', 'response', jsonb_build_object(
    'sessionId', s.id, 'action', 'next_topic',
    'question', jsonb_build_object('id', saved.id, 'content', saved.content, 'topic', saved.topic,
      'kind', saved.kind, 'position', saved.position)));
end;
$$;

revoke all on function public.practice_next_turn(uuid, uuid) from public, anon;
grant execute on function public.practice_next_turn(uuid, uuid) to authenticated;
revoke all on function public.practice_topic(text, text) from public, anon;
grant execute on function public.practice_topic(text, text) to authenticated;
