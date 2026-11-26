// UC-10 Practice targeted questions (SCRUM-178, SCRUM-204). No network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import {
  PRACTICE_SCHEMA, buildPracticeInput, noMajorWeakness, pickWeakCriteria,
  toPracticeResponse, toPracticeRows, validatePracticeOutput,
} from '../lib/practice/practice-builder.mjs';
import { PracticeAiError, buildPracticeRequest, createPracticeProvider } from '../lib/practice/practice-provider.mjs';
import { PracticeError, createPracticeRepository, createPracticeService } from '../lib/practice/practice-service.mjs';
import { AiLimitError } from '../lib/ai/daily-limit.mjs';
import { createTestDatabase, USER_A, USER_B } from './interview-next-db.mjs';

const SESSION_ID = '00000000-0000-4000-8000-0000000000a1';
const session = (over = {}) => ({
  id: SESSION_ID, status: 'completed', round_type: 'behavioral', difficulty: 'medium', language: 'vi',
  target_position: 'Frontend Intern', started_at: '2026-11-20T10:00:00.000Z', ended_at: '2026-11-20T10:15:00.000Z', ...over,
});
const scored = (position, scores, improvements = ['Nêu kết quả bằng con số.']) => ({
  id: `q${position}`, position, kind: 'main', topic: 'Teamwork', content: `Câu hỏi số ${position}?`, created_at: '2026-11-20T10:01:00.000Z',
  answers: [{ id: `a${position}`, content: 'Em đã làm việc nhóm.', word_count: 5, duration_seconds: null,
    feedbacks: [{ content_score: scores[0], structure_score: scores[1], clarity_score: scores[2], confidence_score: scores[3],
      overall_score: (scores.filter((s) => s !== null).reduce((a, b) => a + b, 0) / scores.filter((s) => s !== null).length), strengths: [], improvements }] }],
});
const questions3 = (criterion, n = 3) => Array.from({ length: n }, (_, i) => ({ question: `${criterion} practice question ${i + 1}?`, tip: 'Show a specific result.' }));
const output = (focus, n = 3) => ({ groups: focus.map((f) => ({ criterion: f.criterion, questions: questions3(f.criterion, n) })) });

test('pickWeakCriteria takes the two lowest scored criteria, skips null STAR and breaks ties in fixed order', () => {
  assert.deepEqual(pickWeakCriteria({ content: 7, structure: 5, clarity: 6, confidence: 8 }),
    [{ criterion: 'structure', score: 5 }, { criterion: 'clarity', score: 6 }]);
  assert.deepEqual(pickWeakCriteria({ content: 6, structure: null, clarity: 6, confidence: 6 }),
    [{ criterion: 'content', score: 6 }, { criterion: 'clarity', score: 6 }]);
  assert.deepEqual(pickWeakCriteria({ content: 6.66, structure: null, clarity: null, confidence: null }), []);
  assert.deepEqual(pickWeakCriteria(null), []);
  assert.equal(noMajorWeakness([{ criterion: 'content', score: 8 }, { criterion: 'clarity', score: 7.5 }]), true);
  assert.equal(noMajorWeakness([{ criterion: 'content', score: 8 }, { criterion: 'clarity', score: 7.4 }]), false);
});

test('buildPracticeInput is bounded and has no CV, JD or answers', () => {
  const rows = [scored(2, [6, 5, 7, 8]), scored(1, [7, 6, 7, 8])];
  const input = buildPracticeInput({ ...session(), jd_text: 'SECRET JD', cv_text: 'SECRET CV' }, [{ criterion: 'structure', score: 5.5 }], rows);
  assert.deepEqual(input.askedQuestions, ['Câu hỏi số 1?', 'Câu hỏi số 2?']);
  assert.equal(input.language, 'vi');
  assert.equal(JSON.stringify(input).includes('SECRET'), false);
  assert.equal(JSON.stringify(input).includes('Em đã làm việc nhóm'), false);
  const request = buildPracticeRequest({ ...input, language: 'en' });
  assert.match(request.systemInstruction.parts[0].text, /Write every question and tip in English\./);
  assert.deepEqual(request.generationConfig.responseJsonSchema, PRACTICE_SCHEMA);
});

test('validatePracticeOutput enforces focus order, 3-5 questions, lengths and drops duplicates', () => {
  const focus = [{ criterion: 'clarity', score: 5 }, { criterion: 'confidence', score: 6 }];
  assert.equal(validatePracticeOutput(output(focus), focus).length, 2);
  assert.equal(validatePracticeOutput(output(focus, 6), focus)[0].questions.length, 5);
  assert.equal(validatePracticeOutput(output([...focus].reverse()), focus), null);
  assert.equal(validatePracticeOutput({ ...output(focus), extra: 1 }, focus), null);
  const long = output(focus); long.groups[0].questions[0].question = 'x'.repeat(301);
  assert.equal(validatePracticeOutput(long, focus), null);
  // A repeated question (also one already asked in the interview) is dropped, leaving fewer than 3.
  assert.equal(validatePracticeOutput(output(focus), focus, ['Clarity practice question 1?']), null);
  const dup = output(focus, 4); dup.groups[1].questions[0].question = dup.groups[0].questions[0].question;
  assert.equal(validatePracticeOutput(dup, focus)[1].questions.length, 3);
});

test('toPracticeRows and toPracticeResponse keep positions, groups and the AF3 note', () => {
  const focus = [{ criterion: 'clarity', score: 8 }, { criterion: 'confidence', score: 9 }];
  const rows = toPracticeRows(SESSION_ID, 'en', focus, validatePracticeOutput(output(focus), focus), { model: 'm' });
  assert.deepEqual(rows.map((r) => r.position), [1, 2, 3, 4, 5, 6]);
  assert.equal(rows[3].criterion, 'confidence'); assert.equal(rows[0].prompt_version, 'practice-questions-1');
  const response = toPracticeResponse(SESSION_ID, rows.map((r, i) => ({ ...r, id: `p${i}`, created_at: 'now' })).reverse());
  assert.deepEqual(response.groups.map((g) => [g.criterion, g.score, g.questions.length]), [['clarity', 8, 3], ['confidence', 9, 3]]);
  assert.equal(response.groups[0].questions[0].id, 'p0');
  assert.equal(response.noMajorWeakness, true); assert.equal(response.language, 'en');
});

function fakeGemini(body, status = 200) {
  return async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
const envelope = (value, finishReason = 'STOP') => ({ candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(value) }] } }] });

test('provider validates Gemini output and maps errors without forwarding provider text', async () => {
  const focus = [{ criterion: 'content', score: 4 }, { criterion: 'clarity', score: 5 }];
  const input = { language: 'vi', focus, askedQuestions: [] };
  const env = { GEMINI_API_KEY: 'test-key' };
  const groups = await createPracticeProvider({ env, fetchImpl: fakeGemini(envelope(output(focus))) }).generate(input);
  assert.equal(groups[0].questions.length, 3);
  const codeOf = async (fetchImpl, e = env) => {
    try { await createPracticeProvider({ env: e, fetchImpl }).generate(input); } catch (error) { assert.ok(error instanceof PracticeAiError); return error.code; }
    return 'no error';
  };
  assert.equal(await codeOf(fakeGemini({}), {}), 'AI_NOT_CONFIGURED');
  assert.equal(await codeOf(fakeGemini({ error: 'busy' }, 429)), 'AI_RATE_LIMITED');
  assert.equal(await codeOf(fakeGemini({ error: 'bad key' }, 403)), 'AI_CONFIGURATION_ERROR');
  assert.equal(await codeOf(fakeGemini({}, 500)), 'AI_UNAVAILABLE');
  assert.equal(await codeOf(fakeGemini(envelope(output(focus), 'SAFETY'))), 'AI_CONTENT_BLOCKED');
  assert.equal(await codeOf(fakeGemini(envelope(output(focus), 'MAX_TOKENS'))), 'INVALID_OUTPUT');
  assert.equal(await codeOf(fakeGemini(envelope({ groups: [] }))), 'INVALID_OUTPUT');
  const unsafe = output(focus); unsafe.groups[0].questions[0].question = 'How old are you?';
  assert.equal(await codeOf(fakeGemini(envelope(unsafe))), 'INVALID_OUTPUT');
  assert.equal(await codeOf(async () => { throw new TypeError('network'); }), 'AI_UNAVAILABLE');
});

function memoryRepository({ sessionRow = session(), questionRows = [scored(1, [7, 5, 6, 8]), scored(2, [8, 4, 6, 9])], saved = [] } = {}) {
  const state = { saved: [...saved], inserts: 0 };
  return {
    state,
    async session(id) { return id === SESSION_ID ? sessionRow : null; },
    async questions() { return questionRows; },
    async saved() { return state.saved; },
    async insert(rows) { state.inserts += 1; state.saved = rows.map((r, i) => ({ ...r, id: `p${i + 1}`, practice_session_id: null, created_at: '2026-11-24T00:00:00.000Z' })); return state.saved; },
    async start() { return { sessionId: 's-new', resumed: false }; },
  };
}

test('service generates once for the two weakest criteria and then reuses the saved set', async () => {
  const repository = memoryRepository();
  let calls = 0; let consumed = 0; let seenInput;
  const provider = { model: 'test-model', async generate(input) { calls += 1; seenInput = input; return validatePracticeOutput(output(input.focus), input.focus); } };
  const service = createPracticeService({ repository, provider, consume: async () => { consumed += 1; } });
  assert.deepEqual(await service.read(SESSION_ID), { sessionId: SESSION_ID, state: 'not_generated', groups: [] });
  const first = await service.generate(SESSION_ID);
  assert.equal(first.alreadySaved, false); assert.equal(first.state, 'ready');
  assert.deepEqual(seenInput.focus, [{ criterion: 'structure', score: 4.5 }, { criterion: 'clarity', score: 6 }]);
  assert.deepEqual(first.groups.map((g) => g.criterion), ['structure', 'clarity']);
  const again = await service.generate(SESSION_ID);
  assert.equal(again.alreadySaved, true); assert.equal(calls, 1); assert.equal(consumed, 1);
  assert.equal((await service.read(SESSION_ID)).groups[0].questions.length, 3);
  assert.equal(repository.state.saved[0].model, 'test-model');
});

test('service errors: not found, not completed, no scores, daily limit and AI failure save nothing', async () => {
  const provider = { model: 'm', async generate(input) { return validatePracticeOutput(output(input.focus), input.focus); } };
  const ok = async () => {};
  const codeOf = async (promise) => { try { await promise; } catch (e) { assert.ok(e instanceof PracticeError); return [e.code, e.status]; } return 'no error'; };
  let service = createPracticeService({ repository: memoryRepository(), provider, consume: ok });
  assert.deepEqual(await codeOf(service.generate('00000000-0000-4000-8000-0000000000ff')), ['NOT_FOUND', 404]);
  service = createPracticeService({ repository: memoryRepository({ sessionRow: session({ status: 'in_progress' }) }), provider, consume: ok });
  assert.deepEqual(await codeOf(service.generate(SESSION_ID)), ['SESSION_NOT_COMPLETED', 409]);
  const unscored = [{ ...scored(1, [7, 5, 6, 8]), answers: [{ id: 'a', content: 'x', feedbacks: [] }] }];
  service = createPracticeService({ repository: memoryRepository({ questionRows: unscored }), provider, consume: ok });
  assert.deepEqual(await codeOf(service.generate(SESSION_ID)), ['NOT_ENOUGH_SCORES', 409]);
  const limited = memoryRepository();
  service = createPracticeService({ repository: limited, provider, consume: async () => { throw new AiLimitError('AI_DAILY_LIMIT', { resetAt: '2026-11-25T00:00:00+07:00' }); } });
  await assert.rejects(service.generate(SESSION_ID), (e) => e.code === 'AI_DAILY_LIMIT' && e.status === 429 && e.details.resetAt.startsWith('2026-11-25'));
  assert.equal(limited.state.inserts, 0);
  const failing = memoryRepository();
  service = createPracticeService({ repository: failing, provider: { model: 'm', async generate() { throw new PracticeAiError('AI_TIMEOUT'); } }, consume: ok });
  assert.deepEqual(await codeOf(service.generate(SESSION_ID)), ['AI_TIMEOUT', 503]);
  assert.equal(failing.state.inserts, 0);
});

test('repository reports DATABASE_NOT_READY when the migration is missing', async () => {
  const missing = { from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: null, error: { code: 'PGRST205' } }) }) }) }) };
  await assert.rejects(createPracticeRepository(missing).saved(SESSION_ID), { code: 'DATABASE_NOT_READY' });
  const noRpc = { rpc: async () => ({ data: null, error: { code: 'PGRST202' } }) };
  await assert.rejects(createPracticeRepository(noRpc).start(SESSION_ID), { code: 'DATABASE_NOT_READY' });
});

test('practice SQL: RLS per user, start_practice_session creates a resumable chat session', async (t) => {
  const state = await createTestDatabase(); t.after(() => state.db.close());
  await state.db.exec('reset role');
  await state.db.exec(await readFile(new URL('../supabase/migrations/20261124000000_practice_questions.sql', import.meta.url), 'utf8'));
  await state.user(USER_A);
  const sourceId = await state.session({ type: 'behavioral', language: 'en' });
  await state.db.query("update public.interview_sessions set status='completed', ended_at=now() where id=$1", [sourceId]);
  const insert = (pos, criterion) => state.db.query(`insert into public.practice_questions(session_id, criterion, criterion_score, position, content, tip, language)
    values($1,$2,5,$3,$4,'Tip','en') returning id`, [sourceId, criterion, pos, `Tell me about a time you ${criterion} #${pos}?`]);
  const p1 = (await insert(1, 'structure')).rows[0].id;
  await insert(2, 'structure');
  await assert.rejects(insert(2, 'clarity'), /duplicate key/);

  const start = async (id) => (await state.db.query('select public.start_practice_session($1) as r', [id])).rows[0].r;
  const first = await start(p1);
  assert.equal(first.resumed, false);
  const created = (await state.db.query('select * from public.interview_sessions where id=$1', [first.sessionId])).rows[0];
  assert.equal(created.status, 'in_progress'); assert.equal(created.round_type, 'behavioral'); assert.equal(created.language, 'en');
  assert.equal(created.duration_minutes, 15); assert.equal(created.planned_questions, 3);
  assert.equal(created.source_practice_question_id, p1); assert.equal(created.jd_text.length > 0, true);
  const q = (await state.db.query('select * from public.questions where session_id=$1', [first.sessionId])).rows;
  assert.equal(q.length, 1); assert.equal(q[0].kind, 'main'); assert.equal(q[0].position, 1);
  assert.equal(q[0].topic, 'Practice: STAR structure'); assert.match(q[0].content, /structure #1/);
  // Pressing again while it runs opens the same session; after it ends a new one is created.
  assert.deepEqual(await start(p1), { sessionId: first.sessionId, resumed: true });
  // The interview engine accepts the session: resume shows question 1, and after
  // the answer the next turn can be claimed as in a normal interview.
  const resume = await state.repository.claim({ sessionId: first.sessionId, afterAnswerId: null });
  assert.equal(resume.kind, 'ready'); assert.equal(resume.response.question.id, q[0].id);
  const answerId = await state.answer(q[0].id, 'In my last project I owned the release plan.');
  const claim = await state.repository.claim({ sessionId: first.sessionId, afterAnswerId: answerId });
  assert.equal(claim.kind, 'claimed'); assert.equal(claim.questions.length, 1);
  await state.db.query("update public.interview_sessions set status='completed' where id=$1", [first.sessionId]);
  const second = await start(p1);
  assert.equal(second.resumed, false); assert.notEqual(second.sessionId, first.sessionId);

  // User B can neither read the questions nor start a session from them.
  await state.user(USER_B);
  assert.equal((await state.db.query('select * from public.practice_questions')).rows.length, 0);
  assert.deepEqual(await start(p1), { error: 'NOT_FOUND' });
  await assert.rejects(state.db.query(`insert into public.practice_questions(session_id, criterion, position, content, language)
    values($1,'content',9,'Q?','en')`, [sourceId]), /row-level security/);
  // Deleting the source session removes its practice questions (UC-17).
  await state.user(USER_A);
  await state.db.exec('reset role');
  await state.db.query('delete from public.interview_sessions where id=$1', [sourceId]);
  assert.equal((await state.db.query('select count(*)::int as n from public.practice_questions')).rows[0].n, 0);
  assert.equal(randomUUID().length, 36);
});
