-- SCRUM-88: one atomic purge; the account and profile are preserved.
begin;
create or replace function public.delete_own_practice_data()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid(); sessions_deleted bigint; analyses_deleted bigint;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  -- Serialize repeated purge requests for this account.
  perform 1 from public.profiles where id = owner_id for update;
  delete from public.interview_sessions where user_id = owner_id;
  get diagnostics sessions_deleted = row_count;
  -- Cascades remove questions, answers, feedbacks, reports and generation records,
  -- including the CV/JD snapshots stored with sessions.
  delete from public.fit_analyses where user_id = owner_id;
  get diagnostics analyses_deleted = row_count;
  return jsonb_build_object('sessionsDeleted', sessions_deleted, 'analysesDeleted', analyses_deleted);
end;
$$;
revoke all on function public.delete_own_practice_data() from public, anon;
grant execute on function public.delete_own_practice_data() to authenticated;
-- Minimal persistence bridge used by the chat landing page. Lock the session
-- like the next-question engine, reject stale turns, and reuse identical retries.
create or replace function public.save_own_interview_answer(p_session_id uuid, p_question_id uuid, p_content text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare session_row public.interview_sessions%rowtype; latest_question uuid;
  existing public.answers%rowtype; answer_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_content is null or length(btrim(p_content)) = 0 or length(p_content) > 12000 then
    raise exception 'Answer must contain 1 to 12000 characters' using errcode = '22023';
  end if;
  select * into session_row from public.interview_sessions where id = p_session_id and user_id = auth.uid() for update;
  if not found then raise exception 'Session not found' using errcode = '42501'; end if;
  select id into latest_question from public.questions where session_id = p_session_id order by position desc limit 1;
  if latest_question is distinct from p_question_id or session_row.status <> 'in_progress' then
    raise exception 'This turn is no longer active' using errcode = '22023';
  end if;
  select * into existing from public.answers where question_id = p_question_id;
  if found then
    if existing.content = btrim(p_content) then return existing.id; end if;
    raise exception 'This question already has an answer' using errcode = '22023';
  end if;
  insert into public.answers(question_id, content, input_mode, word_count)
    values (p_question_id, btrim(p_content), 'text', cardinality(regexp_split_to_array(btrim(p_content), '\s+')))
    returning id into answer_id;
  return answer_id;
end;
$$;
revoke all on function public.save_own_interview_answer(uuid, uuid, text) from public, anon;
grant execute on function public.save_own_interview_answer(uuid, uuid, text) to authenticated;
commit;
