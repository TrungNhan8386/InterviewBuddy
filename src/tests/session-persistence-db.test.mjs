// SCRUM-80, SCRUM-81, SCRUM-82: run all migrations on an in-memory PostgreSQL
// (PGlite) with stand-ins for Supabase's auth schema, then check answer saving,
// the daily AI limit and cross-user access (RLS) on the new tables and functions.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readdir, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const A = '00000000-0000-4000-8000-0000000000a1';
const B = '00000000-0000-4000-8000-0000000000b1';
const migrations = new URL('../supabase/migrations/', import.meta.url);
let db;

async function as(userId) {
  await db.exec('reset role');
  if (!userId) return db.exec('set role anon');
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.exec('set role authenticated');
}

async function rows(sql, params = []) {
  return (await db.query(sql, params)).rows;
}

async function call(fn, args) {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(', ');
  return (await rows(`select public.${fn}(${placeholders}) as r`, args))[0].r;
}

const save = (session, question, content, mode = 'text', duration = null) =>
  call('save_interview_answer', [session, question, content, mode, duration]);

async function newSession(owner, { status = 'in_progress' } = {}) {
  await as(owner);
  const id = randomUUID();
  await db.query(`insert into public.interview_sessions (id, user_id, round_type, difficulty, language,
    target_position, duration_minutes, planned_questions, status, jd_text, cv_text)
    values ($1, $2, 'technical', 'medium', 'en', 'Frontend Intern', 15, 5, $3, 'React and REST API.', 'Built a React app.')`,
  [id, owner, status]);
  return id;
}

async function newQuestion(session, position) {
  const id = randomUUID();
  await db.query(`insert into public.questions (id, session_id, position, kind, topic, content)
    values ($1, $2, $3, 'main', 'React', 'Tell me about React.')`, [id, session, position]);
  return id;
}

before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
    -- Supabase grants table privileges to these roles by default; RLS and the
    -- migrations' own revoke statements are what actually protect the data.
    alter default privileges in schema public grant all on tables to anon, authenticated;`);
  const files = (await readdir(migrations)).filter((f) => f.endsWith('.sql')).sort();
  assert.ok(files.includes('20261105000000_session_resume_ai_limit.sql'));
  for (const file of files) await db.exec(await readFile(new URL(file, migrations), 'utf8'));
  await db.query('insert into auth.users (id, email) values ($1, $2), ($3, $4)', [A, 'a@test', B, 'b@test']);
});

test('save_interview_answer saves the current answer once and replays it', async () => {
  const s = await newSession(A);
  const q = await newQuestion(s, 1);
  const first = await save(s, q, '  I built   a React app with hooks. ', 'voice', 12.34);
  assert.equal(first.alreadySaved, false);
  const [stored] = await rows('select content, input_mode, duration_seconds, word_count from public.answers where id = $1', [first.answer.id]);
  assert.deepEqual({ ...stored, duration_seconds: Number(stored.duration_seconds) },
    { content: 'I built   a React app with hooks.', input_mode: 'voice', duration_seconds: 12.3, word_count: 7 });

  const again = await save(s, q, 'A different retry body');
  assert.equal(again.alreadySaved, true);
  assert.equal(again.answer.id, first.answer.id);
});

test('save_interview_answer rejects old questions, closed sessions and bad input', async () => {
  const s = await newSession(A);
  const q1 = await newQuestion(s, 1);
  const q2 = await newQuestion(s, 2);
  assert.deepEqual(await save(s, q1, 'late answer'), { error: 'STALE_TURN' });
  assert.deepEqual(await save(s, q2, '   '), { error: 'BAD_INPUT' });
  assert.deepEqual(await save(s, q2, 'ok', 'video'), { error: 'BAD_INPUT' });
  assert.deepEqual(await save(s, q2, 'ok', 'text', 5000), { error: 'BAD_INPUT' });
  assert.deepEqual(await save(s, randomUUID(), 'ok'), { error: 'NOT_FOUND' });

  const other = await newSession(A);
  assert.deepEqual(await save(other, q2, 'question of another session'), { error: 'NOT_FOUND' });

  const closed = await newSession(A, { status: 'completed' });
  const q = await newQuestion(closed, 1);
  assert.deepEqual(await save(closed, q, 'too late'), { error: 'SESSION_CLOSED' });
});

test('user B cannot read or write user A\'s interview data (SCRUM-82)', async () => {
  const s = await newSession(A);
  const q = await newQuestion(s, 1);
  const { answer } = await save(s, q, 'Answer of A');
  await db.exec('reset role');
  await db.query(`insert into public.interview_next_generations (session_id, turn_key, status, question_id, response)
    values ($1, 'opening', 'completed', $2, '{}')`, [s, q]);

  await as(B);
  for (const [table, column] of [['interview_sessions', 'id'], ['questions', 'session_id'], ['interview_next_generations', 'session_id']]) {
    assert.equal((await rows(`select 1 from public.${table} where ${column} = $1`, [s])).length, 0, table);
  }
  assert.equal((await rows('select 1 from public.answers where id = $1', [answer.id])).length, 0);

  assert.deepEqual(await save(s, q, 'B writes into A'), { error: 'NOT_FOUND' });
  assert.deepEqual(await call('claim_interview_next', [s, null]), { error: 'NOT_FOUND' });
  assert.deepEqual(await call('release_interview_next', [s, null, randomUUID()]), { error: 'NOT_FOUND' });
  assert.deepEqual(await call('finish_interview_next', [s, answer.id, randomUUID(), {}, {}]), { error: 'NOT_FOUND' });

  await assert.rejects(db.query(`insert into public.interview_next_generations (session_id, turn_key, status)
    values ($1, 'x', 'failed')`, [s]), /permission denied/);
  assert.equal((await db.query('update public.answers set content = $1 where id = $2', ['hacked', answer.id])).affectedRows, 0);
  assert.equal((await db.query('delete from public.questions where id = $1', [q])).affectedRows, 0);

  await as(A);
  assert.equal((await rows('select content from public.answers where id = $1', [answer.id]))[0].content, 'Answer of A');
  assert.equal((await rows('select 1 from public.interview_next_generations where session_id = $1', [s])).length, 1);
});

test('consume_ai_call enforces the daily limit per user', async () => {
  await as(A);
  const one = await call('consume_ai_call', [2]);
  const two = await call('consume_ai_call', [2]);
  const three = await call('consume_ai_call', [2]);
  assert.deepEqual([one.allowed, one.used, two.used], [true, 1, 2]);
  assert.deepEqual([three.allowed, three.used, three.limit], [false, 2, 2]);
  assert.ok(Date.parse(three.resetAt) > Date.now());
  assert.deepEqual(await call('consume_ai_call', [0]), { error: 'BAD_INPUT' });

  await as(B);
  assert.equal((await call('consume_ai_call', [2])).used, 1, 'B has a separate count');
  assert.equal((await rows('select user_id from public.ai_usage_daily')).length, 1, 'B sees only its own row');

  await as(A);
  await assert.rejects(db.query('update public.ai_usage_daily set calls = 0'), /permission denied/);
  await assert.rejects(db.query('delete from public.ai_usage_daily'), /permission denied/);
  await assert.rejects(db.query(`insert into public.ai_usage_daily (user_id, usage_date, calls) values ($1, current_date + 1, 0)`, [A]),
    /permission denied/);
  assert.equal((await rows('select calls from public.ai_usage_daily'))[0].calls, 2);
});

test('signed-out callers cannot use the new functions or tables', async () => {
  await as(null);
  await assert.rejects(call('consume_ai_call', [100]), /permission denied/);
  await assert.rejects(save(randomUUID(), randomUUID(), 'x'), /permission denied/);
  await assert.rejects(rows('select * from public.ai_usage_daily'), /permission denied/);
  await assert.rejects(rows('select session_id from public.interview_next_generations'), /permission denied/);
});

test('deleting history removes sessions with their turns but keeps the AI count', async () => {
  const s = await newSession(B);
  const q = await newQuestion(s, 1);
  await save(s, q, 'B answer');
  await call('consume_ai_call', [100]);
  await db.exec('reset role');
  await db.query(`insert into public.interview_next_generations (session_id, turn_key, status) values ($1, 'opening', 'completed')`, [s]);

  // What the Settings page does: delete the user's own rows; RLS limits them to B.
  await as(B);
  await db.query('delete from public.interview_sessions where user_id = $1', [B]);
  await db.query('delete from public.fit_analyses where user_id = $1', [B]);
  await db.exec('reset role');
  for (const table of ['questions', 'interview_next_generations']) {
    assert.equal((await rows(`select 1 from public.${table} where session_id = $1`, [s])).length, 0, table);
  }
  assert.ok((await rows('select calls from public.ai_usage_daily where user_id = $1', [B]))[0].calls >= 1);
  assert.ok((await rows('select 1 from public.interview_sessions where user_id = $1', [A])).length > 0, 'A keeps its data');
});
