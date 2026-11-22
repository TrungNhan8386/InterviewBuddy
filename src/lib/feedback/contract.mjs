import rubric from '../../config/feedback-rubric.json' with { type: 'json' };
import { unsafeGeneratedText } from '../ai/guardrails.mjs';
import { isUuid } from '../interview/session-contract.mjs';

export class FeedbackError extends Error {
  constructor(code, status = 502) { super(code); this.name = 'FeedbackError'; this.code = code; this.status = status; }
}
const invalid = () => { throw new FeedbackError('INVALID_OUTPUT'); };
export const RUBRIC = rubric;
export const CRITERIA = Object.keys(rubric.criteria);
if (rubric.scale.min !== 0 || rubric.scale.max !== 10 || rubric.overallDecimals !== 1
    || CRITERIA.join(',') !== 'content,star,clarity,confidence'
    || !CRITERIA.every(k => Number.isFinite(rubric.criteria[k].weight) && rubric.criteria[k].weight > 0)) {
  throw new FeedbackError('AI_CONFIGURATION_ERROR', 503);
}
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value, names) => object(value) && Object.keys(value).length === names.length
  && names.every(name => Object.hasOwn(value, name));
const text = (value, max = 1500) => typeof value === 'string' && value.trim().length > 0
  && value.length <= max && !unsafeGeneratedText(value);
const texts = (value, min = 1, max = 6) => Array.isArray(value) && value.length >= min
  && value.length <= max && value.every(item => text(item));

export function validateFeedbackRequest(body) {
  if (!keys(body, ['answerId']) || !isUuid(body.answerId)) throw new FeedbackError('BAD_INPUT', 400);
  return { answerId: body.answerId };
}
export function validateFeedbackContext(value) {
  if (!object(value) || ![value.answerId, value.questionId, value.sessionId].every(isUuid)
      || !['behavioral', 'technical', 'hr'].includes(value.type) || !['en', 'vi'].includes(value.language)
      || typeof value.answer !== 'string' || !value.answer.trim() || value.answer.length > 12000
      || typeof value.question !== 'string' || !value.question.trim() || value.question.length > 3000
      || typeof value.jdText !== 'string' || value.jdText.length > 30000) {
    throw new FeedbackError('SESSION_CONTEXT_INVALID', 409);
  }
  return value;
}
const stringSchema = { type: 'string', minLength: 1, maxLength: 1500 };
const stringsSchema = { type: 'array', minItems: 1, maxItems: 6, items: stringSchema };
export function feedbackSchema(type) {
  const criterion = applicable => ({ type: 'object', additionalProperties: false,
    required: ['score', 'reason', 'quotes'], properties: {
      score: applicable ? { type: 'integer', minimum: 0, maximum: 10 } : { type: 'null' },
      reason: applicable ? stringSchema : { type: 'null' },
      quotes: { type: 'array', minItems: applicable ? 1 : 0, maxItems: applicable ? 3 : 0, items: { type: 'string', minLength: 1, maxLength: 1200 } },
    } });
  return { type: 'object', additionalProperties: false, required: ['scores', 'strengths', 'improvements', 'outline'], properties: {
    scores: { type: 'object', additionalProperties: false, required: CRITERIA,
      properties: Object.fromEntries(CRITERIA.map(k => [k, criterion(k !== 'star' || type === 'behavioral')])) },
    strengths: stringsSchema, improvements: stringsSchema,
    outline: { type: 'object', additionalProperties: false, required: ['kind', 'sections'], properties: {
      kind: { type: 'string', enum: [type === 'behavioral' ? 'star' : 'key_points'] },
      sections: { type: 'array', minItems: type === 'behavioral' ? 4 : 1, maxItems: type === 'behavioral' ? 4 : 6,
        items: { type: 'object', additionalProperties: false, required: ['label', 'guidance'], properties: { label: { type: 'string', minLength: 1, maxLength: 100 }, guidance: stringSchema } } },
    } },
  } };
}

// Runtime counterpart to feedbackSchema. Provider-side JSON constraints do not
// establish factual grounding: every quote must also occur in this saved answer.
export function validateFeedback(output, value) {
  const context = validateFeedbackContext(value);
  if (!keys(output, ['scores', 'strengths', 'improvements', 'outline'])
      || !keys(output.scores, CRITERIA) || !texts(output.strengths) || !texts(output.improvements)
      || !keys(output.outline, ['kind', 'sections'])) invalid();
  let sum = 0; let weights = 0;
  const scores = {};
  for (const key of CRITERIA) {
    const item = output.scores[key];
    const applicable = key !== 'star' || context.type === 'behavioral';
    if (!keys(item, ['score', 'reason', 'quotes'])) invalid();
    if (!applicable) {
      if (item.score !== null || item.reason !== null || !Array.isArray(item.quotes) || item.quotes.length !== 0) invalid();
    } else {
      if (!Number.isInteger(item.score) || item.score < 0 || item.score > 10 || !text(item.reason)
          || !Array.isArray(item.quotes) || item.quotes.length < 1 || item.quotes.length > 3
          || !item.quotes.every(q => typeof q === 'string' && q.trim() && q.length <= 1200 && context.answer.includes(q))) invalid();
      sum += item.score * rubric.criteria[key].weight;
      weights += rubric.criteria[key].weight;
    }
    scores[key] = { ...item, applicable };
  }
  const sections = output.outline.sections;
  const behavioral = context.type === 'behavioral';
  if (output.outline.kind !== (behavioral ? 'star' : 'key_points') || !Array.isArray(sections)
      || sections.length < (behavioral ? 4 : 1) || sections.length > (behavioral ? 4 : 6)
      || !sections.every(s => keys(s, ['label', 'guidance']) && text(s.label, 100) && text(s.guidance))) invalid();
  return {
    schemaVersion: 'uc08-feedback-v1', rubricVersion: rubric.version,
    language: context.language, questionType: context.type, confidenceBasis: 'text_estimated',
    scores, overallScore: Math.round(sum / weights * 10) / 10,
    strengths: [...output.strengths], improvements: [...output.improvements],
    outline: { kind: output.outline.kind, sections: sections.map(s => ({ ...s })) },
    labels: { ...rubric.labels[context.language] }, disclaimer: rubric.disclaimer[context.language],
  };
}
