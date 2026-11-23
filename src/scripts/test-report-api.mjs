// End-to-end test of GET /api/report/{sessionId} (UC-09, SCRUM-186) against a
// running app and the shared Supabase project, signed in as the two seed users.
//
//   npm run dev                (or next build && next start)
//   npm run test:report-api    [--sample docs/api/examples/report.response.json]
//
// Per-answer scores are inserted directly as the user (the rows that
// /api/evaluate-answer will write in Build 2). One Gemini call is made for the
// session summary; the second request must reuse it. Everything created is deleted.
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';

const base = (process.env.API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const password = process.env.SEED_USER_PASSWORD;
if (!url || !anonKey || !password) {
  console.error('✗ Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SEED_USER_PASSWORD in .env.local.');
  process.exit(1);
}
const sampleIndex = process.argv.indexOf('--sample');
const samplePath = sampleIndex > 0 ? process.argv[sampleIndex + 1] : null;

async function signIn(email) {
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) { console.error(`✗ Cannot sign in as ${email}. Did you run "npm run seed"?`); process.exit(1); }
  return { client, token: data.session.access_token };
}
async function call(method, path, token, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
const results = [];
function expect(name, condition, detail) {
  results.push(Boolean(condition));
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${condition ? '' : `  -> ${JSON.stringify(detail)?.slice(0, 600)}`}`);
}

const A = await signIn('candidate.a@interviewbuddy.test');
const B = await signIn('candidate.b@interviewbuddy.test');
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const aiCalls = async () => (await A.client.from('ai_usage_daily').select('calls').eq('usage_date', today).maybeSingle()).data?.calls ?? 0;
const created = [];

async function interview(type, turns, { end = true } = {}) {
  const r = await call('POST', '/api/interview', A.token, {
    type, difficulty: 'medium', language: 'vi', targetPosition: 'Frontend Developer Intern',
    interviewDate: null, durationMinutes: 15, inputMode: 'text', fitAnalysisId: null,
  });
  const sid = r.body.sessionId;
  created.push(sid);
  let parent = null;
  for (const [i, t] of turns.entries()) {
    const q = (await A.client.from('questions').insert({
      session_id: sid, position: i + 1, kind: t.kind, topic: t.topic, content: t.question,
      parent_question_id: t.kind === 'follow_up' ? parent : null,
    }).select('id').single()).data;
    if (t.kind === 'main') parent = q.id;
    if (!t.answer) continue;
    const a = await call('POST', `/api/interview/${sid}/answers`, A.token, { questionId: q.id, content: t.answer, inputMode: t.duration ? 'voice' : 'text', durationSeconds: t.duration ?? null });
    if (t.scores) {
      const [content, structure, clarity, confidence, overall] = t.scores;
      await A.client.from('feedbacks').insert({
        answer_id: a.body.answer.id, content_score: content, structure_score: structure, clarity_score: clarity,
        confidence_score: confidence, overall_score: overall, explanation: 'Synthetic test feedback.',
        strengths: t.strengths ?? [], improvements: t.improvements ?? [],
      });
    }
  }
  if (end) await call('POST', `/api/interview/${sid}/end`, A.token);
  return sid;
}

console.log(`Testing ${base}/api/report\n`);
const sid = await interview('technical', [
  { kind: 'main', topic: 'React rendering', question: 'Bạn xử lý component render chậm như thế nào?',
    answer: 'Em dùng React DevTools để tìm component render lại nhiều, sau đó dùng React.memo và useMemo cho danh sách lớn.',
    scores: [8, 6, 7, 7, 7.5], strengths: ['Nêu công cụ đo cụ thể'], improvements: ['Thêm số liệu trước và sau'] },
  { kind: 'follow_up', topic: 'React rendering', question: 'Bạn đo hiệu quả trước và sau như thế nào?',
    answer: 'Ừm, kiểu như em xem thời gian render trong Profiler, thấy giảm khoảng một nửa.', duration: 12,
    scores: [6, 5, 6, 5, 5.5], strengths: ['Có kết quả đo'], improvements: ['Nói rõ con số và bối cảnh'] },
  { kind: 'main', topic: 'REST API', question: 'Bạn xử lý lỗi khi gọi API như thế nào?',
    answer: 'Em hiện thông báo lỗi và nút thử lại, và hủy request cũ bằng AbortController.',
    scores: [7, 6, 8, 6, 6.8], strengths: ['Có xử lý hủy request'], improvements: ['Nói thêm về retry có giới hạn'] },
  { kind: 'main', topic: 'Testing', question: 'Bạn kiểm thử component thế nào?', answer: null },
]);

const usageBefore = await aiCalls();
const r1 = await call('GET', `/api/report/${sid}`, A.token);
const usageAfterFirst = await aiCalls();
const rep = r1.body;
expect('1. Completed session -> 200 with overview, criteria and timeline',
  r1.status === 200 && rep?.overview?.overallScore === 6.6 && rep.overview.answeredQuestions === 3 && rep.overview.scoredAnswers === 3
  && rep.overview.mainQuestions === 3 && rep.overview.followUps === 1 && rep.timeline?.length === 4, r1);
expect('2. Criteria averaged from feedbacks; STAR not applicable for technical',
  rep?.criteria?.content === 7 && rep.criteria.structure === null && rep.criteria.clarity === 7 && rep.criteria.confidence === 6 && rep.structureApplies === false, rep?.criteria);
expect('3. Speaking: fillers counted, pace only from the voice answer',
  rep?.speaking?.fillerWords?.total === 2 && rep.speaking.paceAvailable === true && rep.speaking.timedAnswers === 1
  && rep.speaking.wordsPerMinute === Math.round(15 / (12 / 60)), rep?.speaking);
expect('4. Timeline in order with scores; unanswered question has no score',
  rep?.timeline?.map((t) => t.score).join() === '7.5,5.5,6.8,' && rep.timeline[3].answered === false && rep.timeline.every((t) => t.offsetSeconds !== null), rep?.timeline);
expect('5. AI summary written in the session language (1 Gemini call)',
  rep?.summary?.status === 'ready' && rep.summary.strengths.length >= 1 && rep.summary.improvements.length >= 1 && usageAfterFirst === usageBefore + 1,
  { summary: rep?.summary, usageBefore, usageAfterFirst });

const r2 = await call('GET', `/api/report/${sid}`, A.token);
const usageAfterSecond = await aiCalls();
expect('6. Reopening returns the saved summary without another AI call',
  r2.status === 200 && r2.body?.summary?.text === rep?.summary?.text && usageAfterSecond === usageAfterFirst, { usageAfterFirst, usageAfterSecond });
const saved = (await A.client.from('reports').select('overall_score, criteria_scores, speaking_metrics, summary').eq('session_id', sid).maybeSingle()).data;
expect('7. Report saved in the reports table', Number(saved?.overall_score) === 6.6 && saved.summary === rep?.summary?.text && saved.speaking_metrics?.filler_words === 2, saved);

const rB = await call('GET', `/api/report/${sid}`, B.token);
const rAnon = await call('GET', `/api/report/${sid}`);
const rBad = await call('GET', '/api/report/not-a-uuid', A.token);
expect('8. Another user -> 404, signed out -> 401, invalid id -> 404',
  rB.status === 404 && rB.body?.error?.code === 'NOT_FOUND' && rAnon.status === 401 && rBad.status === 404, { rB: rB.status, rAnon: rAnon.status, rBad: rBad.status });

const open = await interview('behavioral', [{ kind: 'main', topic: 'Teamwork', question: 'Kể về một lần bất đồng.', answer: 'Em đã trao đổi với nhóm.', scores: [6, 5, 6, 6, 5.8] }], { end: false });
const rOpen = await call('GET', `/api/report/${open}`, A.token);
expect('9. Session still in progress -> 409 SESSION_NOT_COMPLETED', rOpen.status === 409 && rOpen.body?.error?.code === 'SESSION_NOT_COMPLETED', rOpen);

const unscored = await interview('technical', [{ kind: 'main', topic: 'Git', question: 'Bạn dùng Git thế nào?', answer: 'Em dùng nhánh và pull request.' }]);
const usageBeforeUnscored = await aiCalls();
const rNone = await call('GET', `/api/report/${unscored}`, A.token);
expect('10. No scored answer -> 409 NO_SCORED_ANSWERS, no AI call',
  rNone.status === 409 && rNone.body?.error?.code === 'NO_SCORED_ANSWERS' && (await aiCalls()) === usageBeforeUnscored, rNone);

if (samplePath && r1.status === 200) {
  // Sample for the Report page: replace ids so nothing points at real rows.
  const sample = JSON.parse(JSON.stringify(rep).replaceAll(sid, '00000000-0000-4000-8000-000000000001'));
  if (sample.overview.trend) sample.overview.trend.previousSessionId = '00000000-0000-4000-8000-000000000000';
  writeFileSync(samplePath, `${JSON.stringify(sample, null, 2)}\n`);
  console.log(`\nSample response written to ${samplePath}`);
}

for (const id of created) await A.client.from('interview_sessions').delete().eq('id', id);
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
