// Gemini call that writes the strengths and areas to improve of a whole session
// (UC-09 step 5, SCRUM-190). Server only: the only code here that uses the key.
// No automatic retry: the report is still returned without the summary on error.
import { DEFAULT_MODEL } from '../analysis/gemini.mjs';
import { GEMINI_SAFETY_SETTINGS, providerContentBlocked, unsafeGeneratedText } from '../ai/guardrails.mjs';
import { REPORT_PROMPT_CONFIG, promptText } from '../ai/prompt-config.mjs';
import { SUMMARY_SCHEMA, validateSummary } from './report-builder.mjs';

export const REPORT_PROMPT_VERSION = REPORT_PROMPT_CONFIG.version;

// UC-09 asks for the report within 30 seconds. Loading the session takes a few
// seconds, so the summary gets at most 20 s even when GEMINI_TIMEOUT_MS (shared with
// the interviewer, 30 s by default) is larger. After that the report is returned with
// summary "unavailable" and a Try again button (Build 2 test UC09-01, SCRUM-222).
export const REPORT_SUMMARY_BUDGET_MS = 20000;

export class ReportSummaryError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ReportSummaryError';
    this.code = code; // AI_NOT_CONFIGURED | AI_CONFIGURATION_ERROR | AI_RATE_LIMITED | AI_CONTENT_BLOCKED | AI_TIMEOUT | INVALID_OUTPUT | AI_UNAVAILABLE
  }
}

export function buildSummaryRequest(input) {
  return {
    systemInstruction: { parts: [{ text: promptText(REPORT_PROMPT_CONFIG, input.language) }] },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(input) }] }],
    safetySettings: GEMINI_SAFETY_SETTINGS,
    generationConfig: { responseMimeType: 'application/json', responseJsonSchema: SUMMARY_SCHEMA, maxOutputTokens: 2048 },
  };
}

export function createReportSummaryProvider({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const model = env.GEMINI_REPORT_MODEL?.trim() || env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  return {
    model,
    async summarize(input, { signal } = {}) {
      const apiKey = env.GEMINI_API_KEY?.trim();
      if (!apiKey) throw new ReportSummaryError('AI_NOT_CONFIGURED');
      const timeoutMs = Math.min(Number(env.GEMINI_TIMEOUT_MS || REPORT_SUMMARY_BUDGET_MS), REPORT_SUMMARY_BUDGET_MS);
      if (!/^[a-zA-Z0-9._-]{1,100}$/u.test(model) || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 45000) {
        throw new ReportSummaryError('AI_CONFIGURATION_ERROR');
      }
      const timeout = AbortSignal.timeout(timeoutMs);
      const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
      try {
        const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST', redirect: 'error', signal: combined,
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(buildSummaryRequest(input)),
        });
        if (!response.ok) {
          // Provider error bodies may echo the input; never forward them.
          await response.body?.cancel();
          if (response.status === 429) throw new ReportSummaryError('AI_RATE_LIMITED');
          if ([400, 401, 403, 404].includes(response.status)) throw new ReportSummaryError('AI_CONFIGURATION_ERROR');
          throw new ReportSummaryError('AI_UNAVAILABLE');
        }
        const envelope = await response.json();
        const candidate = envelope?.candidates?.[0];
        if (envelope?.promptFeedback?.blockReason || providerContentBlocked(candidate?.finishReason)) {
          throw new ReportSummaryError('AI_CONTENT_BLOCKED');
        }
        if (candidate?.finishReason !== 'STOP' || !Array.isArray(candidate.content?.parts)) throw new ReportSummaryError('INVALID_OUTPUT');
        const text = candidate.content.parts.filter((p) => p && !p.thought && typeof p.text === 'string').map((p) => p.text).join('');
        if (!text || text.length > 20000) throw new ReportSummaryError('INVALID_OUTPUT');
        const summary = validateSummary(JSON.parse(text));
        if (!summary || [summary.text, ...summary.strengths, ...summary.improvements].some(unsafeGeneratedText)) {
          throw new ReportSummaryError('INVALID_OUTPUT');
        }
        return summary;
      } catch (error) {
        if (error instanceof ReportSummaryError) throw error;
        if (timeout.aborted) throw new ReportSummaryError('AI_TIMEOUT');
        if (error instanceof SyntaxError) throw new ReportSummaryError('INVALID_OUTPUT');
        throw new ReportSummaryError('AI_UNAVAILABLE');
      }
    },
  };
}
