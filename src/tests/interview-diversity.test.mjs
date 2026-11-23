import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInterviewerInput, validateInterviewerOutput } from '../lib/interview/interviewer-contract.mjs';
import { planQuestion } from '../lib/interview/question-plan.mjs';
import { buildInterviewerRequest } from '../lib/interview/interviewer-prompt.mjs';
import { createNextService } from '../lib/interview/next-service.mjs';
import { createInterviewerProvider } from '../lib/interview/interviewer-provider.mjs';
import { withInterviewerLimit, AiLimitError } from '../lib/ai/daily-limit.mjs';
import { createTimingTrace } from '../lib/interview/timing-trace.mjs';

const props = 'How would you define TypeScript types for props in a React component?';
const git = 'How would you resolve a Git merge conflict when collaborating with a team?';
const turn = (question, topic) => ({ question, topic, kind: 'main', answer: 'I would implement it, check the result and review the change.' });
const inputFor = (history = [], language = 'en') => validateInterviewerInput({
  settings: { type: 'technical', difficulty: 'easy', language, targetPosition: 'Frontend Developer', durationMinutes: 15, plannedQuestions: 5 },
  state: { status: 'in_progress', elapsedSeconds: 30 },
  jdText: 'Required skills: React and TypeScript. Preferred skill: Git.',
  cvText: 'Built dashboards with React and TypeScript. Used Git for version control in a team project. Tested REST APIs with network failures.',
  history,
});
const decision = (question, action = 'next_topic', topic = 'React props') => ({ question, action, topic, reason: 'Explore a job-relevant angle.' });

for (const [language, original, paraphrase] of [
  ['en', props, 'How would you type the props of a React component using TypeScript?'],
  ['en', git, 'What steps would you take to resolve a merge conflict in Git?'],
  ['vi', 'Bạn sẽ khai báo kiểu cho props của component React bằng TypeScript như thế nào?', 'Với TypeScript, bạn định nghĩa kiểu props cho một React component ra sao?'],
  ['vi', 'Bạn sẽ tổ chức các nhánh (branch) và quy trình commit như thế nào khi làm việc nhóm với Git để hạn chế xung đột?', 'Bạn sẽ áp dụng chiến lược phân nhánh (branching strategy) như Git Flow hay GitHub Flow như thế nào trong một dự án React và TypeScript cùng team?'],
  ['en', 'How would you handle a merge conflict when collaborating with another developer on a feature branch in Git?', 'Can you describe a time when you had to resolve a complex version control conflict or failure while working in a team project using Git?'],
]) {
  test(`rejects paraphrased main question: ${language} ${paraphrase}`, () => {
    const input = inputFor([turn(original, 'React props')], language);
    assert.throws(() => validateInterviewerOutput(decision(paraphrase), input), error =>
      error.code === 'INVALID_OUTPUT' && error.validationReason === 'NEAR_DUPLICATE');
  });
}
test('a focused optional-props follow-up is allowed while an exact repeat is diagnosed', () => {
  const input = inputFor([turn(props, 'React props')]);
  const probe = decision('How would you make a React prop optional in TypeScript?', 'follow_up');
  assert.deepEqual(validateInterviewerOutput(probe, input), probe);
  assert.throws(() => validateInterviewerOutput(decision(props), input), error =>
    error.validationReason === 'EXACT_DUPLICATE');
});
test('exhausted short JD moves to unused CV evidence rather than selecting Git forever', () => {
  const plan = planQuestion(inputFor([turn(props, 'React props'), turn(git, 'Git merge conflict')]));
  assert.equal(plan.basis, 'cv');
  assert.equal(plan.jdFocus, null);
  assert.ok(plan.cvContext.includes('Tested REST APIs with network failures.'));
});
test('HR coverage chooses a new collaboration angle after motivation', () => {
  const input = inputFor([turn('Why are you interested in this role?', 'Motivation')]);
  input.settings.type = 'hr';
  assert.equal(planQuestion(input).angle, 'collaboration');
});
test('full-session question inventory survives beyond the four-turn memory window', () => {
  const history = [turn(props, 'React props'), turn(git, 'Git'),
    turn('How would you check an API response?', 'API'), turn('How would you test a form?', 'Forms'),
    turn('How would you protect a private API key?', 'Secrets')];
  const input = inputFor(history);
  const body = JSON.parse(buildInterviewerRequest(input).contents[0].parts[0].text);
  assert.ok(Array.isArray(body.askedQuestions), 'The model needs a full-session question inventory');
  assert.equal(body.askedQuestions.length, 5);
  assert.equal(body.askedQuestions[0].question, props);
  assert.ok(!Object.hasOwn(body.askedQuestions[0], 'answer'));
});
test('Gemini schema cannot choose end while one of five main questions remains', () => {
  const input = inputFor([turn(props, 'Props'), turn(git, 'Git'), turn('How would you test a form?', 'Forms'), turn('How would you show a loading state?', 'Loading')]);
  const schema = buildInterviewerRequest(input).generationConfig.responseJsonSchema;
  assert.deepEqual(schema.properties.action.enum, ['follow_up', 'next_topic']);
  assert.equal(schema.properties.question.type, 'string');
  const body = JSON.parse(buildInterviewerRequest(input).contents[0].parts[0].text);
  assert.equal(body.serverPolicy.remainingMainQuestions, 1);
});
test('a closing declaration cannot be persisted as the fifth interview question', () => {
  assert.throws(() => validateInterviewerOutput(decision('The planned questions are completed.', 'next_topic', 'end'), inputFor()),
    error => error.validationReason === 'NON_QUESTION');
});

const sessionId = '13300000-0000-4000-8000-000000000001';
const answerId = '13300000-0000-4000-8000-000000000002';
const token = '13300000-0000-4000-8000-000000000003';
function repository() {
  let saved = null, released = 0;
  const input = inputFor([turn(props, 'React props')]);
  return {
    async claim() {
      if (saved) return { kind: 'ready', response: saved };
      return { kind: 'claimed', token, session: {
        started_at: new Date(Date.now() - 30000).toISOString(), status: 'in_progress', round_type: 'technical', difficulty: 'easy', language: 'en', target_position: 'Frontend Developer', duration_minutes: 15, planned_questions: 5,
        jd_text: input.jdText, cv_text: input.cvText,
      }, questions: [{ position: 1, content: props, kind: 'main', topic: 'React props', answer: { content: input.history[0].answer } }] };
    },
    async finish(_request, _token, value) { saved = { action: value.action, question: { content: value.question, position: 2 } }; return saved; },
    async release() { released++; },
    get saved() { return saved; }, get released() { return released; },
  };
}
const envelope = value => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] });
for (const stream of [false, true]) {
  test(`${stream ? 'SSE' : 'JSON'} repairs one duplicate under the same reservation and counts each model call`, async () => {
    let calls = 0, counted = 0;
    const payloads = [], repo = repository();
    const provider = withInterviewerLimit(createInterviewerProvider({
      env: { GEMINI_API_KEY: 'offline-only', GEMINI_MODEL: 'test-model' },
      fetchImpl: async (url, options) => {
        payloads.push(JSON.parse(JSON.parse(options.body).contents[0].parts[0].text));
        const result = envelope(++calls === 1 ? decision(props) : decision('How would you handle an HTTP error in a dashboard?', 'next_topic', 'API errors'));
        return url.includes(':streamGenerateContent') ? new Response(`data: ${JSON.stringify(result)}\n\n`, { headers: { 'Content-Type': 'text/event-stream' } }) : Response.json(result);
      },
    }), async () => { counted++; });
    const next = createNextService({ repository: repo, provider });
    const body = { sessionId, afterAnswerId: answerId };
    let result;
    if (stream) { for await (const event of next.stream(body)) if (event.event === 'complete') result = event.data; }
    else result = await next(body);
    assert.equal(result.question.content, 'How would you handle an HTTP error in a dashboard?');
    assert.equal(calls, 2); assert.equal(counted, 2);
    assert.notDeepEqual(payloads[0], payloads[1], 'Repair must not blindly send the same prompt');
    assert.equal(payloads[1].repair.rejectedQuestion, props);
    assert.deepEqual(await next(body), result);
    assert.equal(calls, 2, 'Replay cannot call the model again');
    assert.equal(repo.released, 0);
  });
}
test('repeat-only provider stops after one repair and releases without persisting invalid output', async () => {
  let calls = 0; const repo = repository();
  const provider = createInterviewerProvider({ env: { GEMINI_API_KEY: 'offline-only', GEMINI_MODEL: 'test-model' }, fetchImpl: async () => { calls++; return Response.json(envelope(decision(props))); } });
  const next = createNextService({ repository: repo, provider });
  await assert.rejects(next({ sessionId, afterAnswerId: answerId }), { code: 'INVALID_OUTPUT' });
  assert.equal(calls, 2); assert.equal(repo.saved, null); assert.equal(repo.released, 1);
});
test('premature model end is repaired without ending the persisted session', async () => {
  let calls = 0; const repo = repository();
  const provider = createInterviewerProvider({ env: { GEMINI_API_KEY: 'offline-only', GEMINI_MODEL: 'test-model' }, fetchImpl: async () => {
    return Response.json(envelope(++calls === 1 ? decision(null, 'end', 'Closing') : decision('How would you handle an HTTP error?', 'next_topic', 'API errors')));
  } });
  const next = createNextService({ repository: repo, provider });
  const result = await next({ sessionId, afterAnswerId: answerId });
  assert.equal(result.action, 'next_topic'); assert.equal(calls, 2);
});
test('a disguised closing declaration is repaired into an actual interview question', async () => {
  let calls = 0; const repo = repository();
  const provider = createInterviewerProvider({ env: { GEMINI_API_KEY: 'offline-only', GEMINI_MODEL: 'test-model' }, fetchImpl: async () => {
    return Response.json(envelope(++calls === 1 ? decision('The planned questions are completed.', 'next_topic', 'end') : decision('How would you handle an HTTP error?', 'next_topic', 'API errors')));
  } });
  const result = await createNextService({ repository: repo, provider })({ sessionId, afterAnswerId: answerId });
  assert.equal(result.question.content, 'How would you handle an HTTP error?'); assert.equal(calls, 2);
});
test('timing exposes only an allowlisted validation reason, never raw rejected text', () => {
  const events = []; const trace = createTimingTrace(event => events.push(event));
  trace('validation_failed', 'INVALID_OUTPUT', 'EXACT_DUPLICATE');
  trace('failed', 'INVALID_OUTPUT', 'private CV or key must never be logged');
  assert.equal(events[0]?.validationReason, 'EXACT_DUPLICATE');
  assert.ok(!JSON.stringify(events).includes('private CV'));
});
test('repair cannot bypass the remaining daily allowance', async () => {
  let calls = 0, authorized = 0; const repo = repository();
  const provider = withInterviewerLimit(createInterviewerProvider({ env: { GEMINI_API_KEY: 'offline-only', GEMINI_MODEL: 'test-model' }, fetchImpl: async () => { calls++; return Response.json(envelope(decision(props))); } }),
    async () => { if (++authorized === 2) throw new AiLimitError('AI_DAILY_LIMIT'); });
  const next = createNextService({ repository: repo, provider });
  await assert.rejects(next({ sessionId, afterAnswerId: answerId }), { code: 'AI_DAILY_LIMIT' });
  assert.equal(calls, 1); assert.equal(repo.saved, null); assert.equal(repo.released, 1);
});
test('repair shares the original deadline instead of starting another 30-second wait', async () => {
  let calls = 0; const repo = repository();
  const provider = createInterviewerProvider({ env: { GEMINI_API_KEY: 'offline-only', GEMINI_MODEL: 'test-model' }, fetchImpl: async (_url, options) => {
    if (++calls === 1) return Response.json(envelope(decision(props)));
    return new Promise((_, reject) => {
      const watchdog = setTimeout(() => reject(new Error('Shared deadline was not enforced')), 500);
      const abort = () => { clearTimeout(watchdog); reject(new DOMException('Aborted', 'AbortError')); };
      if (options.signal.aborted) abort(); else options.signal.addEventListener('abort', abort, { once: true });
    });
  } });
  const next = createNextService({ repository: repo, provider, generationBudgetMs: 30 });
  await assert.rejects(next({ sessionId, afterAnswerId: answerId }), { code: 'AI_TIMEOUT' });
  assert.equal(calls, 2); assert.equal(repo.saved, null); assert.equal(repo.released, 1);
});
test('caller cancellation during repair releases the turn and does not persist', async () => {
  let calls = 0; const repo = repository(), abort = new AbortController();
  const provider = createInterviewerProvider({ env: { GEMINI_API_KEY: 'offline-only', GEMINI_MODEL: 'test-model' }, fetchImpl: async () => {
    if (++calls === 1) return Response.json(envelope(decision(props)));
    abort.abort(); throw new DOMException('Aborted', 'AbortError');
  } });
  const next = createNextService({ repository: repo, provider });
  await assert.rejects(next({ sessionId, afterAnswerId: answerId }, { signal: abort.signal }), { code: 'REQUEST_CANCELLED' });
  assert.equal(calls, 2); assert.equal(repo.saved, null); assert.equal(repo.released, 1);
});
