import test from 'node:test';
import assert from 'node:assert/strict';
import { context, validOutput } from './feedback-fixtures.mjs';
const env = { GEMINI_API_KEY: 'test-only-not-a-secret', GEMINI_MODEL: 'gemini-3.5-flash-lite' };
function envelope(value, finishReason = 'STOP') {
  return { candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(value) }] } }] };
}
test('Gemini request includes rubric, selected language, JSON schema and server context as untrusted data', async () => {
  const { createFeedbackProvider } = await import('../lib/feedback/provider.mjs');
  const provider = createFeedbackProvider({ env, fetchImpl: async (url, init) => {
    assert.match(url, /^https:\/\/generativelanguage.googleapis.com\//u);
    assert.equal(init.headers['x-goog-api-key'], env.GEMINI_API_KEY);
    assert.equal(init.redirect, 'error');
    const body = JSON.parse(init.body);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.deepEqual(body.generationConfig.responseJsonSchema.properties.outline.properties.kind.enum, ['star']);
    assert.match(body.systemInstruction.parts[0].text, /English/u);
    assert.match(body.systemInstruction.parts[0].text, /untrusted/u);
    assert.match(body.contents[0].parts[0].text, /Our release was late/u);
    return Response.json(envelope(validOutput()));
  } });
  assert.equal((await provider.generate(context)).scores.content.score, 8);
});
test('provider maps failures without echoing private upstream bodies', async () => {
  const { createFeedbackProvider } = await import('../lib/feedback/provider.mjs');
  const cases = [
    [() => new Response('PRIVATE PROVIDER BODY', { status: 429 }), 'AI_RATE_LIMITED'],
    [() => new Response('PRIVATE PROVIDER BODY', { status: 500 }), 'AI_UNAVAILABLE'],
    [() => Response.json({ promptFeedback: { blockReason: 'SAFETY' } }), 'AI_CONTENT_BLOCKED'],
    [() => Response.json(envelope(validOutput(), 'SAFETY')), 'AI_CONTENT_BLOCKED'],
    [() => Response.json(envelope(validOutput(), 'MAX_TOKENS')), 'INVALID_OUTPUT'],
    [() => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{bad' }] } }] }), 'INVALID_OUTPUT'],
  ];
  for (const [response, code] of cases) {
    const provider = createFeedbackProvider({ env, fetchImpl: async () => response() });
    await assert.rejects(provider.generate(context), error => error.code === code && !error.message.includes('PRIVATE'));
  }
});
