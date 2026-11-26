// Build 2 acceptance run of the UC-09 test cases (UC09-01 … UC09-07, sheet
// "InterviewBuddy_Test_Cases_Build_2") at API level, signed in as the two seed users.
//
//   API_BASE_URL=https://interviewbuddy-main.vercel.app \
//   AI_DOWN_BASE_URL=http://localhost:3005 \
//   node --env-file-if-exists=.env.local scripts/test-uc09-build2.mjs [--json out.json]
//
// AI_DOWN_BASE_URL is a second server on the same Supabase project started with
// GEMINI_TIMEOUT_MS=1, so the AI summary fails (UC09-05 step 1, the simulation the
// test case asks for). Without it UC09-05 is reported as "Not run".
//
// Test data is built the same way as scripts/test-report-api.mjs: sessions through the
// Session API, per-answer scores inserted as the user (the rows /api/evaluate-answer writes).
// Everything created is deleted at the end.
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const base = (process.env.API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const aiDownBase = process.env.AI_DOWN_BASE_URL?.replace(/\/$/, '') || null;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const password = process.env.SEED_USER_PASSWORD;
if (!url || !anonKey || !password) {
  console.error('✗ Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SEED_USER_PASSWORD in .env.local.');
  process.exit(1);
}
const jsonIndex = process.argv.indexOf('--json');
const jsonPath = jsonIndex > 0 ? process.argv[jsonIndex + 1] : null;

async function signIn(email) {
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) { console.error(`✗ Cannot sign in as ${email}.`); process.exit(1); }
  return { client, token: data.session.access_token };
}
async function call(method, path, token, { body, at = base } = {}) {
  const started = Date.now();
  const res = await fetch(`${at}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null), ms: Date.now() - started };
}

const A = await signIn('candidate.a@interviewbuddy.test');
const B = await signIn('candidate.b@interviewbuddy.test');
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const aiCalls = async (user) => (await user.client.from('ai_usage_daily').select('calls').eq('usage_date', today).maybeSingle()).data?.calls ?? 0;
const created = [];

async function interview(user, { type, language = 'en', turns }) {
  const r = await call('POST', '/api/interview', user.token, {
    body: { type, difficulty: 'medium', language, targetPosition: 'Frontend Developer Intern',
      interviewDate: null, durationMinutes: 15, inputMode: turns.some((t) => t.duration) ? 'voice' : 'text', fitAnalysisId: null },
  });
  if (r.status !== 201 && r.status !== 200) throw new Error(`create session -> ${r.status} ${JSON.stringify(r.body)}`);
  const sid = r.body.sessionId;
  created.push({ user, sid });
  let parent = null;
  for (const [i, t] of turns.entries()) {
    const q = (await user.client.from('questions').insert({
      session_id: sid, position: i + 1, kind: t.kind ?? 'main', topic: t.topic ?? `topic ${i + 1}`,
      content: t.question ?? `Question ${i + 1}?`, parent_question_id: t.kind === 'follow_up' ? parent : null,
    }).select('id').single()).data;
    if ((t.kind ?? 'main') === 'main') parent = q.id;
    if (!t.answer) continue;
    const a = await call('POST', `/api/interview/${sid}/answers`, user.token, {
      body: { questionId: q.id, content: t.answer, inputMode: t.duration ? 'voice' : 'text', durationSeconds: t.duration ?? null },
    });
    if (t.scores) {
      const [content, structure, clarity, confidence] = t.scores;
      const parts = t.scores.filter((s) => s !== null);
      await user.client.from('feedbacks').insert({
        answer_id: a.body.answer.id, content_score: content, structure_score: structure, clarity_score: clarity,
        confidence_score: confidence, overall_score: Math.round((parts.reduce((x, y) => x + y, 0) / parts.length) * 10) / 10,
        explanation: 'Synthetic Build 2 test feedback.', strengths: ['Clear example'], improvements: ['Add a measurable result'],
      });
    }
  }
  await call('POST', `/api/interview/${sid}/end`, user.token);
  return sid;
}

const cases = [];
function record(id, name, checks, actual, { status } = {}) {
  const ok = checks.every(([, pass]) => pass);
  const finalStatus = status ?? (ok ? 'Pass' : 'Fail');
  cases.push({ id, name, status: finalStatus, checks: checks.map(([label, pass]) => ({ label, pass: Boolean(pass) })), actual });
  console.log(`\n${finalStatus.toUpperCase().padEnd(7)} ${id} ${name}`);
  for (const [label, pass] of checks) console.log(`   ${pass ? '✓' : '✗'} ${label}`);
  if (!ok) console.log(`   actual: ${JSON.stringify(actual).slice(0, 900)}`);
}

const behavioralAnswer = (n) => `In my internship project ${n}, um, the team missed a deadline, so I split the work into small tasks, `
  + 'you know, and set up a daily check-in. As a result we shipped the release two days early and the client approved it.';
const technicalAnswer = (n) => `For question ${n} I would measure first with the React Profiler, then memoise the slow list and paginate the API call.`;

console.log(`UC-09 Build 2 run against ${base}${aiDownBase ? ` (AI-down server: ${aiDownBase})` : ''}`);
const pageCheck = await fetch(`${base}/reports/${randomUUID()}`, { redirect: 'manual' });
const pageHtml = pageCheck.status === 200 ? await pageCheck.text() : '';
const pageUsesSample = pageCheck.status >= 300 && pageCheck.status < 400 ? 'login redirect (signed out)' : (pageHtml.includes('Dữ liệu mẫu') ? 'sample data' : 'unknown');
console.log(`Report page /reports/{id}: HTTP ${pageCheck.status}, ${pageUsesSample}`);

// UC09-01 ---------------------------------------------------------------------------------------
const s0 = await interview(A, { type: 'behavioral', turns: [1, 2, 3].map((n) => ({ answer: behavioralAnswer(n), duration: 30, scores: [6, 5, 7, 6] })) });
const r0 = await call('GET', `/api/report/${s0}`, A.token);
const s1 = await interview(A, {
  type: 'behavioral',
  turns: [
    ...[1, 2, 3, 4, 5].map((n) => ({ topic: `STAR ${n}`, question: `Tell me about a challenge number ${n}.`, answer: behavioralAnswer(n), duration: 40, scores: [7, 6, 8, 7] })),
    { kind: 'follow_up', topic: 'STAR 5', question: 'What would you do differently?', answer: 'I would share the plan with the client earlier.', duration: 8, scores: [7, 6, 8, 7] },
  ],
});
const ai0 = await aiCalls(A);
const r1 = await call('GET', `/api/report/${s1}`, A.token);
const ai1 = await aiCalls(A);
const rep1 = r1.body;
record('UC09-01', 'View report of a completed Behavioral interview', [
  ['200 and ready within 30 s', r1.status === 200 && r1.ms < 30000],
  ['Summary cards: overall 7/10, type behavioral, duration, 5 main + 1 follow-up', rep1?.overview?.overallScore === 7 && rep1.settings?.type === 'behavioral'
    && rep1.overview.durationSeconds !== null && rep1.overview.mainQuestions === 5 && rep1.overview.followUps === 1],
  ['Trend vs the previous completed session with a report (S0, 6.0 -> +1.0)', r0.status === 200 && rep1?.overview?.trend?.previousSessionId === s0 && rep1.overview.trend.change === 1],
  ['Bar chart data: Content 7, STAR 6, Clarity 8, Confidence 7 (STAR applies)', rep1?.criteria?.content === 7 && rep1.criteria.structure === 6
    && rep1.criteria.clarity === 8 && rep1.criteria.confidence === 7 && rep1.structureApplies === true],
  ['Strengths and areas to improve written by AI (1 AI call)', rep1?.summary?.status === 'ready' && rep1.summary.strengths.length >= 1 && rep1.summary.improvements.length >= 1 && ai1 === ai0 + 1],
  ['Filler words, speaking pace (voice), average answer length', rep1?.speaking?.fillerWords?.total >= 10 && rep1.speaking.paceAvailable === true
    && rep1.speaking.wordsPerMinute > 0 && rep1.speaking.avgAnswerWords > 0],
  ['Timeline: 6 questions incl. the follow-up, each with time and score', rep1?.timeline?.length === 6 && rep1.timeline[5].kind === 'follow_up'
    && rep1.timeline.every((t) => t.score === 7 && t.offsetSeconds !== null)],
], { status: r1.status, ms: r1.ms, overview: rep1?.overview, criteria: rep1?.criteria, speaking: rep1?.speaking, summary: rep1?.summary, aiCalls: [ai0, ai1] });

// UC09-02 ---------------------------------------------------------------------------------------
const s2 = await interview(A, { type: 'technical', turns: [1, 2, 3, 4, 5].map((n) => ({ answer: technicalAnswer(n), scores: [7, null, 6, 6] })) });
const r2 = await call('GET', `/api/report/${s2}`, A.token);
const rep2 = r2.body;
record('UC09-02', 'Technical interview with typed answers: STAR hidden, pace not available', [
  ['200', r2.status === 200],
  ['Only Content, Clarity, Confidence: STAR is null (not 0), structureApplies false', rep2?.criteria?.structure === null && rep2.structureApplies === false
    && rep2.criteria.content === 7 && rep2.criteria.clarity === 6 && rep2.criteria.confidence === 6],
  ['Filler words and average answer length shown', typeof rep2?.speaking?.fillerWords?.total === 'number' && rep2.speaking.avgAnswerWords > 0],
  ['Speaking pace not available for typed answers', rep2?.speaking?.paceAvailable === false && rep2.speaking.wordsPerMinute === null],
], { status: r2.status, criteria: rep2?.criteria, structureApplies: rep2?.structureApplies, speaking: rep2?.speaking });

// UC09-03 ---------------------------------------------------------------------------------------
const ai3 = await aiCalls(A);
const r3 = await call('GET', `/api/report/${s1}`, A.token);
const ai3b = await aiCalls(A);
record('UC09-03', 'Reopen a saved report: no new AI call', [
  ['200', r3.status === 200],
  ['Summary, strengths and areas identical to the first time', JSON.stringify(r3.body?.summary) === JSON.stringify(rep1?.summary)],
  ['No AI call: daily counter unchanged', ai3b === ai3],
  ['Faster than the first open', r3.ms < r1.ms],
], { status: r3.status, firstMs: r1.ms, reopenMs: r3.ms, aiCalls: [ai3, ai3b] });

// UC09-04 (candidate_b plays candidate_first: S4 is moved before B's other sessions) -------------
const s4 = await interview(B, { type: 'behavioral', turns: [{ answer: behavioralAnswer(1), scores: [6, 5, 6, 6] }, { question: 'Last question, not answered?' }] });
await B.client.from('interview_sessions').update({ started_at: '2020-01-01T03:00:00Z', ended_at: '2020-01-01T03:05:00Z' }).eq('id', s4);
const r4 = await call('GET', `/api/report/${s4}`, B.token);
const rep4 = r4.body;
record('UC09-04', 'First session / ended early: trend "-" and unanswered last question', [
  ['200, built from the answered question only', r4.status === 200 && rep4?.overview?.answeredQuestions === 1 && rep4.overview.scoredAnswers === 1 && rep4.overview.overallScore === 5.8],
  ['No earlier report: trend is null (page shows "-")', rep4?.overview?.trend === null],
  ['Last question listed without a score (not 0)', rep4?.timeline?.length === 2 && rep4.timeline[1].answered === false && rep4.timeline[1].score === null],
], { status: r4.status, overview: rep4?.overview, timeline: rep4?.timeline?.map((t) => ({ answered: t.answered, score: t.score })) });

// UC09-05 ---------------------------------------------------------------------------------------
if (aiDownBase) {
  const s5 = await interview(A, { type: 'behavioral', turns: [1, 2, 3, 4].map((n) => ({ answer: behavioralAnswer(n), scores: [7, 6, 7, 6] })) });
  const r5a = await call('GET', `/api/report/${s5}`, A.token, { at: aiDownBase });
  const r5b = await call('GET', `/api/report/${s5}`, A.token);
  const r5c = await call('GET', `/api/report/${s5}?retry=summary`, A.token);
  record('UC09-05', 'AI summary unavailable: rest of the report still works', [
    ['AI down: 200 with scores, criteria, indicators and timeline', r5a.status === 200 && r5a.body?.overview?.overallScore === 6.5
      && r5a.body.criteria?.content === 7 && r5a.body.speaking && r5a.body.timeline?.length === 4],
    ['Summary marked unavailable with an error code (page shows message + Try again)', r5a.body?.summary?.status === 'unavailable' && Boolean(r5a.body.summary.errorCode)],
    ['Reopening without "Try again" does not call the AI again', r5b.body?.summary?.status === 'unavailable' && r5b.body.summary.errorCode === 'SUMMARY_NOT_GENERATED'],
    ['AI restored + Try again (?retry=summary): strengths and areas appear', r5c.status === 200 && r5c.body?.summary?.status === 'ready' && r5c.body.summary.strengths.length >= 1],
  ], { down: { status: r5a.status, summary: r5a.body?.summary }, reopen: r5b.body?.summary, retry: { status: r5c.status, summary: r5c.body?.summary?.status } });
} else {
  record('UC09-05', 'AI summary unavailable: rest of the report still works', [['AI_DOWN_BASE_URL not set', false]], null, { status: 'Not run' });
}

// UC09-06 ---------------------------------------------------------------------------------------
const rb = await interview(B, { type: 'behavioral', turns: [1, 2].map((n) => ({ answer: behavioralAnswer(n), scores: [7, 7, 7, 7] })) });
const rbOwn = await call('GET', `/api/report/${rb}`, B.token);
const r6a = await call('GET', `/api/report/${rb}`, A.token);
const r6b = await call('GET', `/api/report/${randomUUID()}`, A.token);
record('UC09-06', 'Report not found / belongs to another user', [
  ['R-B exists for its owner (200)', rbOwn.status === 200],
  ["Another user's report -> 404 NOT_FOUND, no report data", r6a.status === 404 && r6a.body?.error?.code === 'NOT_FOUND' && !('overview' in (r6a.body ?? {}))],
  ['Random UUID -> 404 NOT_FOUND', r6b.status === 404 && r6b.body?.error?.code === 'NOT_FOUND'],
  ['Both responses are identical (existence not revealed)', JSON.stringify(r6a.body) === JSON.stringify(r6b.body)],
], { own: rbOwn.status, other: r6a, random: r6b });

// UC09-07 ---------------------------------------------------------------------------------------
const s7 = await interview(A, { type: 'behavioral', turns: [1, 2, 3, 4].map((n) => ({ answer: behavioralAnswer(n) })) });
const ai7 = await aiCalls(A);
const r7a = await call('GET', `/api/report/${s7}`, A.token);
const r7b = await call('GET', `/api/report/${s7}?retry=summary`, A.token);
const saved7 = (await A.client.from('reports').select('id').eq('session_id', s7).maybeSingle()).data;
record('UC09-07', 'No answer has a score: report not ready', [
  ['409 NO_SCORED_ANSWERS ("report is not ready"), no scores or chart data', r7a.status === 409 && r7a.body?.error?.code === 'NO_SCORED_ANSWERS' && !('criteria' in (r7a.body ?? {}))],
  ['Try again re-checks and is still not ready', r7b.status === 409 && r7b.body?.error?.code === 'NO_SCORED_ANSWERS'],
  ['No report row saved and no AI call', saved7 === null && (await aiCalls(A)) === ai7],
], { first: r7a, retry: r7b });

for (const { user, sid } of created) await user.client.from('interview_sessions').delete().eq('id', sid);

const summary = cases.reduce((acc, c) => ({ ...acc, [c.status]: (acc[c.status] ?? 0) + 1 }), {});
console.log(`\n${JSON.stringify(summary)}  (report page: ${pageUsesSample})`);
if (jsonPath) writeFileSync(jsonPath, `${JSON.stringify({ base, aiDownBase, runAt: new Date().toISOString(), reportPage: pageUsesSample, cases }, null, 2)}\n`);
process.exit(cases.some((c) => c.status === 'Fail') ? 1 : 0);
