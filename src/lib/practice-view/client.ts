import { mockPractice, type PracticeDemo } from "./mock";
import {
  PracticeViewError,
  type PracticeCriterion,
  type PracticeErrorCode,
  type PracticeGroup,
  type PracticeLanguage,
  type PracticeSet,
} from "./types";

// How the Report page gets targeted practice questions (UC-10):
//   NEXT_PUBLIC_PRACTICE_MODE=mock  sample questions, no Gemini (also used when NEXT_PUBLIC_INTERVIEW_MOCK=1)
//   not set                         POST /api/practice/generate, POST /api/practice/start
export const PRACTICE_MOCK =
  process.env.NEXT_PUBLIC_PRACTICE_MODE === "mock" || process.env.NEXT_PUBLIC_INTERVIEW_MOCK === "1";

const SAFE_CODE = /^[A-Z_]{1,64}$/u;
const CRITERIA: PracticeCriterion[] = ["content", "structure", "clarity", "confidence"];
const isText = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new PracticeViewError("REQUEST_CANCELLED"));
    });
  });
}

// Checks the response shape, so a wrong payload shows an error instead of a broken page.
export function parsePractice(body: unknown, sessionId: string): PracticeSet {
  const b = body as Record<string, unknown> | null;
  if (!b || b.state !== "ready" || !Array.isArray(b.groups) || b.groups.length === 0) {
    throw new PracticeViewError("INVALID_OUTPUT");
  }
  const groups: PracticeGroup[] = b.groups.map((raw) => {
    const g = raw as Record<string, unknown>;
    if (!CRITERIA.includes(g?.criterion as PracticeCriterion) || !Array.isArray(g.questions)) {
      throw new PracticeViewError("INVALID_OUTPUT");
    }
    const questions = g.questions
      .map((q) => q as Record<string, unknown>)
      .filter((q) => isText(q?.id) && isText(q.question))
      .map((q) => ({
        id: String(q.id),
        position: Number(q.position) || 0,
        question: String(q.question).trim(),
        tip: isText(q.tip) ? q.tip.trim() : null,
        practiceSessionId: isText(q.practiceSessionId) ? q.practiceSessionId : null,
      }));
    if (!questions.length) throw new PracticeViewError("INVALID_OUTPUT");
    return {
      criterion: g.criterion as PracticeCriterion,
      score: typeof g.score === "number" && Number.isFinite(g.score) ? g.score : null,
      questions,
    };
  });
  return {
    sessionId,
    language: b.language === "en" ? "en" : "vi",
    generatedAt: isText(b.generatedAt) ? b.generatedAt : null,
    noMajorWeakness: b.noMajorWeakness === true,
    alreadySaved: b.alreadySaved === true,
    groups,
  };
}

function errorFrom(status: number, body: unknown): PracticeViewError {
  const err = (body as { error?: { code?: unknown; resetAt?: unknown } } | null)?.error;
  if (typeof err?.code === "string" && SAFE_CODE.test(err.code)) {
    return new PracticeViewError(err.code as PracticeErrorCode, isText(err.resetAt) ? err.resetAt : null);
  }
  if (status === 401) return new PracticeViewError("UNAUTHORIZED");
  if (status === 404 || status === 405) return new PracticeViewError("DATABASE_NOT_READY");
  if (status === 429) return new PracticeViewError("AI_RATE_LIMITED");
  return new PracticeViewError("SERVER_ERROR");
}

async function post(url: string, payload: unknown, signal?: AbortSignal): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal,
    });
  } catch {
    if (signal?.aborted) throw new PracticeViewError("REQUEST_CANCELLED");
    throw new PracticeViewError("NETWORK_ERROR");
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !body || (body as { error?: unknown }).error) throw errorFrom(response.status, body);
  return body;
}

// Returns the saved practice set of the session, or generates it once (1 AI call).
// Safe to call again: the server returns the saved set without calling the AI (UC-10 AF1).
export async function loadPractice(
  sessionId: string,
  language: PracticeLanguage,
  options: { signal?: AbortSignal; demo?: PracticeDemo } = {},
): Promise<PracticeSet> {
  if (PRACTICE_MOCK) {
    await wait(900, options.signal);
    if (options.demo === "error") throw new PracticeViewError("AI_UNAVAILABLE");
    if (options.demo === "limit") throw new PracticeViewError("AI_DAILY_LIMIT");
    if (options.demo === "few") throw new PracticeViewError("NOT_ENOUGH_SCORES");
    return mockPractice(sessionId, language, options.demo);
  }
  return parsePractice(await post("/api/practice/generate", { sessionId }, options.signal), sessionId);
}

// Creates (or reopens) the practice session of one question; the page then opens /interview/{id}.
export async function startPractice(practiceQuestionId: string, options: { signal?: AbortSignal } = {}): Promise<string> {
  if (PRACTICE_MOCK) {
    await wait(500, options.signal);
    return "mock-practice";
  }
  const body = (await post("/api/practice/start", { practiceQuestionId }, options.signal)) as { sessionId?: unknown };
  if (!isText(body.sessionId)) throw new PracticeViewError("SERVER_ERROR");
  return body.sessionId;
}
