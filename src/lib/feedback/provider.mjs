import prompt from '../../config/prompts/feedback.json' with { type: 'json' };
import { DEFAULT_MODEL } from '../analysis/gemini.mjs';
import { GEMINI_SAFETY_SETTINGS, providerContentBlocked } from '../ai/guardrails.mjs';
import { FeedbackError, RUBRIC, feedbackSchema, validateFeedbackContext } from './contract.mjs';

export const FEEDBACK_PROMPT_VERSION = prompt.version;
export function createFeedbackProvider({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const model = env.GEMINI_FEEDBACK_MODEL?.trim() || env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  return { model, async generate(value, { signal, repairReason } = {}) {
    const context = validateFeedbackContext(value);
    const key = env.GEMINI_API_KEY?.trim();
    if (!key) throw new FeedbackError('AI_NOT_CONFIGURED', 503);
    if (!/^[a-zA-Z0-9._-]{1,100}$/u.test(model)) throw new FeedbackError('AI_CONFIGURATION_ERROR', 503);
    const lifetime = signal ?? AbortSignal.timeout(10000);
    try {
      const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', redirect: 'error', signal: lifetime,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          safetySettings: GEMINI_SAFETY_SETTINGS,
          systemInstruction: { parts: [{ text: [...prompt.system, ...prompt.languageRules[context.language]].join('\n') }] },
          contents: [{ role: 'user', parts: [{ text: JSON.stringify({
            rubric: RUBRIC, questionType: context.type, language: context.language,
            targetPosition: context.targetPosition, difficulty: context.difficulty,
            question: context.question, answer: context.answer, jdText: context.jdText,
            ...(repairReason ? { repairReason } : {}),
          }) }] }],
          generationConfig: { responseMimeType: 'application/json', responseJsonSchema: feedbackSchema(context.type),
            temperature: 0.1, maxOutputTokens: 4096 },
        }),
      });
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 429) throw new FeedbackError('AI_RATE_LIMITED', 429);
        if ([400, 401, 403, 404].includes(response.status)) throw new FeedbackError('AI_CONFIGURATION_ERROR', 503);
        throw new FeedbackError('AI_UNAVAILABLE');
      }
      const envelope = await response.json();
      const candidate = envelope?.candidates?.[0];
      if (envelope?.promptFeedback?.blockReason || providerContentBlocked(candidate?.finishReason)) {
        throw new FeedbackError('AI_CONTENT_BLOCKED', 422);
      }
      if (candidate?.finishReason !== 'STOP' || !Array.isArray(candidate.content?.parts)) throw new FeedbackError('INVALID_OUTPUT');
      const raw = candidate.content.parts.filter(p => !p.thought && typeof p.text === 'string').map(p => p.text).join('');
      if (!raw || raw.length > 60000) throw new FeedbackError('INVALID_OUTPUT');
      return JSON.parse(raw);
    } catch (error) {
      if (error instanceof FeedbackError) throw error;
      if (lifetime.aborted) throw new FeedbackError(lifetime.reason?.name === 'TimeoutError' ? 'AI_TIMEOUT' : 'REQUEST_CANCELLED', lifetime.reason?.name === 'TimeoutError' ? 504 : 408);
      if (error instanceof SyntaxError) throw new FeedbackError('INVALID_OUTPUT');
      throw new FeedbackError('AI_UNAVAILABLE');
    }
  } };
}
