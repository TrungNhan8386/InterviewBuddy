// Gemini call that writes the targeted practice questions (UC-10 step 2–3,
// SCRUM-178). Server only: the only practice code that uses the key.
// Same request style and error codes as the report summary (report-summary.mjs).
import { DEFAULT_MODEL } from '../analysis/gemini.mjs';
import { GEMINI_SAFETY_SETTINGS, providerContentBlocked, unsafeGeneratedText } from '../ai/guardrails.mjs';
import { PRACTICE_SCHEMA, practicePromptText, validatePracticeOutput } from './practice-builder.mjs';

export class PracticeAiError extends Error {
  constructor(code) {
    super(code);
    this.name = 'PracticeAiError';
    this.code = code; // AI_NOT_CONFIGURED | AI_CONFIGURATION_ERROR | AI_RATE_LIMITED | AI_CONTENT_BLOCKED | AI_TIMEOUT | INVALID_OUTPUT | AI_UNAVAILABLE
  }
}

export function buildPracticeRequest(input) {
  return {
    systemInstruction: { parts: [{ text: practicePromptText(input.language) }] },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(input) }] }],
    safetySettings: GEMINI_SAFETY_SETTINGS,
    generationConfig: { responseMimeType: 'application/json', responseJsonSchema: PRACTICE_SCHEMA, maxOutputTokens: 4096 },
  };
}

export function createPracticeProvider({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const model = env.GEMINI_PRACTICE_MODEL?.trim() || env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  return {
    model,
    /** Returns validated groups [{ criterion, questions: [{ question, tip }] }]. */
    async generate(input, { signal } = {}) {
      const apiKey = env.GEMINI_API_KEY?.trim();
      if (!apiKey) throw new PracticeAiError('AI_NOT_CONFIGURED');
      const timeoutMs = Number(env.GEMINI_TIMEOUT_MS || 30000);
      if (!/^[a-zA-Z0-9._-]{1,100}$/u.test(model) || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 45000) {
        throw new PracticeAiError('AI_CONFIGURATION_ERROR');
      }
      const timeout = AbortSignal.timeout(timeoutMs);
      const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
      try {
        const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST', redirect: 'error', signal: combined,
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(buildPracticeRequest(input)),
        });
        if (!response.ok) {
          // Provider error bodies may echo the input; never forward them.
          await response.body?.cancel();
          if (response.status === 429) throw new PracticeAiError('AI_RATE_LIMITED');
          if ([400, 401, 403, 404].includes(response.status)) throw new PracticeAiError('AI_CONFIGURATION_ERROR');
          throw new PracticeAiError('AI_UNAVAILABLE');
        }
        const envelope = await response.json();
        const candidate = envelope?.candidates?.[0];
        if (envelope?.promptFeedback?.blockReason || providerContentBlocked(candidate?.finishReason)) {
          throw new PracticeAiError('AI_CONTENT_BLOCKED');
        }
        if (candidate?.finishReason !== 'STOP' || !Array.isArray(candidate.content?.parts)) throw new PracticeAiError('INVALID_OUTPUT');
        const text = candidate.content.parts.filter((p) => p && !p.thought && typeof p.text === 'string').map((p) => p.text).join('');
        if (!text || text.length > 30000) throw new PracticeAiError('INVALID_OUTPUT');
        const groups = validatePracticeOutput(JSON.parse(text), input.focus, input.askedQuestions);
        if (!groups || groups.some((g) => g.questions.some((q) => unsafeGeneratedText(q.question) || (q.tip && unsafeGeneratedText(q.tip))))) {
          throw new PracticeAiError('INVALID_OUTPUT');
        }
        return groups;
      } catch (error) {
        if (error instanceof PracticeAiError) throw error;
        if (timeout.aborted) throw new PracticeAiError('AI_TIMEOUT');
        if (error instanceof SyntaxError) throw new PracticeAiError('INVALID_OUTPUT');
        throw new PracticeAiError('AI_UNAVAILABLE');
      }
    },
  };
}
