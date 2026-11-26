// SCRUM-186: interview report (UC-09) – scores, speaking indicators, timeline,
// AI summary and the report service, with fake data (no Supabase, no Gemini).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReport, buildSummaryInput, countFillers, countWords, toReportRow, validateSummary,
} from '../lib/report/report-builder.mjs';
import { buildSummaryRequest, createReportSummaryProvider, REPORT_SUMMARY_BUDGET_MS, ReportSummaryError } from '../lib/report/report-summary.mjs';
import { createReportService, ReportError } from '../lib/report/report-service.mjs';
import { AiLimitError } from '../lib/ai/daily-limit.mjs';

const START = '2026-11-19T10:00:00.000Z';
const session = (over = {}) => ({
  id: 's1', status: 'completed', round_type: 'technical', difficulty: 'medium', language: 'en',
  target_position: 'Frontend Intern', duration_minutes: 15, started_at: START, ended_at: '2026-11-19T10:12:30.000Z', ...over,
});
const fb = (c, s, cl, co, o, extra = {}) => ({
  content_score: c, structure_score: s, clarity_score: cl, confidence_score: co, overall_score: String(o),
  strengths: ['Clear example'], improvements: ['Add numbers'], ...extra,
});
const q = (position, kind, answer, created = `2026-11-19T10:0${position}:00.000Z`) => ({
  id: `q${position}`, position, kind, topic: kind === 'main' ? `Topic ${position}` : 'Topic 1', content: `Question ${position}?`, created_at: created,
  answers: answer,
});
const rows = () => [
  q(2, 'follow_up', { id: 'a2', content: 'Um, I would, like, memoize it.', input_mode: 'voice', duration_seconds: '30.0', word_count: 6, feedbacks: fb(6, 5, 6, 5, 5.8) }),
  q(1, 'main', { id: 'a1', content: 'I built a React app with tests.', input_mode: 'text', duration_seconds: null, word_count: 7, feedbacks: [fb(8, 7, 8, 7, 7.6)] }),
  q(3, 'main', { id: 'a3', content: 'No idea.', input_mode: 'text', duration_seconds: null, word_count: 2, feedbacks: null }),
  q(4, 'main', null),
];

test('countWords and countFillers', () => {
  assert.equal(countWords('  a  b c '), 3);
  assert.equal(countWords(''), 0);
  const en = countFillers(['Um, I mean, it was like, you know, fine. Um.'], 'en');
  assert.equal(en.total, 5);
  assert.deepEqual(en.top[0], { word: 'um', count: 2 });
  // A phrase is not counted again as its first word.
  const vi = countFillers(['Kiểu như em làm, kiểu vậy. Ừm thì là ổn.'], 'vi');
  assert.deepEqual(Object.fromEntries(vi.top.map((t) => [t.word, t.count])), { 'kiểu như': 1, kiểu: 1, 'ừm': 1, 'thì là': 1 });
});

test('buildReport averages scored answers and hides STAR outside behavioral interviews', () => {
  const report = buildReport(session(), rows(), null);
  assert.equal(report.overview.overallScore, 6.7);
  assert.deepEqual(report.criteria, { content: 7, structure: null, clarity: 7, confidence: 6 });
  assert.equal(report.structureApplies, false);
  assert.deepEqual([report.overview.mainQuestions, report.overview.followUps, report.overview.answeredQuestions, report.overview.scoredAnswers], [3, 1, 3, 2]);
  assert.equal(report.overview.durationSeconds, 750);
  assert.equal(report.overview.trend, null);

  const behavioral = buildReport(session({ round_type: 'behavioral' }), rows(), { sessionId: 'old', overallScore: 6 });
  assert.equal(behavioral.criteria.structure, 6);
  assert.deepEqual(behavioral.overview.trend, { previousSessionId: 'old', previousOverallScore: 6, change: 0.7 });
});

test('speaking indicators: pace only from answers with a duration', () => {
  const { speaking } = buildReport(session(), rows(), null);
  assert.equal(speaking.totalWords, 15);
  assert.equal(speaking.avgAnswerWords, 5);
  assert.equal(speaking.fillerWords.total, 2);
  assert.equal(speaking.paceAvailable, true);
  assert.equal(speaking.timedAnswers, 1);
  assert.equal(speaking.wordsPerMinute, 12);

  const typed = rows().map((r) => (r.answers ? { ...r, answers: { ...r.answers, duration_seconds: null } } : r));
  const noPace = buildReport(session(), typed, null).speaking;
  assert.deepEqual([noPace.paceAvailable, noPace.wordsPerMinute], [false, null]);
});

test('timeline lists every question in order with time and score', () => {
  const { timeline } = buildReport(session(), rows(), null);
  assert.deepEqual(timeline.map((t) => [t.position, t.kind, t.offsetSeconds, t.answered, t.score]), [
    [1, 'main', 60, true, 7.6], [2, 'follow_up', 120, true, 5.8], [3, 'main', 180, true, null], [4, 'main', 240, false, null],
  ]);
  assert.deepEqual(timeline[0].scores, { content: 8, structure: null, clarity: 8, confidence: 7 });
  assert.deepEqual(timeline.map((t) => t.answerId), ['a1', 'a2', 'a3', null]);
});

test('buildReport needs at least one scored answer', () => {
  const unscored = rows().map((r) => (r.answers ? { ...r, answers: { ...r.answers, feedbacks: null } } : r));
  assert.throws(() => buildReport(session(), unscored, null), { code: 'NO_SCORED_ANSWERS' });
  assert.throws(() => buildReport(session(), [], null), { code: 'NO_SCORED_ANSWERS' });
});

test('toReportRow and buildSummaryInput keep only report data', () => {
  const report = buildReport(session(), rows(), null);
  const row = toReportRow('s1', report, { text: 'Good.', strengths: ['A'], improvements: ['B'] });
  assert.deepEqual(row.speaking_metrics, { filler_words: 2, filler_words_per_100: 13.3, words_per_minute: 12, avg_answer_words: 5, timed_answers: 1 });
  assert.equal(row.overall_score, 6.7);
  assert.equal(toReportRow('s1', report, null).summary, null);

  const input = buildSummaryInput(session({ target_position: 'x'.repeat(300) }), report, rows());
  assert.equal(input.language, 'en');
  assert.equal(input.turns.length, 3);
  assert.equal(input.targetPosition.length, 120);
  assert.ok(!JSON.stringify(input).includes('cv_text'));
});

test('validateSummary accepts only the documented shape', () => {
  const ok = { summary: ' Solid start. ', strengths: ['Clear example'], improvements: ['Use numbers', 'Shorter answers'] };
  assert.deepEqual(validateSummary(ok), { text: 'Solid start.', strengths: ['Clear example'], improvements: ['Use numbers', 'Shorter answers'] });
  for (const bad of [null, [], { ...ok, extra: 1 }, { ...ok, strengths: [] }, { ...ok, improvements: ['a', 'b', 'c', 'd'] },
    { ...ok, summary: '' }, { ...ok, strengths: ['x'.repeat(241)] }, { ...ok, summary: 'x'.repeat(801) }]) {
    assert.equal(validateSummary(bad), null);
  }
});

function geminiResponse(payload, { status = 200, finishReason = 'STOP' } = {}) {
  return async (url, init) => {
    geminiResponse.last = { url, init };
    if (status !== 200) return new Response('{"error":{}}', { status });
    return Response.json({ candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(payload) }] } }] });
  };
}

test('summary provider sends a bounded JSON request and maps errors', async () => {
  const env = { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-test' };
  const input = buildSummaryInput(session({ language: 'vi' }), buildReport(session({ language: 'vi' }), rows(), null), rows());
  const good = { summary: 'Tốt.', strengths: ['Ví dụ rõ'], improvements: ['Thêm số liệu'] };
  const provider = createReportSummaryProvider({ env, fetchImpl: geminiResponse(good) });
  assert.deepEqual(await provider.summarize(input), { text: 'Tốt.', strengths: ['Ví dụ rõ'], improvements: ['Thêm số liệu'] });
  const sent = JSON.parse(geminiResponse.last.init.body);
  assert.match(geminiResponse.last.url, /models\/gemini-test:generateContent$/);
  assert.equal(geminiResponse.last.init.headers['x-goog-api-key'], 'test-key');
  assert.match(sent.systemInstruction.parts[0].text, /Vietnamese/);
  assert.equal(sent.generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(buildSummaryRequest(input).contents, sent.contents);

  const code = async (fetchImpl, e = env) => createReportSummaryProvider({ env: e, fetchImpl }).summarize(input).catch((err) => err instanceof ReportSummaryError && err.code);
  assert.equal(await code(geminiResponse(good), {}), 'AI_NOT_CONFIGURED');
  assert.equal(await code(geminiResponse(good, { status: 429 })), 'AI_RATE_LIMITED');
  assert.equal(await code(geminiResponse(good, { status: 503 })), 'AI_UNAVAILABLE');
  assert.equal(await code(geminiResponse(good, { status: 403 })), 'AI_CONFIGURATION_ERROR');
  assert.equal(await code(geminiResponse(good, { finishReason: 'SAFETY' })), 'AI_CONTENT_BLOCKED');
  assert.equal(await code(geminiResponse({ summary: 'x' })), 'INVALID_OUTPUT');
  assert.equal(await code(geminiResponse({ ...good, strengths: ['You are stupid'] })), 'INVALID_OUTPUT');
  assert.equal(await code(async () => { throw new TypeError('network'); }), 'AI_UNAVAILABLE');
});

test('summary is cut at 20 s so the report stays within 30 s, even with GEMINI_TIMEOUT_MS=30000', async () => {
  const input = buildSummaryInput(session(), buildReport(session(), rows(), null), rows());
  const budgets = [];
  const original = AbortSignal.timeout;
  AbortSignal.timeout = (ms) => { budgets.push(ms); return AbortSignal.abort(); };
  try {
    for (const value of ['30000', undefined, '5000']) {
      const err = await createReportSummaryProvider({ env: { GEMINI_API_KEY: 'k', GEMINI_TIMEOUT_MS: value }, fetchImpl: async (_url, init) => { init.signal.throwIfAborted(); } })
        .summarize(input).catch((e) => e);
      assert.equal(err.code, 'AI_TIMEOUT');
    }
  } finally {
    AbortSignal.timeout = original;
  }
  assert.deepEqual(budgets, [REPORT_SUMMARY_BUDGET_MS, REPORT_SUMMARY_BUDGET_MS, 5000]);
  assert.equal(REPORT_SUMMARY_BUDGET_MS, 20000);
});

function fakeRepository({ sess = session(), saved = null, previous = null, questions = rows() } = {}) {
  const repo = {
    saves: [],
    session: async (id) => (id === sess?.id ? sess : null),
    questions: async () => questions,
    savedReport: async () => saved,
    previous: async () => previous,
    save: async (row) => { repo.saves.push(row); saved = { summary: row.summary, strengths: row.strengths, improvements: row.improvements }; return { created_at: '2026-11-19T10:13:00.000Z' }; },
  };
  return repo;
}

test('report service writes the summary once and reuses it', async () => {
  const repository = fakeRepository();
  let aiCalls = 0; let consumed = 0;
  const provider = { summarize: async () => { aiCalls += 1; return { text: 'Good session.', strengths: ['Examples'], improvements: ['Confidence'] }; } };
  const getReport = createReportService({ repository, provider, consume: async () => { consumed += 1; } });
  const first = await getReport('s1');
  assert.equal(first.summary.status, 'ready');
  assert.equal(first.generatedAt, '2026-11-19T10:13:00.000Z');
  assert.equal(first.overview.overallScore, 6.7);
  assert.equal(repository.saves[0].summary, 'Good session.');
  const second = await getReport('s1', { retrySummary: true });
  assert.equal(second.summary.text, 'Good session.');
  assert.deepEqual([aiCalls, consumed], [1, 1]);
});

test('report service still returns the report when the summary fails, and retries only on request', async () => {
  const repository = fakeRepository();
  let aiCalls = 0;
  let fail = new ReportSummaryError('AI_UNAVAILABLE');
  const provider = { summarize: async () => { aiCalls += 1; if (fail) throw fail; return { text: 'Now ok.', strengths: ['A'], improvements: ['B'] }; } };
  const getReport = createReportService({ repository, provider, consume: async () => {} });
  const first = await getReport('s1');
  assert.deepEqual([first.summary.status, first.summary.errorCode, first.timeline.length], ['unavailable', 'AI_UNAVAILABLE', 4]);
  assert.equal(repository.saves.length, 1);
  const reopened = await getReport('s1');
  assert.deepEqual([reopened.summary.errorCode, aiCalls], ['SUMMARY_NOT_GENERATED', 1]);
  fail = null;
  const retried = await getReport('s1', { retrySummary: true });
  assert.deepEqual([retried.summary.status, aiCalls], ['ready', 2]);
});

test('report service: daily limit, missing session, unfinished session, no scores', async () => {
  const limited = createReportService({
    repository: fakeRepository(), provider: { summarize: async () => assert.fail('no AI call') },
    consume: async () => { throw new AiLimitError('AI_DAILY_LIMIT'); },
  });
  assert.equal((await limited('s1')).summary.errorCode, 'AI_DAILY_LIMIT');

  const service = (opts) => createReportService({ repository: fakeRepository(opts), provider: { summarize: async () => ({}) }, consume: async () => {} });
  await assert.rejects(service()('other'), (e) => e instanceof ReportError && e.code === 'NOT_FOUND' && e.status === 404);
  await assert.rejects(service({ sess: session({ status: 'in_progress' }) })('s1'), { code: 'SESSION_NOT_COMPLETED', status: 409 });
  await assert.rejects(service({ questions: [q(1, 'main', null)] })('s1'), { code: 'NO_SCORED_ANSWERS', status: 409 });
});
