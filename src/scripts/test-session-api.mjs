// End-to-end test of the Interview Session API (SCRUM-56, SCRUM-57) and of
// answer saving, resume and the daily AI limit (SCRUM-80, -81, -82) against a
// running app and the real Supabase project, signed in as the two seed users.
// No Gemini call is made: test questions are inserted directly as the user.
//
//   npm run seed                 (once)
//   npm run dev                  (in another terminal)
//   npm run test:session-api     (or API_BASE_URL=https://<staging> npm run test:session-api)
//
// Needs in .env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
// SEED_USER_PASSWORD. Sessions created by the test are deleted at the end.

import { createClient } from '@supabase/supabase-js';

const base = (process.env.API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const password = process.env.SEED_USER_PASSWORD;
if (!url || !anonKey || !password) {
  console.error('✗ Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SEED_USER_PASSWORD in .env.local.');
  process.exit(1);
}

const SEED_ANALYSIS = { A: '00000000-0000-4000-8000-00000000a001', B: '00000000-0000-4000-8000-00000000b001' };

async function signIn(email) {
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    console.error(`✗ Cannot sign in as ${email}: ${error.message}. Did you run "npm run seed"?`);
    process.exit(1);
  }
  return { client, token: data.session.access_token };
}

async function call(method, path, { token, body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const results = [];
function expect(name, condition, detail) {
  results.push({ name, pass: Boolean(condition) });
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${condition ? '' : `  -> ${JSON.stringify(detail)}`}`);
}

const settings = {
  type: 'technical', difficulty: 'medium', language: 'vi', targetPosition: 'Frontend Intern',
  interviewDate: null, durationMinutes: 30, inputMode: 'text',
};

console.log(`Testing ${base}/api/interview\n`);
const A = await signIn('candidate.a@interviewbuddy.test');
const B = await signIn('candidate.b@interviewbuddy.test');
const created = [];

// 1. Create a session: 201 + sessionId, latest analysis linked automatically.
// Teammates may have saved newer analyses for A, so read A's latest one first.
const latestA = (await A.client.from('fit_analyses').select('id').order('created_at', { ascending: false }).limit(1).maybeSingle()).data?.id ?? SEED_ANALYSIS.A;
const r1 = await call('POST', '/api/interview', { token: A.token, body: settings });
expect('1. A creates a session -> 201 with sessionId', r1.status === 201 && r1.body?.sessionId, r1);
expect('   latest saved analysis is linked (UC-05 step 13)', r1.body?.fitAnalysisId === latestA, r1.body);
if (r1.body?.sessionId) created.push(r1.body.sessionId);

// 2. Missing / invalid fields: 400 with the field names.
const missing = { ...settings };
delete missing.targetPosition;
const r2 = await call('POST', '/api/interview', { token: A.token, body: { ...missing, durationMinutes: 20 } });
expect('2. Missing targetPosition, bad duration -> 400 BAD_INPUT',
  r2.status === 400 && r2.body?.error?.code === 'BAD_INPUT'
  && r2.body.error.fields?.targetPosition && r2.body.error.fields?.durationMinutes, r2);

// 3. Not signed in: 401 for both endpoints.
const r3a = await call('POST', '/api/interview', { body: settings });
const r3b = await call('GET', `/api/interview/${r1.body?.sessionId}`);
expect('3. Not signed in -> 401 (POST and GET)', r3a.status === 401 && r3b.status === 401, { r3a, r3b });

// 4. Cross-user access: B cannot read A's session.
const r4 = await call('GET', `/api/interview/${r1.body?.sessionId}`, { token: B.token });
expect("4. B reads A's session -> 404", r4.status === 404 && r4.body?.error?.code === 'NOT_FOUND', r4);

// Extra checks.
const r5 = await call('GET', `/api/interview/${r1.body?.sessionId}`, { token: A.token });
expect('5. A reads own session -> 200 with settings and analysis',
  r5.status === 200 && r5.body?.settings?.durationMinutes === 30 && r5.body?.settings?.plannedQuestions === 8
  && r5.body?.analysis?.id === latestA && typeof r5.body?.analysis?.fitScore === 'number', r5);

const r6 = await call('POST', '/api/interview', { token: B.token, body: { ...settings, fitAnalysisId: SEED_ANALYSIS.A } });
expect("6. B links A's analysis -> 400 (analysis not found)",
  r6.status === 400 && r6.body?.error?.fields?.fitAnalysisId, r6);
if (r6.body?.sessionId) created.push(r6.body.sessionId);

const r7 = await call('POST', '/api/interview', { token: A.token, body: { ...settings, fitAnalysisId: null } });
if (r7.body?.sessionId) created.push(r7.body.sessionId);
const r7get = r7.body?.sessionId && await call('GET', `/api/interview/${r7.body.sessionId}`, { token: A.token });
expect('7. fitAnalysisId: null -> session without analysis', r7.status === 201 && r7get?.body?.analysis === null, { r7, r7get });

const r8 = await call('GET', '/api/interview/not-a-uuid', { token: A.token });
expect('8. Invalid id -> 404', r8.status === 404, r8);

// --- SCRUM-80: save answers and resume -------------------------------------
const sid = r1.body?.sessionId;
const addQuestion = async (position) => (await A.client.from('questions')
  .insert({ session_id: sid, position, kind: 'main', topic: 'React', content: 'Kể về một dự án React của bạn.' })
  .select('id').single()).data?.id;
const q1 = await addQuestion(1);

const r9 = await call('GET', `/api/interview/${sid}`, { token: A.token });
expect('9. Resume with an unanswered question -> awaiting_answer',
  r9.body?.resume?.state === 'awaiting_answer' && r9.body.resume.questionId === q1
  && r9.body.turns?.length === 1 && r9.body.turns[0].answer === null && r9.body.startedAt, r9.body);

const answerBody = { questionId: q1, content: 'Em làm ứng dụng quản lý công việc bằng React và REST API.', inputMode: 'text' };
const r10 = await call('POST', `/api/interview/${sid}/answers`, { token: A.token, body: answerBody });
const r10again = await call('POST', `/api/interview/${sid}/answers`, { token: A.token, body: answerBody });
expect('10. Save answer -> 201; sending it again -> 200 with the same answer',
  r10.status === 201 && r10.body?.alreadySaved === false && r10again.status === 200
  && r10again.body?.alreadySaved === true && r10again.body.answer?.id === r10.body.answer?.id, { r10, r10again });

const r11 = await call('GET', `/api/interview/${sid}`, { token: A.token });
expect('11. Resume after answering -> awaiting_question with afterAnswerId',
  r11.body?.resume?.state === 'awaiting_question' && r11.body.resume.afterAnswerId === r10.body?.answer?.id
  && r11.body.turns?.[0]?.answer?.content === answerBody.content
  && r11.body.progress?.mainQuestionsAnswered === 1 && r11.body.progress?.plannedQuestions === 8, r11.body);

const r10edit = await call('POST', `/api/interview/${sid}/answers`, { token: A.token, body: { ...answerBody, content: 'Edited after a lost response.' } });
expect('10b. Resend with different text -> 409 ANSWER_CONFLICT (saved answer kept)',
  r10edit.status === 409 && r10edit.body?.error?.code === 'ANSWER_CONFLICT', r10edit);

const r12 = await call('POST', `/api/interview/${sid}/answers`, { token: A.token, body: { questionId: q1, content: '  ', extra: 1 } });
expect('12. Invalid answer -> 400 with field names',
  r12.status === 400 && r12.body?.error?.fields?.content && r12.body.error.fields.extra, r12);

// --- SCRUM-82: cross-user checks on the new tables and endpoints ------------
const q2 = await addQuestion(2);
const r13 = await call('POST', `/api/interview/${sid}/answers`, { token: B.token, body: { questionId: q2, content: 'B writes into A' } });
const bAnswers = await B.client.from('answers').select('id').eq('question_id', q1);
const bGenerations = await B.client.from('interview_next_generations').select('session_id').eq('session_id', sid);
const bUsage = await B.client.from('ai_usage_daily').select('user_id');
const bId = (await B.client.auth.getUser()).data.user?.id;
expect("13. B cannot answer, read A's answers, A's generations or A's AI count",
  r13.status === 404 && !bAnswers.error && bAnswers.data.length === 0
  && !bGenerations.error && bGenerations.data.length === 0
  && !bUsage.error && bUsage.data.every((row) => row.user_id === bId),
  { r13, bAnswers, bGenerations, bUsage });
const bWrite = await B.client.from('ai_usage_daily').insert({ user_id: bId, usage_date: '2099-01-01', calls: 0 });
expect('14. A user cannot write the AI usage table directly', Boolean(bWrite.error), bWrite);

// --- End interview ----------------------------------------------------------
const r15 = await call('POST', `/api/interview/${sid}/end`, { token: A.token });
const r15b = await call('POST', `/api/interview/${sid}/end`, { token: B.token });
expect('15. A ends the interview -> completed; B cannot end it',
  r15.status === 200 && r15.body?.status === 'completed' && r15.body.endedAt && r15b.status === 404, { r15, r15b });

const r16 = await call('POST', `/api/interview/${sid}/answers`, { token: A.token, body: { questionId: q2, content: 'Too late' } });
const r16get = await call('GET', `/api/interview/${sid}`, { token: A.token });
expect('16. Answer after the end -> 409 SESSION_CLOSED; resume -> finished',
  r16.status === 409 && r16.body?.error?.code === 'SESSION_CLOSED' && r16get.body?.resume?.state === 'finished', { r16, r16get: r16get.body?.resume });

const r17 = await call('POST', '/api/interview/next', { token: A.token, body: { sessionId: sid, afterAnswerId: r10.body?.answer?.id ?? null } });
expect('17. /api/interview/next on an ended session -> action end (no AI call)',
  r17.status === 200 && r17.body?.action === 'end' && r17.body.question === null, r17);

// --- SCRUM-81: analysis needs sign-in (no AI call is made) -------------------
const r18 = await call('POST', '/api/analyze-fit', { body: { jd: 'x', cv: 'y' } });
expect('18. /api/analyze-fit without sign-in -> 401', r18.status === 401 && r18.body?.error?.code === 'UNAUTHORIZED', r18);

// Clean up the sessions this test created (RLS lets each owner delete their own).
for (const id of created) {
  await A.client.from('interview_sessions').delete().eq('id', id);
}

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
