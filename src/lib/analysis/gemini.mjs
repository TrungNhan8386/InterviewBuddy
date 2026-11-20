import { ANALYSIS_PROMPT_CONFIG, promptText } from '../ai/prompt-config.mjs';
import { AnalysisError, invalidAiResponse } from './errors.mjs';
import { GEMINI_ANALYSIS_SCHEMA } from './contracts.mjs';
import { providerLimitMessage } from '../ai/provider-limit.mjs';
import { GEMINI_SAFETY_SETTINGS, providerContentBlocked } from '../ai/guardrails.mjs';

export const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

export function buildGeminiRequest(input) {
  return {
    safetySettings: GEMINI_SAFETY_SETTINGS,
    systemInstruction: {
      parts: [{ text: promptText(ANALYSIS_PROMPT_CONFIG, input.language) }],
    },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify({ cvText: input.cvText, jdText: input.jdText }) }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseJsonSchema: GEMINI_ANALYSIS_SCHEMA,
      maxOutputTokens: 8192,
    },
  };
}

export function createGeminiProvider({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const model = env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  return {
    model,
    async analyze(input, { signal } = {}) {
      const apiKey = env.GEMINI_API_KEY?.trim();
      if (!apiKey) {
        throw new AnalysisError('AI_NOT_CONFIGURED', 'Gemini API is not configured on the server.', 503);
      }
      const timeoutMs = Number(env.GEMINI_TIMEOUT_MS || 30000);
      if (!/^[a-zA-Z0-9._-]{1,100}$/.test(model)
          || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 45000) {
        throw new AnalysisError('AI_CONFIGURATION_ERROR', 'The server AI configuration is invalid.', 503);
      }
      const timeout = AbortSignal.timeout(timeoutMs);
      const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
      let response;
      try {
        response = await fetchImpl(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify(buildGeminiRequest(input)),
            signal: combined,
            redirect: 'error',
          },
        );
        if (!response.ok) {
          // Provider error bodies can contain input or credentials. Do not
          // forward them, or automatically retry a potentially billed call.
          await response.body?.cancel();
          if (response.status === 429) {
            throw new AnalysisError('AI_RATE_LIMITED', providerLimitMessage('en'), 429);
          }
          if ([400, 401, 403, 404].includes(response.status)) {
            throw new AnalysisError('AI_CONFIGURATION_ERROR', 'Check the server Gemini key and model configuration.', 503);
          }
          throw new AnalysisError('AI_UNAVAILABLE', 'The AI service is temporarily unavailable.', 502);
        }
        const envelope = await response.json();
        if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) throw invalidAiResponse();
        if (envelope.promptFeedback?.blockReason) {
          throw new AnalysisError('AI_CONTENT_BLOCKED', 'The AI could not process this content. Please revise the documents.', 422);
        }
        const candidate = envelope.candidates?.[0];
        if (providerContentBlocked(candidate?.finishReason)) {
          throw new AnalysisError('AI_CONTENT_BLOCKED', 'The AI could not process this content. Please revise the documents.', 422);
        }
        if (!candidate || candidate.finishReason !== 'STOP' || !Array.isArray(candidate.content?.parts)) {
          throw invalidAiResponse();
        }
        const text = candidate.content.parts
          .filter((part) => !part.thought && typeof part.text === 'string')
          .map((part) => part.text).join('');
        if (!text || text.length > 200000) throw invalidAiResponse();
        return JSON.parse(text);
      } catch (error) {
        if (error instanceof AnalysisError) throw error;
        if (timeout.aborted) throw new AnalysisError('AI_TIMEOUT', 'The analysis timed out. Please try again.', 504);
        if (signal?.aborted) throw new AnalysisError('REQUEST_CANCELLED', 'The request was cancelled.', 408);
        if (error instanceof SyntaxError) throw invalidAiResponse();
        throw new AnalysisError('AI_UNAVAILABLE', 'The AI service is temporarily unavailable.', 502);
      }
    },
  };
}
