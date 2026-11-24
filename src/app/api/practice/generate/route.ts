import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAiCallCounter } from "@/lib/ai/daily-limit.mjs";
import { getSignedInClient, isSupabaseConfigured } from "@/lib/interview/http";
import { isUuid } from "@/lib/interview/session-contract.mjs";
import { createPracticeProvider } from "@/lib/practice/practice-provider.mjs";
import {
  PRACTICE_ERROR_STATUS,
  PracticeError,
  createPracticeRepository,
  createPracticeService,
  type PracticeErrorCode,
} from "@/lib/practice/practice-service.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;

// /api/practice/generate – targeted practice questions of a completed interview
// (UC-10, SCRUM-178). Owner: Khang. Contract: docs/api/PRACTICE_API_v1.md
//   GET  ?sessionId=…        saved questions, or state "not_generated" (no AI call)
//   POST { "sessionId": … }  saved questions, or generate them once (1 AI call)

const MESSAGES: Record<PracticeErrorCode, string> = {
  BAD_INPUT: "Send a valid sessionId.",
  UNAUTHORIZED: "Please sign in first.",
  NOT_FOUND: "Interview session not found.",
  SESSION_NOT_COMPLETED: "The interview has not ended yet.",
  NOT_ENOUGH_SCORES: "Not enough scored answers to choose the criteria to practise.",
  AI_DAILY_LIMIT: "You have used all AI calls for today. The limit resets at 00:00 Vietnam time.",
  AI_RATE_LIMITED: "The AI service is busy. Please try again in a moment.",
  AI_UNAVAILABLE: "The AI service is not available. Please try again.",
  AI_TIMEOUT: "The AI service took too long. Please try again.",
  AI_CONTENT_BLOCKED: "The AI could not write questions for this session. Please try again.",
  INVALID_OUTPUT: "The AI returned questions that could not be used. Please try again.",
  AI_NOT_CONFIGURED: "The AI service is not configured on the server.",
  AI_CONFIGURATION_ERROR: "The AI service is not configured correctly on the server.",
  DATABASE_NOT_READY: "The practice feature is not set up in the database yet.",
  SERVER_ERROR: "Could not load the practice questions. Please try again.",
};

function error(code: PracticeErrorCode, details?: Record<string, unknown> | null) {
  return NextResponse.json(
    { error: { code, message: MESSAGES[code], ...(details ?? {}) } },
    { status: PRACTICE_ERROR_STATUS[code], headers: { "Cache-Control": "no-store" } },
  );
}

function fail(e: unknown) {
  if (e instanceof PracticeError) return error(e.code, e.details);
  console.error("[api/practice/generate] failed:", e instanceof Error ? e.message : "unknown error");
  return error("SERVER_ERROR");
}

async function service(request: NextRequest) {
  const auth = await getSignedInClient(request);
  if (!auth) return null;
  return createPracticeService({
    repository: createPracticeRepository(auth.supabase),
    provider: createPracticeProvider(),
    consume: createAiCallCounter(auth.supabase),
  });
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured) return error("SERVER_ERROR");
  const practice = await service(request);
  if (!practice) return error("UNAUTHORIZED");
  const sessionId = request.nextUrl.searchParams.get("sessionId") ?? "";
  // Another user's session returns 404 as well, so ids cannot be probed.
  if (!isUuid(sessionId)) return error("NOT_FOUND");
  try {
    return NextResponse.json(await practice.read(sessionId), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) return error("SERVER_ERROR");
  const practice = await service(request);
  if (!practice) return error("UNAUTHORIZED");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("BAD_INPUT");
  }
  const sessionId = (body as { sessionId?: unknown } | null)?.sessionId;
  if (!body || typeof body !== "object" || Object.keys(body).some((k) => k !== "sessionId") || typeof sessionId !== "string") {
    return error("BAD_INPUT");
  }
  if (!isUuid(sessionId)) return error("NOT_FOUND");
  try {
    const result = await practice.generate(sessionId, { signal: request.signal });
    return NextResponse.json(result, { status: result.alreadySaved ? 200 : 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}
