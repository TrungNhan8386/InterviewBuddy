import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSignedInClient, isSupabaseConfigured } from "@/lib/interview/http";
import { isUuid } from "@/lib/interview/session-contract.mjs";
import { PracticeError, createPracticeRepository } from "@/lib/practice/practice-service.mjs";

export const runtime = "nodejs";

// POST /api/practice/start { "practiceQuestionId": … } – start a practice session
// from one targeted question (UC-10 step 6–7, SCRUM-204). Owner: Khang.
// Creates a 15-minute session with the same settings, JD and CV as the reported
// interview and the chosen question as question 1, then the page opens
// /interview/{sessionId} (the existing chat page). No AI call here.
// Contract: docs/api/PRACTICE_API_v1.md

const MESSAGES = {
  BAD_INPUT: "Send a valid practiceQuestionId.",
  UNAUTHORIZED: "Please sign in first.",
  NOT_FOUND: "Practice question not found.",
  DATABASE_NOT_READY: "The practice feature is not set up in the database yet.",
  SERVER_ERROR: "Could not start the practice session. Please try again.",
} as const;
type Code = keyof typeof MESSAGES;
const STATUS: Record<Code, number> = { BAD_INPUT: 400, UNAUTHORIZED: 401, NOT_FOUND: 404, DATABASE_NOT_READY: 503, SERVER_ERROR: 500 };

function error(code: Code) {
  return NextResponse.json({ error: { code, message: MESSAGES[code] } }, { status: STATUS[code], headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) return error("SERVER_ERROR");
  const auth = await getSignedInClient(request);
  if (!auth) return error("UNAUTHORIZED");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("BAD_INPUT");
  }
  const id = (body as { practiceQuestionId?: unknown } | null)?.practiceQuestionId;
  if (!body || typeof body !== "object" || Object.keys(body).some((k) => k !== "practiceQuestionId") || typeof id !== "string") {
    return error("BAD_INPUT");
  }
  if (!isUuid(id)) return error("NOT_FOUND");
  try {
    const started = await createPracticeRepository(auth.supabase).start(id);
    return NextResponse.json(started, { status: started.resumed ? 200 : 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof PracticeError && e.code in MESSAGES) return error(e.code as Code);
    console.error("[api/practice/start] failed:", e instanceof Error ? e.message : "unknown error");
    return error("SERVER_ERROR");
  }
}
