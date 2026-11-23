-- SCRUM-171. Apply after the existing migrations. No provider calls in SQL.
-- Preserve old feedback rows; technical/HR STAR is now NULL (N/A), never zero.
alter table public.feedbacks alter column structure_score drop not null;
alter table public.feedbacks add column rubric_version text;
alter table public.feedbacks add column prompt_version text;
grant select on public.feedbacks to authenticated;

create table public.answer_feedback_generations (
  answer_id uuid primary key references public.answers(id) on delete cascade,
  token uuid not null,
  status text not null check (status in ('generating', 'failed', 'completed')),
  context_hash text not null,
  expires_at timestamptz not null
);
alter table public.answer_feedback_generations enable row level security;
revoke all on public.answer_feedback_generations from public, anon, authenticated;
-- Only the fixed-path RPCs access reservations. Tokens are not exposed by SELECT.

create function public.read_answer_feedback(p_answer_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare f public.feedbacks%rowtype; qid uuid; sid uuid; generation_status text;
begin
  select q.id, s.id into qid, sid from public.answers a
    join public.questions q on q.id = a.question_id
    join public.interview_sessions s on s.id = q.session_id
    where a.id = p_answer_id and s.user_id = auth.uid();
  if not found then return jsonb_build_object('error', 'NOT_FOUND'); end if;
  select * into f from public.feedbacks where answer_id = p_answer_id;
  if found then
    if f.raw_output->>'schemaVersion' is distinct from 'uc08-feedback-v1' then
      return jsonb_build_object('error', 'FEEDBACK_FORMAT_UNSUPPORTED');
    end if;
    return jsonb_build_object('feedback', f.raw_output || jsonb_build_object(
      'id', f.id, 'answerId', f.answer_id, 'questionId', qid, 'sessionId', sid, 'createdAt', f.created_at),
      'state', 'ready', 'alreadySaved', true);
  end if;
  select case when status = 'generating' and expires_at <= clock_timestamp() then 'failed' else status end
    into generation_status from public.answer_feedback_generations where answer_id = p_answer_id;
  return jsonb_build_object('feedback', null, 'state', coalesce(generation_status, 'not_evaluated'));
end;
$$;

create function public.claim_answer_feedback(p_answer_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.answers%rowtype; q public.questions%rowtype; s public.interview_sessions%rowtype;
  g public.answer_feedback_generations%rowtype; saved jsonb; lease uuid := gen_random_uuid();
begin
  select ans.* into a from public.answers ans
    join public.questions qs on qs.id = ans.question_id
    join public.interview_sessions ss on ss.id = qs.session_id
    where ans.id = p_answer_id and ss.user_id = auth.uid() for update of ans;
  if not found then return jsonb_build_object('error', 'NOT_FOUND'); end if;
  saved := public.read_answer_feedback(p_answer_id);
  if saved ? 'error' then return saved; end if;
  if saved->'feedback' <> 'null'::jsonb then return jsonb_build_object('kind', 'ready', 'response', saved); end if;
  select * into g from public.answer_feedback_generations where answer_id = p_answer_id;
  if g.status = 'generating' and g.expires_at > clock_timestamp() then return jsonb_build_object('kind', 'busy'); end if;
  select * into q from public.questions where id = a.question_id;
  select * into s from public.interview_sessions where id = q.session_id;
  insert into public.answer_feedback_generations(answer_id, token, status, context_hash, expires_at)
    values(a.id, lease, 'generating', md5(jsonb_build_array(a.content,q.content,s.round_type,s.language,s.jd_text)::text), clock_timestamp() + interval '60 seconds')
    on conflict(answer_id) do update set token = excluded.token, status = 'generating',
      context_hash = excluded.context_hash, expires_at = excluded.expires_at;
  return jsonb_build_object('kind', 'claimed', 'token', lease, 'context', jsonb_build_object(
    'answerId', a.id, 'questionId', q.id, 'sessionId', s.id, 'type', s.round_type,
    'language', s.language, 'difficulty', s.difficulty, 'targetPosition', s.target_position,
    'question', q.content, 'answer', a.content, 'jdText', coalesce(s.jd_text, '')));
end;
$$;

create function public.finish_answer_feedback(p_answer_id uuid, p_token uuid, p_feedback jsonb, p_metadata jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.answers%rowtype; q public.questions%rowtype; s public.interview_sessions%rowtype;
  g public.answer_feedback_generations%rowtype; saved jsonb; criterion text; item jsonb; quote jsonb;
begin
  select ans.* into a from public.answers ans
    join public.questions qs on qs.id = ans.question_id
    join public.interview_sessions ss on ss.id = qs.session_id
    where ans.id = p_answer_id and ss.user_id = auth.uid() for update of ans;
  if not found then return jsonb_build_object('error', 'NOT_FOUND'); end if;
  saved := public.read_answer_feedback(p_answer_id);
  if saved ? 'error' then return saved; end if;
  if saved->'feedback' <> 'null'::jsonb then return saved; end if;
  select * into g from public.answer_feedback_generations where answer_id = p_answer_id;
  if g.token is distinct from p_token or g.status <> 'generating' or g.expires_at <= clock_timestamp() then
    return jsonb_build_object('error', 'LEASE_LOST');
  end if;
  select * into q from public.questions where id = a.question_id;
  select * into s from public.interview_sessions where id = q.session_id;
  if g.context_hash is distinct from md5(jsonb_build_array(a.content,q.content,s.round_type,s.language,s.jd_text)::text) then
    return jsonb_build_object('error', 'STALE_ANSWER');
  end if;
  if p_feedback->>'schemaVersion' is distinct from 'uc08-feedback-v1'
      or p_feedback->>'rubricVersion' is distinct from 'uc08-rubric-v1'
      or p_feedback->>'questionType' is distinct from s.round_type
      or p_feedback->>'language' is distinct from s.language
      or p_feedback->>'confidenceBasis' is distinct from 'text_estimated'
      or jsonb_typeof(p_feedback->'overallScore') is distinct from 'number'
      or (p_feedback->>'overallScore')::numeric not between 0 and 10
      or jsonb_typeof(p_feedback->'strengths') is distinct from 'array'
      or jsonb_typeof(p_feedback->'improvements') is distinct from 'array'
      or jsonb_array_length(p_feedback->'improvements') < 1 then
    return jsonb_build_object('error', 'INVALID_OUTPUT');
  end if;
  foreach criterion in array array['content','star','clarity','confidence'] loop
    item := p_feedback->'scores'->criterion;
    if jsonb_typeof(item) is distinct from 'object' or not (item ?& array['score','reason','quotes','applicable']) then
      return jsonb_build_object('error', 'INVALID_OUTPUT');
    end if;
    if criterion = 'star' and s.round_type <> 'behavioral' then
      if item->'score' is distinct from 'null'::jsonb or item->'applicable' is distinct from 'false'::jsonb
          or item->'reason' is distinct from 'null'::jsonb or item->'quotes' is distinct from '[]'::jsonb then
        return jsonb_build_object('error', 'INVALID_OUTPUT');
      end if;
    else
      if jsonb_typeof(item->'score') is distinct from 'number' or (item->>'score')::numeric not between 0 and 10
          or (item->>'score')::numeric <> trunc((item->>'score')::numeric)
          or item->'applicable' is distinct from 'true'::jsonb
          or jsonb_typeof(item->'reason') is distinct from 'string'
          or jsonb_typeof(item->'quotes') is distinct from 'array' then
        return jsonb_build_object('error', 'INVALID_OUTPUT');
      end if;
      if jsonb_array_length(item->'quotes') not between 1 and 3 then return jsonb_build_object('error', 'INVALID_OUTPUT'); end if;
      for quote in select value from jsonb_array_elements(item->'quotes') loop
        if jsonb_typeof(quote) <> 'string' or length(btrim(quote #>> '{}')) = 0 or strpos(a.content, quote #>> '{}') = 0 then
          return jsonb_build_object('error', 'INVALID_OUTPUT');
        end if;
      end loop;
    end if;
  end loop;
  insert into public.feedbacks(answer_id,content_score,structure_score,clarity_score,confidence_score,overall_score,
    explanation,strengths,improvements,sample_answer,model,raw_output,rubric_version,prompt_version)
    values(a.id,(p_feedback#>>'{scores,content,score}')::smallint,(p_feedback#>>'{scores,star,score}')::smallint,
      (p_feedback#>>'{scores,clarity,score}')::smallint,(p_feedback#>>'{scores,confidence,score}')::smallint,
      (p_feedback->>'overallScore')::numeric,
      (p_feedback->'scores')::text,
      array(select jsonb_array_elements_text(p_feedback->'strengths')),
      array(select jsonb_array_elements_text(p_feedback->'improvements')),
      (p_feedback->'outline')::text, left(p_metadata->>'model',100),p_feedback,p_feedback->>'rubricVersion',left(p_metadata->>'promptVersion',100));
  update public.answer_feedback_generations set status = 'completed' where answer_id = a.id;
  return public.read_answer_feedback(a.id) || jsonb_build_object('alreadySaved', false);
exception when invalid_text_representation or numeric_value_out_of_range then
  return jsonb_build_object('error', 'INVALID_OUTPUT');
end;
$$;

create function public.release_answer_feedback(p_answer_id uuid, p_token uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.owns_answer(p_answer_id) then return jsonb_build_object('error', 'NOT_FOUND'); end if;
  update public.answer_feedback_generations set status = 'failed'
    where answer_id = p_answer_id and token = p_token and status = 'generating';
  return '{}'::jsonb;
end;
$$;

revoke all on function public.read_answer_feedback(uuid), public.claim_answer_feedback(uuid),
  public.finish_answer_feedback(uuid,uuid,jsonb,jsonb), public.release_answer_feedback(uuid,uuid) from public, anon;
grant execute on function public.read_answer_feedback(uuid), public.claim_answer_feedback(uuid),
  public.finish_answer_feedback(uuid,uuid,jsonb,jsonb), public.release_answer_feedback(uuid,uuid) to authenticated;
