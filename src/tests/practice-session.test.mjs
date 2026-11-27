// UC-10 practice sessions follow the saved questions (SCRUM-205, test cases UC10-02 and UC10-03).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPracticeRepository } from '../lib/practice/practice-service.mjs';
import { withPracticeTurns } from '../lib/practice/practice-turns.mjs';
import { createTestDatabase, USER_A, USER_B } from './interview-next-db.mjs';

const MIGRATIONS = ['20261124000000_practice_questions.sql', '20261127000000_practice_session_mode.sql'];

async function setup(t) {
  const state = await createTestDatabase();
  t.after(() => state.db.close());
  await state.db.exec('reset role');
  for (const file of MIGRATIONS) {
    await state.db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  }
  await state.user(USER_A);
  const sourceId = await state.session({ type: 'behavioral', language: 'en' });
  await state.db.query("update public.interview_sessions set status='completed', ended_at=now() where id=$1", [sourceId]);
  const ids = [];
  for (const [pos, criterion] of [[1, 'clarity'], [2, 'clarity'], [3, 'clarity'], [4, 'confidence'], [5, 'confidence'], [6, 'confidence']]) {
    const r = await state.db.query(`insert into public.practice_questions(session_id, criterion, criterion_score, position, content, tip, language)
      values($1,$2,5,$3,$4,'Tip','en') returning id`, [sourceId, criterion, pos, `Saved question ${pos} (${criterion})?`]);
    ids.push(r.rows[0].id);
  }
  // Supabase-like client: rpc() runs the SQL function with named arguments.
  const supabase = {
    rpc: async (name, args) => {
      const keys = Object.keys(args);
      const sql = `select public.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(',')}) as r`;
      try {
        return { data: (await state.db.query(sql, keys.map((k) => args[k]))).rows[0].r, error: null };
      } catch (error) { return { data: null, error }; }
    },
  };
  let baseClaims = 0;
  const base = { ...state.repository, claim: async (request) => { baseClaims += 1; return state.repository.claim(request); } };
  const repo = withPracticeTurns(base, supabase);
  const questions = async (sessionId) => (await state.db.query(
    'select * from public.questions where session_id=$1 order by position', [sessionId])).rows;
  const session = async (sessionId) => (await state.db.query(
    'select * from public.interview_sessions where id=$1', [sessionId])).rows[0];
  return { state, sourceId, ids, supabase, repo, questions, session, baseClaims: () => baseClaims };
}

test('UC10-02: "Practice this question" has only that question, then ends without the AI', async (t) => {
  const { state, sourceId, ids, supabase, repo, questions, session, baseClaims } = await setup(t);
  const practice = createPracticeRepository(supabase);
  const started = await practice.start(ids[4]); // question 5 (confidence)
  assert.equal(started.resumed, false);

  const s = await session(started.sessionId);
  assert.equal(s.practice_mode, 'single');
  assert.deepEqual(s.practice_question_ids, [ids[4]]);
  assert.equal(s.practice_source_session_id, sourceId);
  assert.equal(s.planned_questions, 1);
  const [q1] = await questions(started.sessionId);
  assert.equal(q1.content, 'Saved question 5 (confidence)?');
  assert.equal(q1.topic, 'Practice: confidence');

  // Reload before answering: the same question again.
  const again = await repo.claim({ sessionId: started.sessionId, afterAnswerId: null });
  assert.equal(again.response.question.id, q1.id);
  // Pressing the button again opens the same open session.
  assert.deepEqual(await practice.start(ids[4]), { sessionId: started.sessionId, resumed: true });

  const answerId = await state.answer(q1.id, 'I would state my result first and keep a steady tone.');
  const next = await repo.claim({ sessionId: started.sessionId, afterAnswerId: answerId });
  assert.deepEqual(next.response, { sessionId: started.sessionId, action: 'end', question: null });
  assert.equal((await questions(started.sessionId)).length, 1);
  assert.equal((await session(started.sessionId)).status, 'completed');
  // Repeating the request is safe, and the AI engine was never asked.
  const replay = await repo.claim({ sessionId: started.sessionId, afterAnswerId: answerId });
  assert.equal(replay.response.action, 'end');
  assert.equal(baseClaims(), 0);
  // No time limit: a practice opened 2 hours ago is still open and still resumed.
  const late = await practice.start(ids[0]);
  await state.db.exec('reset role');
  await state.db.query("update public.interview_sessions set started_at = now() - interval '2 hours' where id=$1", [late.sessionId]);
  await state.user(USER_A);
  assert.deepEqual(await practice.start(ids[0]), { sessionId: late.sessionId, resumed: true });
  const [lateQ] = await questions(late.sessionId);
  const lateAnswer = await state.answer(lateQ.id, 'Late answer.');
  assert.equal((await repo.claim({ sessionId: late.sessionId, afterAnswerId: lateAnswer })).response.action, 'end');
  assert.equal(baseClaims(), 0);
});

test('UC10-03: "Start practice session" asks every saved question in list order, no AI', async (t) => {
  const { state, ids, supabase, repo, questions, session, baseClaims } = await setup(t);
  const practice = createPracticeRepository(supabase);
  const started = await practice.start(ids[0], 'all');
  const s = await session(started.sessionId);
  assert.equal(s.practice_mode, 'all');
  assert.deepEqual(s.practice_question_ids, ids);
  assert.equal(s.planned_questions, 6);
  assert.deepEqual(await practice.start(ids[0], 'all'), { sessionId: started.sessionId, resumed: true });

  let after = null;
  for (let n = 1; n <= 6; n += 1) {
    const turn = await repo.claim({ sessionId: started.sessionId, afterAnswerId: after });
    assert.equal(turn.response.action, 'next_topic');
    assert.equal(turn.response.question.position, n);
    assert.equal(turn.response.question.content, `Saved question ${n} (${n <= 3 ? 'clarity' : 'confidence'})?`);
    assert.equal(turn.response.question.kind, 'main');
    // A request for an older turn is refused instead of skipping a question.
    if (after) await assert.rejects(repo.claim({ sessionId: started.sessionId, afterAnswerId: null }), { code: 'STALE_TURN' });
    after = await state.answer(turn.response.question.id, `Answer ${n} with a clear result.`);
  }
  const end = await repo.claim({ sessionId: started.sessionId, afterAnswerId: after });
  assert.equal(end.response.action, 'end');
  assert.equal((await questions(started.sessionId)).length, 6);
  assert.equal((await session(started.sessionId)).status, 'completed');
  assert.equal(baseClaims(), 0);
  // A finished "all" session is not reopened: the button starts a new one.
  assert.equal((await practice.start(ids[0], 'all')).resumed, false);
  // "Practice this question" on question 1 is a separate one-question session.
  const single = await practice.start(ids[0]);
  assert.equal((await session(single.sessionId)).practice_mode, 'single');
});

test('practice turns: normal interviews still use the AI engine; other users and bad input are refused', async (t) => {
  const { state, ids, supabase, repo } = await setup(t);
  const normal = await state.session();
  const claim = await repo.claim({ sessionId: normal, afterAnswerId: null });
  assert.equal(claim.kind, 'claimed'); // handed to the AI engine as before

  const practice = createPracticeRepository(supabase);
  await assert.rejects(practice.start(ids[0], 'everything'), { code: 'BAD_INPUT' });
  const started = await practice.start(ids[0]);
  await state.user(USER_B);
  await assert.rejects(repo.claim({ sessionId: started.sessionId, afterAnswerId: null }), { code: 'NOT_FOUND' });
  await assert.rejects(practice.start(ids[0], 'all'), { code: 'NOT_FOUND' });
});

test('practice turns fall back to the normal claim before the migration is applied', async () => {
  let claimed = 0;
  const base = { claim: async () => { claimed += 1; return { kind: 'claimed' }; }, finish: async () => ({}) };
  const missing = { rpc: async () => ({ data: null, error: { code: 'PGRST202' } }) };
  assert.deepEqual(await withPracticeTurns(base, missing).claim({ sessionId: 'x', afterAnswerId: null }), { kind: 'claimed' });
  assert.equal(claimed, 1);
  assert.equal(typeof withPracticeTurns(base, missing).finish, 'function');
  const broken = { rpc: async () => ({ data: null, error: { code: 'XX000' } }) };
  await assert.rejects(withPracticeTurns(base, broken).claim({ sessionId: 'x', afterAnswerId: null }), { code: 'SERVER_ERROR' });
  // "Practice this question" sends only the question id, so it also works with the first migration.
  const calls = [];
  const rpc = { rpc: async (name, args) => { calls.push(args); return { data: { sessionId: 's', resumed: false }, error: null }; } };
  await createPracticeRepository(rpc).start('q1');
  await createPracticeRepository(rpc).start('q1', 'all');
  assert.deepEqual(calls, [{ p_practice_question_id: 'q1' }, { p_practice_question_id: 'q1', p_mode: 'all' }]);
});
