import { mockEndSession, mockLoadSession, mockRequestNext, mockSaveAnswer } from "./mock";
import type { AnswerMeta, ChatErrorCode, ChatSession, ChatSettings, NextResult, SessionStatus } from "./types";
import { InterviewChatError } from "./types";
import { ChatTransportError, createChatTransport, type ChatStreamOptions } from "./transport.mjs";

export const USE_MOCK = process.env.NEXT_PUBLIC_INTERVIEW_MOCK === "1";
const transport = createChatTransport();
const KNOWN_CODES = new Set<ChatErrorCode>([
  "BAD_INPUT", "UNAUTHORIZED", "NOT_FOUND", "STALE_TURN", "GENERATION_IN_PROGRESS", "SESSION_CLOSED", "ANSWER_CONFLICT",
  "LEASE_LOST", "SESSION_CONTEXT_INVALID", "AI_CONTENT_BLOCKED", "AI_RATE_LIMITED", "AI_DAILY_LIMIT",
  "INVALID_OUTPUT", "AI_UNAVAILABLE", "DATABASE_NOT_READY", "AI_NOT_CONFIGURED", "AI_TIMEOUT", "SAVE_FAILED",
  "NETWORK_ERROR", "RESPONSE_TIMEOUT", "REQUEST_CANCELLED",
]);
async function call<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) {
    if (error instanceof ChatTransportError) {
      const code: ChatErrorCode = KNOWN_CODES.has(error.code as ChatErrorCode) ? error.code as ChatErrorCode
        : ["INVALID_STREAM", "INCOMPLETE_STREAM"].includes(error.code) ? "INVALID_OUTPUT"
          : error.code === "AI_CONFIGURATION_ERROR" ? "AI_NOT_CONFIGURED"
            : error.status === 401 ? "UNAUTHORIZED" : error.status === 404 ? "NOT_FOUND" : "SERVER_ERROR";
      throw new InterviewChatError(code);
    }
    throw new InterviewChatError("SERVER_ERROR");
  }
}
type SessionApiResponse = {
  id: string; status: SessionStatus; settings: ChatSettings; startedAt: string | null; turns: ChatSession["turns"];
  analysis: null | { result?: { matched?: { skill: string }[]; missing?: { skill: string }[] } };
};
export async function loadChatSession(id: string): Promise<ChatSession> {
  if (USE_MOCK) return mockLoadSession(id);
  const api = await call(() => transport.loadSession(id)) as SessionApiResponse;
  const result = api.analysis?.result;
  return { id: api.id, status: api.status, startedAt: api.startedAt, settings: api.settings, turns: api.turns,
    skills: result ? { matched: (result.matched ?? []).map((item) => item.skill).filter(Boolean),
      missing: (result.missing ?? []).map((item) => item.skill).filter(Boolean) } : null };
}
export async function saveAnswer(sessionId: string, questionId: string, content: string, meta?: AnswerMeta): Promise<string> {
  if (USE_MOCK) return mockSaveAnswer(sessionId, questionId, content);
  return call(() => transport.saveAnswer(sessionId, questionId, content, meta));
}
export async function requestNext(sessionId: string, afterAnswerId: string | null, options?: ChatStreamOptions): Promise<NextResult> {
  if (USE_MOCK) return mockRequestNext(sessionId, afterAnswerId);
  return call(() => transport.requestNext(sessionId, afterAnswerId, options));
}
export async function endSession(sessionId: string): Promise<void> {
  if (USE_MOCK) return mockEndSession(sessionId);
  return call(() => transport.endSession(sessionId));
}
