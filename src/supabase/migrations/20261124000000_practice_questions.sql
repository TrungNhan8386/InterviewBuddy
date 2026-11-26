-- InterviewBuddy – UC-10 Practice targeted questions (SCRUM-178, SCRUM-204). Owner: Khang.
-- Apply after 20261122000000_answer_feedback.sql:
-- Supabase dashboard > SQL Editor > New query > paste this file > Run.
--
-- 1. practice_questions: the questions generated for the two weakest criteria
--    of a completed session (POST /api/practice/generate). One set per session.
-- 2. interview_sessions.source_practice_question_id: marks a session that was
--    started from a practice question, so History (UC-11) can label it.
-- 3. start_practice_session(): creates that session with the chosen question as
--    its first question, so the existing chat page (/interview/[id]) can open it.
-- Contract: docs/api/PRACTICE_API_v1.md

create table public.practice_questions (
  id                  uuid primary key default gen_random_uuid(),
  session_id          uuid not null references public.interview_sessions (id) on delete cascade,
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  criterion           text not null check (criterion in ('content', 'structure', 'clarity', 'confidence')),
  -- Average score of the criterion in the report when the set was generated.
  criterion_score     numeric(4, 1) check (criterion_score between 0 and 10),
  position            smallint not null check (position between 1 and 10),
  content             text not null check (char_length(btrim(content)) between 1 and 600),
  tip                 text check (tip is null or char_length(tip) <= 300),
  language            text not null check (language in ('vi', 'en')),
  model               text,
  prompt_version      text,
  -- Latest practice session started from this question (null = not started yet).
  practice_session_id uuid references public.interview_sessions (id) on delete set null,
  created_at          timestamptz not null default now(),
  unique (session_id, position)
);

create index practice_questions_user_id_idx on public.practice_questions (user_id, created_at desc);
create index practice_questions_practice_session_id_idx on public.practice_questions (practice_session_id);

alter table public.practice_questions enable row level security;

create policy "practice_questions: own rows" on public.practice_questions
  for all to authenticated
  using (user_id = (select auth.uid()) and public.owns_session(session_id))
  with check (user_id = (select auth.uid()) and public.owns_session(session_id));

revoke all on public.practice_questions from public, anon;
grant select, insert on public.practice_questions to authenticated;
-- practice_session_id is only changed by start_practice_session().
grant update (practice_session_id) on public.practice_questions to authenticated;

alter table public.interview_sessions
  add column source_practice_question_id uuid references public.practice_questions (id) on delete set null;

comment on column public.interview_sessions.source_practice_question_id is
  'Set when the session was started from a targeted practice question (UC-10). Null for normal interviews.';

-- Security invoker: RLS on practice_questions, interview_sessions and questions
-- still decides what the caller can read and write.
-- Returns { sessionId, resumed } or { error: 'NOT_FOUND' }.
create function public.start_practice_session(p_practice_question_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  pq  public.practice_questions%rowtype;
  src public.interview_sessions%rowtype;
  cur public.interview_sessions%rowtype;
  new_id uuid;
begin
  select * into pq from public.practice_questions
    where id = p_practice_question_id and user_id = (select auth.uid()) for update;
  if not found then return jsonb_build_object('error', 'NOT_FOUND'); end if;

  -- Pressing the button again while that practice is still running opens it again.
  if pq.practice_session_id is not null then
    select * into cur from public.interview_sessions where id = pq.practice_session_id;
    if found and cur.status = 'in_progress'
        and clock_timestamp() < cur.started_at + make_interval(mins => cur.duration_minutes) then
      return jsonb_build_object('sessionId', cur.id, 'resumed', true);
    end if;
  end if;

  select * into src from public.interview_sessions where id = pq.session_id;
  if not found then return jsonb_build_object('error', 'NOT_FOUND'); end if;

  -- Same settings, JD and CV as the reported interview; short session
  -- (15 minutes, the practice question plus up to 2 more main questions).
  insert into public.interview_sessions (
    fit_analysis_id, title, round_type, difficulty, language, planned_questions,
    jd_text, cv_text, target_position, interview_date, duration_minutes, input_mode,
    started_at, source_practice_question_id)
  values (
    src.fit_analysis_id, left('Practice: ' || coalesce(src.target_position, src.round_type), 200),
    src.round_type, src.difficulty, pq.language, 3,
    src.jd_text, src.cv_text, src.target_position, null, 15, src.input_mode,
    clock_timestamp(), pq.id)
  returning id into new_id;

  -- Stored as a main question so the interview engine continues normally
  -- (follow-ups need a main parent with the same topic).
  insert into public.questions (session_id, position, kind, topic, content)
    values (new_id, 1, 'main',
      case when pq.language = 'en' then
        case pq.criterion when 'content' then 'Practice: content' when 'structure' then 'Practice: STAR structure'
          when 'clarity' then 'Practice: clarity' else 'Practice: confidence' end
      else
        case pq.criterion when 'content' then 'Luyện tập: nội dung' when 'structure' then 'Luyện tập: cấu trúc STAR'
          when 'clarity' then 'Luyện tập: mạch lạc' else 'Luyện tập: tự tin' end
      end,
      pq.content);

  update public.practice_questions set practice_session_id = new_id where id = pq.id;
  return jsonb_build_object('sessionId', new_id, 'resumed', false);
end;
$$;

revoke all on function public.start_practice_session(uuid) from public, anon;
grant execute on function public.start_practice_session(uuid) to authenticated;
