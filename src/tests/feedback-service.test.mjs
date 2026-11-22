import test from 'node:test';
import assert from 'node:assert/strict';
import { answerId, context, validOutput } from './feedback-fixtures.mjs';
import { FeedbackError } from '../lib/feedback/contract.mjs';
import { AiLimitError } from '../lib/ai/daily-limit.mjs';

function setup({ generate = async () => validOutput(), claim, finish, consume = async () => {} } = {}) {
  const effects = { calls: 0, consumed: 0, saved: 0, released: 0, signals: [] };
  const repository = {
    claim: claim ?? (async () => ({ kind: 'claimed', token: answerId, context })),
    finish: finish ?? (async (_id, _token, feedback) => { effects.saved++; return { feedback: { id: answerId, answerId, ...feedback } }; }),
    release: async () => { effects.released++; },
    read: async () => ({ feedback: null }),
  };
  const provider = { model: 'test-model', generate: async (...args) => {
    effects.calls++; effects.signals.push(args[1].signal); return generate(...args);
  } };
  return { effects, repository, provider, consume: async () => { effects.consumed++; return consume(); } };
}

test('evaluation retries invalid JSON/schema/evidence once under one signal and counts both calls', async () => {
  const { createFeedbackService } = await import('../lib/feedback/service.mjs');
  let attempt = 0;
  const state = setup({ generate: async (_ctx, options) => {
    if (++attempt === 1) { const bad = validOutput(); bad.scores.content.quotes = ['invented']; return bad; }
    assert.equal(options.repairReason, 'INVALID_OUTPUT'); return validOutput();
  } });
  const result = await createFeedbackService(state).evaluate({ answerId });
  assert.equal(result.feedback.overallScore, 6.5);
  assert.equal(state.effects.calls, 2); assert.equal(state.effects.consumed, 2);
  assert.equal(state.effects.saved, 1); assert.equal(state.effects.released, 0);
  assert.equal(state.effects.signals[0], state.effects.signals[1]);
});

test('persistent invalid output releases the reservation and never saves a score', async () => {
  const { createFeedbackService } = await import('../lib/feedback/service.mjs');
  const state = setup({ generate: async () => ({ scores: {} }) });
  await assert.rejects(createFeedbackService(state).evaluate({ answerId }), { code: 'INVALID_OUTPUT' });
  assert.equal(state.effects.calls, 2); assert.equal(state.effects.saved, 0); assert.equal(state.effects.released, 1);
});

test('cache replay and busy reservations never consume AI quota', async () => {
  const { createFeedbackService } = await import('../lib/feedback/service.mjs');
  const cached = setup({ claim: async () => ({ kind: 'ready', response: { feedback: { id: answerId }, alreadySaved: true } }) });
  assert.equal((await createFeedbackService(cached).evaluate({ answerId })).alreadySaved, true);
  assert.equal(cached.effects.calls, 0); assert.equal(cached.effects.consumed, 0);
  const busy = setup({ claim: async () => ({ kind: 'busy' }) });
  await assert.rejects(createFeedbackService(busy).evaluate({ answerId }), { code: 'GENERATION_IN_PROGRESS' });
  assert.equal(busy.effects.consumed, 0);
});

test('quota, safety, configuration and timeout do not cause blind retries', async () => {
  const { createFeedbackService } = await import('../lib/feedback/service.mjs');
  for (const code of ['AI_CONTENT_BLOCKED', 'AI_CONFIGURATION_ERROR', 'AI_RATE_LIMITED', 'AI_TIMEOUT']) {
    const state = setup({ generate: async () => { throw new FeedbackError(code); } });
    await assert.rejects(createFeedbackService(state).evaluate({ answerId }), { code });
    assert.equal(state.effects.calls, 1); assert.equal(state.effects.released, 1);
  }
  const state = setup({ consume: async () => { throw new AiLimitError('AI_DAILY_LIMIT'); } });
  await assert.rejects(createFeedbackService(state).evaluate({ answerId }), { code: 'AI_DAILY_LIMIT' });
  assert.equal(state.effects.calls, 0);
});

test('an uncertain persistence acknowledgement keeps the lease; saved feedback is not regenerated immediately', async () => {
  const { createFeedbackService } = await import('../lib/feedback/service.mjs');
  const state = setup({ finish: async () => { throw new FeedbackError('SERVER_ERROR', 500); } });
  await assert.rejects(createFeedbackService(state).evaluate({ answerId }), { code: 'SERVER_ERROR' });
  assert.equal(state.effects.released, 0);
});

test('invalid request and cancelled request cannot start generation', async () => {
  const { createFeedbackService } = await import('../lib/feedback/service.mjs');
  const state = setup(); const service = createFeedbackService(state);
  await assert.rejects(service.evaluate({ answerId, answer: 'forged' }), { code: 'BAD_INPUT' });
  await assert.rejects(service.evaluate({ answerId }, { signal: AbortSignal.abort() }), { code: 'REQUEST_CANCELLED' });
  assert.equal(state.effects.calls, 0);
});

test('reading and replaying saved feedback remain available when AI timeout configuration is invalid', async () => {
  const { createFeedbackService } = await import('../lib/feedback/service.mjs');
  const state = setup({ claim: async () => ({ kind: 'ready', response: { feedback: { id: answerId }, alreadySaved: true } }) });
  const service = createFeedbackService({ ...state, timeoutMs: NaN });
  assert.equal((await service.read({ answerId })).feedback, null);
  assert.equal((await service.evaluate({ answerId })).feedback.id, answerId);
  assert.equal(state.effects.calls, 0);
});
