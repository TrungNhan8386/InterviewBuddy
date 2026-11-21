import { USE_MOCK as CHAT_MOCK } from "../interview-chat/client";
import { mockEvaluateAnswer, type MockFeedbackInput } from "./mock";
import {
  AnswerFeedbackError,
  CRITERIA,
  type AnswerFeedback,
  type AnswerOutline,
  type Evidence,
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

const SAFE_CODE = /^[A-Z_]{1,64}$/u;
const isText = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const isScore = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 10;
const textList = (v: unknown): string[] => (Array.isArray(v) ? v.filter(isText) : []);

// Checks the response shape, so a wrong payload shows an error instead of a broken page.
export function parseFeedback(body: unknown, answerId: string): AnswerFeedback {
  const b = body as Record<string, unknown> | null;
  const scores = b?.scores as Record<string, unknown> | undefined;
  const outline = b?.outline as Record<string, unknown> | undefined;
  if (
    !b ||
    !scores ||
    !isScore(scores.content) ||
    !isScore(scores.clarity) ||
    !isScore(scores.confidence) ||
    !(scores.structure === null || isScore(scores.structure)) ||
    !isScore(b.overall) ||
    !outline ||
    !["hr", "technical", "behavioral"].includes(b.questionType as string)
  ) {
    throw new AnswerFeedbackError("INVALID_OUTPUT");
  }
  if (b.answerId !== undefined && b.answerId !== answerId) throw new AnswerFeedbackError("INVALID_OUTPUT");

  let parsedOutline: AnswerOutline;
  if (outline.format === "star") {
    parsedOutline = {
      format: "star",
      situation: String(outline.situation ?? ""),
      task: String(outline.task ?? ""),
      action: String(outline.action ?? ""),
      result: String(outline.result ?? ""),
    };
  } else {
    parsedOutline = { format: "key_points", points: textList(outline.points) };
  }

  const evidence: Evidence[] = (Array.isArray(b.evidence) ? b.evidence : [])
    .map((e) => e as Record<string, unknown>)
    .filter((e) => isText(e?.quote) && CRITERIA.includes(e.criterion as never))
    .map((e) => ({
      criterion: e.criterion as Evidence["criterion"],
      quote: String(e.quote).trim(),
      comment: isText(e.comment) ? e.comment : "",
      effect: e.effect === "negative" ? "negative" : "positive",
    }));

  return {
    feedbackId: isText(b.feedbackId) ? b.feedbackId : "",
    answerId,
    questionType: b.questionType as AnswerFeedback["questionType"],
    scores: {
      content: scores.content,
      structure: scores.structure as number | null,
      clarity: scores.clarity,
      confidence: scores.confidence,
    },
    overall: Math.round((b.overall as number) * 10) / 10,
    evidence,
    strengths: textList(b.strengths),
    improvements: textList(b.improvements),
    outline: parsedOutline,
    createdAt: isText(b.createdAt) ? b.createdAt : new Date().toISOString(),
  };
}

function codeFrom(status: number, body: unknown): FeedbackErrorCode {
  const code = (body as { error?: { code?: unknown } } | null)?.error?.code;
  if (typeof code === "string" && SAFE_CODE.test(code)) {
    // 404 with NOT_FOUND from the route = the answer is not the user's; 404 without a body = no route yet.
    return code as FeedbackErrorCode;
  }
  if (status === 404 || status === 405) return "FEEDBACK_UNAVAILABLE";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 429) return "AI_RATE_LIMITED";
  if (status === 504) return "AI_TIMEOUT";
  return "SERVER_ERROR";
}

// Asks for the feedback of one saved answer. The server returns the saved feedback when it
// already exists (resume, "Try again" after a lost response), so this is safe to call twice.
// `sample` is only read by the mock (the real server loads the question and answer itself).
export async function evaluateAnswer(
  sessionId: string,
  answerId: string,
  options: { signal?: AbortSignal; sample?: MockFeedbackInput } = {},
): Promise<AnswerFeedback> {
  if (FEEDBACK_MODE === "mock") return mockEvaluateAnswer(answerId, options.sample, options.signal);

  let response: Response;
  try {
    response = await fetch("/api/evaluate-answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, answerId }),
      cache: "no-store",
      signal: options.signal,
    });
  } catch {
    if (options.signal?.aborted) throw new AnswerFeedbackError("REQUEST_CANCELLED");
    throw new AnswerFeedbackError("NETWORK_ERROR");
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !body || (body as { error?: unknown }).error) {
    throw new AnswerFeedbackError(codeFrom(response.status, body));
  }
  return parseFeedback(body, answerId);
}
