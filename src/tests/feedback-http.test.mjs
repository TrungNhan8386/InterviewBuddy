import test from 'node:test';
import assert from 'node:assert/strict';
import { answerId } from './feedback-fixtures.mjs';
import { FeedbackError } from '../lib/feedback/contract.mjs';
const request = (body, options = {}) => new Request('http://local/api/evaluate-answer', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...options.headers },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});
test('feedback HTTP requires authentication and bounds JSON before entering the service', async () => {
  const { createFeedbackHandlers } = await import('../lib/feedback/http.mjs');
  let calls = 0;
  const makeService = () => ({ evaluate: async () => { calls++; return {}; } });
  const unauth = createFeedbackHandlers({ authenticate: async () => null, makeService });
  assert.equal((await unauth.POST(request({ answerId }))).status, 401);
  const handlers = createFeedbackHandlers({ authenticate: async () => ({}), makeService });
  for (const input of [request('{bad'), request({ answerId, answer: 'forged' }), request({ answerId: 'bad' }),
    request(' '.repeat(2100), { headers: { 'Content-Length': '1' } }), request({ answerId }, { headers: { 'Content-Type': 'text/plain' } })]) {
    assert.equal((await handlers.POST(input)).status, 400);
  }
  assert.equal(calls, 0);
});
test('feedback HTTP returns persisted JSON with no-store and GET never generates', async () => {
  const { createFeedbackHandlers } = await import('../lib/feedback/http.mjs');
  const handlers = createFeedbackHandlers({ authenticate: async () => ({}), makeService: () => ({
    evaluate: async body => ({ feedback: { answerId: body.answerId, overallScore: 6.5 }, alreadySaved: false }),
    read: async body => ({ feedback: { answerId: body.answerId }, state: 'ready' }),
  }) });
  const post = await handlers.POST(request({ answerId }));
  assert.equal(post.status, 201); assert.equal(post.headers.get('Cache-Control'), 'no-store');
  assert.equal((await post.json()).feedback.overallScore, 6.5);
  const get = await handlers.GET(new Request(`http://local/api/evaluate-answer?answerId=${answerId}`));
  assert.equal(get.status, 200); assert.equal((await get.json()).state, 'ready');
});
test('feedback HTTP hides unexpected errors and reports only safe timing metadata', async () => {
  const { createFeedbackHandlers } = await import('../lib/feedback/http.mjs');
  const timing = [];
  for (const error of [new Error('PRIVATE KEY AND ANSWER'), new FeedbackError('INVALID_OUTPUT')]) {
    const handlers = createFeedbackHandlers({ authenticate: async () => ({}), observeTiming: e => timing.push(e),
      makeService: () => ({ evaluate: async () => { throw error; } }) });
    const response = await handlers.POST(request({ answerId }));
    assert.equal(response.status, error instanceof FeedbackError ? 502 : 500);
    assert.ok(!(await response.text()).includes('PRIVATE'));
  }
  assert.equal(JSON.stringify(timing).includes(answerId), false);
  assert.ok(timing.every(e => Number.isFinite(e.elapsedMs)));
});
