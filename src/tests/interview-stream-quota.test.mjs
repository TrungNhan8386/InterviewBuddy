import test from 'node:test';
import assert from 'node:assert/strict';
import { withInterviewerLimit, AiLimitError } from '../lib/ai/daily-limit.mjs';
import { createInterviewerProvider } from '../lib/interview/interviewer-provider.mjs';
import { interviewerFixtures } from '../lib/interview/interviewer-fixtures.mjs';

const input = structuredClone(interviewerFixtures[0].input);
async function collect(stream) { const events = []; for await (const event of stream) events.push(event); return events; }
const decision = { action: 'follow_up', question: 'Bạn sẽ kiểm thử request bị hủy thế nào?', topic: input.history.at(-1).topic, reason: 'Làm rõ cách kiểm thử.' };
function provider(onFetch) {
  return createInterviewerProvider({ env: { GEMINI_API_KEY: 'offline-only', GEMINI_MODEL: 'offline' }, fetchImpl: async () => {
    onFetch();
    return new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode('data: ' + JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(decision) }] } }] }) + '\n\n'));
      controller.close();
    } }), { headers: { 'Content-Type': 'text/event-stream' } });
  } });
}

test('streaming cannot bypass the per-user daily quota', async () => {
  const limited = withInterviewerLimit(provider(() => assert.fail('A denied quota must block the external request')),
    async () => { throw new AiLimitError('AI_DAILY_LIMIT'); });
  await assert.rejects(collect(limited.stream(input)), { code: 'AI_DAILY_LIMIT', status: 429 });
});

test('one streamed generation consumes one allowance before contacting Gemini', async () => {
  const order = [];
  const limited = withInterviewerLimit(provider(() => order.push('upstream')), async () => order.push('consume'));
  const events = await collect(limited.stream(input));
  assert.deepEqual(events.at(-1).value, decision);
  assert.deepEqual(order, ['consume', 'upstream']);
});

test('missing quota RPC fails closed for streaming as well as JSON', async () => {
  const limited = withInterviewerLimit(provider(() => assert.fail('A missing quota RPC must block the external request')),
    async () => { throw new AiLimitError('DATABASE_NOT_READY'); });
  await assert.rejects(collect(limited.stream(input)), { code: 'DATABASE_NOT_READY', status: 503 });
});

test('terminal or cancelled stream turns consume no allowance and make no external call', async () => {
  const limited = withInterviewerLimit(provider(() => assert.fail('No upstream call expected')), async () => assert.fail('No quota should be charged'));
  const events = await collect(limited.stream({ ...input, state: { ...input.state, status: 'completed' } }));
  assert.equal(events.at(-1).value.action, 'end');
  const controller = new AbortController(); controller.abort();
  await assert.rejects(collect(limited.stream(input, { signal: controller.signal })), { code: 'REQUEST_CANCELLED' });
});
