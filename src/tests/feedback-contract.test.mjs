import test from 'node:test';
import assert from 'node:assert/strict';
import { context, validOutput } from './feedback-fixtures.mjs';

test('feedback computes overall from applicable criteria, excluding STAR for technical and HR', async () => {
  const { validateFeedback } = await import('../lib/feedback/contract.mjs');
  const behavioral = validateFeedback(validOutput(), context);
  assert.equal(behavioral.overallScore, 6.5);
  for (const type of ['technical', 'hr']) {
    const result = validateFeedback(validOutput(type), { ...context, type });
    assert.equal(result.overallScore, 6.7);
    assert.equal(result.scores.star.score, null);
    assert.equal(result.scores.star.applicable, false);
    assert.equal(result.confidenceBasis, 'text_estimated');
  }
});

test('feedback rejects invented evidence, invalid scores, extra fields and missing required scores', async () => {
  const { validateFeedback } = await import('../lib/feedback/contract.mjs');
  for (const mutate of [
    o => { o.scores.content.quotes = ['I reduced errors by 90%.']; },
    o => { o.scores.content.score = 11; },
    o => { o.scores.content.score = '8'; },
    o => { o.scores.clarity.score = null; },
    o => { o.overallScore = 10; },
    o => { o.improvements = []; },
    o => { o.scores.star.score = null; },
    o => { o.scores.content.reason = 'You are stupid'; },
    o => { o.outline.kind = 'key_points'; },
  ]) {
    const output = validOutput(); mutate(output);
    assert.throws(() => validateFeedback(output, context), { code: 'INVALID_OUTPUT' });
  }
});

test('a short vague answer can be scored using its actual words without inventing evidence', async () => {
  const { validateFeedback } = await import('../lib/feedback/contract.mjs');
  const output = validOutput();
  for (const criterion of Object.values(output.scores)) criterion.quotes = ['yes'];
  const result = validateFeedback(output, { ...context, answer: 'yes' });
  assert.equal(result.scores.content.quotes[0], 'yes');
});

test('feedback metadata is localized but evidence is preserved verbatim', async () => {
  const { validateFeedback } = await import('../lib/feedback/contract.mjs');
  const result = validateFeedback(validOutput(), { ...context, language: 'vi' });
  assert.match(result.labels.confidence, /văn bản/u);
  assert.match(result.disclaimer, /luyện tập/u);
  assert.equal(result.scores.content.quotes[0], 'I added validation and tests.');
});
