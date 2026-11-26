import { USE_MOCK as CHAT_MOCK } from "../interview-chat/client";
import { mockEvaluateAnswer, type MockFeedbackInput } from "./mock";
import {
  AnswerFeedbackError,
  type AnswerFeedback,
  type FeedbackErrorCode,
} from "./types";

// How the chat page gets feedback after each answer (UC-06 step 7, UC-08):
//   NEXT_PUBLIC_FEEDBACK_MODE=mock  sample feedback, no Gemini (also used when NEXT_PUBLIC_INTERVIEW_MOCK=1)
//   NEXT_PUBLIC_FEEDBACK_MODE=off   skip feedback, the chat goes straight to the next question (old flow)
//   not set                         call POST /api/evaluate-answer
export type FeedbackMode = "api" | "mock" | "off";

function readMode(): FeedbackMode {
  const value = process.env.NEXT_PUBLIC_FEEDBACK_MODE;
  if (CHAT_MOCK || value === "mock") return "mock";
  if (value === "off") return "off";
  return "api";
}
export const FEEDBACK_MODE: FeedbackMode = readMode();

// Server contract adapter is shared with transport regression tests.
export { adaptFeedback as parseFeedback } from "./transport.mjs";
import { loadFeedback } from "./transport.mjs";
export async function evaluateAnswer(
  sessionId: string, answerId: string,
  options: { signal?: AbortSignal; sample?: MockFeedbackInput } = {},
): Promise<AnswerFeedback> {
  if (FEEDBACK_MODE === "mock") return mockEvaluateAnswer(answerId, options.sample, options.signal);
  try { return await loadFeedback(answerId, options); }
  catch (error) { throw new AnswerFeedbackError((error as {code?: FeedbackErrorCode}).code || "SERVER_ERROR"); }
}
