import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createTestDatabase, USER_A, USER_B } from './interview-next-db.mjs';
import { validOutput } from './feedback-fixtures.mjs';
import { validateFeedback } from '../lib/feedback/contract.mjs';

test('feedback SQL persists validated scores, replays, enforces leases, ownership and nullable STAR', async t => {
  const state = await createTestDatabase(); t.after(() => state.db.close());
  await state.db.exec('reset role');
  await state.db.exec(await readFile(new URL('../supabase/migrations/20261122000000_answer_feedback.sql', import.meta.url), 'utf8'));
  await state.user(USER_A);
  const { createFeedbackRepository } = await import('../lib/feedback/repository.mjs');
  const functions = {
    claim_answer_feedback: ['p_answer_id'], read_answer_feedback: ['p_answer_id'],
    finish_answer_feedback: ['p_answer_id', 'p_token', 'p_feedback', 'p_metadata'],
    release_answer_feedback: ['p_answer_id', 'p_token'],
  };
  const repository = createFeedbackRepository({ rpc: async (name, args) => {
    assert.ok(functions[name], `Unexpected RPC: ${name}`);
    try {
      const params = functions[name].map(key => args[key]);
      const result = await state.db.query(`select public.${name}(${params.map((_, i) => '$' + (i + 1)).join(',')}) as result`, params);
      return { data: result.rows[0].result, error: null };
    } catch (error) { return { data: null, error }; }
  } });
  const sessionId = await state.session({ type: 'technical', language: 'en' });
  const questionId = randomUUID();
  await state.db.query('insert into public.questions(id, session_id, position, content) values($1,$2,1,$3)', [questionId, sessionId, 'How do you validate a React form?']);
  const answerId = await state.answer(questionId, 'Our release was late. I owned the React form. I added validation and tests. We shipped the next day.');
  assert.deepEqual(await repository.read(answerId), { feedback: null, state: 'not_evaluated' });
  const claim = await repository.claim(answerId);
  assert.equal(claim.kind, 'claimed'); assert.equal(claim.context.type, 'technical');
  assert.equal((await repository.claim(answerId)).kind, 'busy');
  const feedback = validateFeedback(validOutput('technical'), claim.context);
  await assert.rejects(repository.finish(answerId, randomUUID(), feedback, {}), { code: 'LEASE_LOST' });
  const bad = structuredClone(feedback); bad.scores.content.quotes = ['invented SQL quote'];
  await assert.rejects(repository.finish(answerId, claim.token, bad, {}), { code: 'INVALID_OUTPUT' });
  await state.user(USER_B);
  await assert.rejects(repository.read(answerId), { code: 'NOT_FOUND' });
  await assert.rejects(repository.claim(answerId), { code: 'NOT_FOUND' });
  await assert.rejects(repository.finish(answerId, claim.token, feedback, {}), { code: 'NOT_FOUND' });
  await state.user(USER_A);
  const saved = await repository.finish(answerId, claim.token, feedback, { model: 'test-model', promptVersion: 'test-v1' });
  assert.equal(saved.feedback.overallScore, 6.7); assert.equal(saved.alreadySaved, false);
  assert.equal(saved.feedback.answerId, answerId);
  assert.equal((await repository.claim(answerId)).kind, 'ready');
  assert.equal((await repository.read(answerId)).feedback.id, saved.feedback.id);
  await state.db.exec('reset role');
  const row = (await state.db.query('select * from public.feedbacks where answer_id=$1', [answerId])).rows[0];
  assert.equal(row.structure_score, null); assert.equal(row.content_score, 8);
  assert.equal(row.next_action, null); assert.equal(row.rubric_version, 'uc08-rubric-v1');
  assert.equal(row.raw_output.scores.content.quotes[0], 'I added validation and tests.');
  assert.equal(Number((await state.db.query('select count(*) as count from public.feedbacks')).rows[0].count), 1);
  await state.user(USER_B);
  assert.equal((await state.db.query('select * from public.feedbacks')).rows.length, 0);
});

test('expired feedback claims cannot save, are reclaimable, and release keeps saved answers', async t => {
  const state = await createTestDatabase(); t.after(() => state.db.close());
  await state.db.exec('reset role');
  await state.db.exec(await readFile(new URL('../supabase/migrations/20261122000000_answer_feedback.sql', import.meta.url), 'utf8'));
  await state.user();
  const sessionId = await state.session(); const questionId = randomUUID();
  await state.db.query('insert into public.questions(id,session_id,position,content) values($1,$2,1,$3)', [questionId, sessionId, 'Describe your test.']);
  const answerId = await state.answer(questionId);
  const rpc = async (name, args) => (await state.db.query(`select public.${name}(${args.map((_, i) => '$'+(i+1)).join(',')}) as r`, args)).rows[0].r;
  const first = await rpc('claim_answer_feedback', [answerId]);
  await state.db.exec('reset role');
  await state.db.query("update public.answer_feedback_generations set expires_at = now() - interval '1 second' where answer_id=$1", [answerId]);
  await state.user();
  assert.equal((await rpc('read_answer_feedback', [answerId])).state, 'failed');
  assert.equal((await rpc('finish_answer_feedback', [answerId, first.token, {}, {}])).error, 'LEASE_LOST');
  const second = await rpc('claim_answer_feedback', [answerId]);
  assert.notEqual(first.token, second.token);
  await rpc('release_answer_feedback', [answerId, first.token]);
  assert.equal((await rpc('claim_answer_feedback', [answerId])).kind, 'busy');
  await rpc('release_answer_feedback', [answerId, second.token]);
  assert.equal((await rpc('read_answer_feedback', [answerId])).state, 'failed');
  assert.equal((await state.db.query('select content from public.answers where id=$1', [answerId])).rows.length, 1);
  await state.db.query('delete from public.interview_sessions where id=$1', [sessionId]);
  await state.db.exec('reset role');
  assert.equal((await state.db.query('select * from public.answer_feedback_generations')).rows.length, 0);
});
