// SCRUM-80, SCRUM-81: answer validation, resume state, daily AI limit wrappers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANSWER_MAX,
  toProgress,
  toResumeState,
  toSessionResponse,
  toTurns,
  validateSaveAnswer,
} from '../lib/interview/session-contract.mjs';
import {
  AiLimitError,
  DEFAULT_DAILY_AI_LIMIT,
  createAiCallCounter,
  dailyLimitFromEnv,
  withAnalysisLimit,
  withInterviewerLimit,
} from '../lib/ai/daily-limit.mjs';
import { formatFitError } from '../lib/analysis/analysis-fit.mjs';
import { AnalysisError } from '../lib/analysis/errors.mjs';
import { InterviewerError } from '../lib/interview/interviewer-contract.mjs';
import { INTERVIEW_ERROR_CODES, interviewErrorMessage } from '../lib/interview/error-messages.mjs';

const QID = '11111111-1111-4111-8111-111111111111';

test('validateSaveAnswer accepts a trimmed answer with defaults', () => {
  const result = validateSaveAnswer({ questionId: QID, content: '  I used React.  ' });
  assert.deepEqual(result, { ok: true, value: { questionId: QID, content: 'I used React.', inputMode: 'text', durationSeconds: null } });
});

test('validateSaveAnswer rejects bad fields with one message per field', () => {
  const result = validateSaveAnswer({
    questionId: 'q1', content: '   ', inputMode: 'video', durationSeconds: -1, userId: 'x',
  });
  assert.equal(result.ok, false);
  assert.deepEqual(Object.keys(result.fields).sort(), ['content', 'durationSeconds', 'inputMode', 'questionId', 'userId']);
  assert.equal(validateSaveAnswer({ questionId: QID, content: 'a'.repeat(ANSWER_MAX + 1) }).ok, false);
  assert.equal(validateSaveAnswer([]).ok, false);
  assert.equal(validateSaveAnswer({ questionId: QID, content: 'ok', durationSeconds: 12.5, inputMode: 'voice' }).ok, true);
});

const rows = [
  { id: 'q2', position: 2, kind: 'follow_up', topic: 'React', content: 'Why?', created_at: 't2', answers: null },
  {
    id: 'q1', position: 1, kind: 'main', topic: 'React', content: 'Tell me about React.', created_at: 't1',
    answers: { id: 'a1', content: 'I built a todo app.', input_mode: 'voice', duration_seconds: '12.5', created_at: 't1b' },
  },
];

test('toTurns orders questions and maps answers (object or array embed)', () => {
  const turns = toTurns(rows);
  assert.deepEqual(turns.map((t) => t.question.id), ['q1', 'q2']);
  assert.deepEqual(turns[0].answer, { id: 'a1', content: 'I built a todo app.', inputMode: 'voice', durationSeconds: 12.5, createdAt: 't1b' });
  assert.equal(turns[1].answer, null);
  const arrayEmbed = toTurns([{ ...rows[1], answers: [rows[1].answers] }]);
  assert.equal(arrayEmbed[0].answer.id, 'a1');
  assert.equal(toTurns([{ ...rows[1], answers: [] }])[0].answer, null);
});

test('toResumeState tells the chat page what to do next', () => {
  const turns = toTurns(rows);
  assert.deepEqual(toResumeState('in_progress', []), { state: 'not_started', afterAnswerId: null });
  assert.deepEqual(toResumeState('in_progress', turns), { state: 'awaiting_answer', questionId: 'q2' });
  assert.deepEqual(toResumeState('in_progress', turns.slice(0, 1)), { state: 'awaiting_question', afterAnswerId: 'a1' });
  assert.deepEqual(toResumeState('completed', turns), { state: 'finished' });
  assert.deepEqual(toResumeState('abandoned', []), { state: 'finished' });
});

test('toProgress counts main questions only', () => {
  assert.deepEqual(toProgress(toTurns(rows), 8), { mainQuestionsAsked: 1, mainQuestionsAnswered: 1, plannedQuestions: 8 });
});

test('toSessionResponse includes startedAt and endedAt', () => {
  const response = toSessionResponse({ id: 's', status: 'completed', started_at: 'a', ended_at: 'b' });
  assert.equal(response.startedAt, 'a');
  assert.equal(response.endedAt, 'b');
  assert.equal(toSessionResponse({ id: 's' }).startedAt, null);
});

test('dailyLimitFromEnv uses AI_DAILY_LIMIT only when it is a sane integer', () => {
  assert.equal(dailyLimitFromEnv({}), DEFAULT_DAILY_AI_LIMIT);
  assert.equal(dailyLimitFromEnv({ AI_DAILY_LIMIT: '20' }), 20);
  for (const bad of ['0', '-5', '2.5', 'abc', '100000']) assert.equal(dailyLimitFromEnv({ AI_DAILY_LIMIT: bad }), DEFAULT_DAILY_AI_LIMIT);
});

function fakeSupabase(result) {
  const calls = [];
  return { calls, rpc: async (name, args) => { calls.push([name, args]); return result; } };
}

test('createAiCallCounter passes the limit and maps results', async () => {
  const ok = fakeSupabase({ data: { allowed: true, used: 3, limit: 5 }, error: null });
  assert.equal((await createAiCallCounter(ok, { limit: 5 })()).used, 3);
  assert.deepEqual(ok.calls, [['consume_ai_call', { p_limit: 5 }]]);

  const full = createAiCallCounter(fakeSupabase({ data: { allowed: false, used: 5, limit: 5 }, error: null }), { limit: 5 });
  await assert.rejects(full, (e) => e instanceof AiLimitError && e.code === 'AI_DAILY_LIMIT' && e.usage.used === 5);

  const missing = createAiCallCounter(fakeSupabase({ data: null, error: { code: 'PGRST202' } }));
  await assert.rejects(missing, (e) => e.code === 'DATABASE_NOT_READY');
  const broken = createAiCallCounter(fakeSupabase({ data: null, error: { code: 'XX000' } }));
  await assert.rejects(broken, (e) => e.code === 'SERVER_ERROR');
  const noUser = createAiCallCounter(fakeSupabase({ data: { error: 'UNAUTHORIZED' }, error: null }));
  await assert.rejects(noUser, (e) => e.code === 'SERVER_ERROR');
});

test('withAnalysisLimit counts before calling Gemini and blocks when the limit is used up', async () => {
  let consumed = 0; let analyzed = 0;
  const provider = { model: 'm', analyze: async () => { analyzed += 1; return 'raw'; } };
  const limited = withAnalysisLimit(provider, async () => { consumed += 1; });
  assert.equal(limited.model, 'm');
  assert.equal(await limited.analyze({}), 'raw');
  assert.deepEqual([consumed, analyzed], [1, 1]);

  const blocked = withAnalysisLimit(provider, async () => { throw new AiLimitError('AI_DAILY_LIMIT', { limit: 100 }); });
  await assert.rejects(blocked.analyze({}), (e) => e instanceof AnalysisError && e.code === 'AI_DAILY_LIMIT' && e.status === 429
    && e.message.includes('100'));
  const down = withAnalysisLimit(provider, async () => { throw new AiLimitError('SERVER_ERROR'); });
  await assert.rejects(down.analyze({}), (e) => e instanceof AnalysisError && e.status === 503);
  assert.equal(analyzed, 1, 'Gemini is never called when the limit check fails');
});

test('/api/analyze-fit error format keeps the daily-limit message', () => {
  const error = formatFitError({ code: 'AI_DAILY_LIMIT', message: 'Bạn đã dùng hết lượt AI hôm nay.' }, 429);
  assert.deepEqual(error, { code: 'DAILY_LIMIT', message: 'Bạn đã dùng hết lượt AI hôm nay.' });
  assert.equal(formatFitError({ code: 'AI_RATE_LIMITED', message: 'x' }, 429).code, 'RATE_LIMIT');
});

const interviewInput = (elapsedSeconds = 10) => ({
  settings: { type: 'technical', difficulty: 'medium', language: 'en', targetPosition: 'Frontend Intern', durationMinutes: 15, plannedQuestions: 5 },
  state: { status: 'in_progress', elapsedSeconds },
  jdText: 'React and REST API.', cvText: 'Built a React app.', history: [],
});

test('withInterviewerLimit counts real Gemini turns only', async () => {
  let consumed = 0;
  const provider = { model: 'm', next: async () => 'decision' };
  const limited = withInterviewerLimit(provider, async () => { consumed += 1; });
  assert.equal(await limited.next(interviewInput()), 'decision');
  assert.equal(consumed, 1);
  // The 15-minute time limit has passed: the turn ends without calling Gemini.
  await limited.next(interviewInput(15 * 60 + 1));
  assert.equal(consumed, 1);

  const blocked = withInterviewerLimit(provider, async () => { throw new AiLimitError('AI_DAILY_LIMIT'); });
  await assert.rejects(blocked.next(interviewInput()), (e) => e instanceof InterviewerError && e.code === 'AI_DAILY_LIMIT' && e.status === 429);
  const notReady = withInterviewerLimit(provider, async () => { throw new AiLimitError('DATABASE_NOT_READY'); });
  await assert.rejects(notReady.next(interviewInput()), (e) => e.code === 'DATABASE_NOT_READY' && e.status === 503);
});

test('every interview error code has a Vietnamese and an English message', () => {
  for (const code of INTERVIEW_ERROR_CODES) {
    assert.notEqual(interviewErrorMessage(code, 'vi'), interviewErrorMessage(code, 'en'));
  }
  assert.equal(interviewErrorMessage('SOMETHING_NEW', 'en'), interviewErrorMessage('SERVER_ERROR', 'en'));
  assert.equal(interviewErrorMessage(undefined), interviewErrorMessage('SERVER_ERROR', 'vi'));
});
