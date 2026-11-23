import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAiCallCounter } from "@/lib/ai/daily-limit.mjs";
import { getSignedInClient, isSupabaseConfigured } from "@/lib/interview/http";
import { isUuid } from "@/lib/interview/session-contract.mjs";
import { ReportError, createReportRepository, createReportService } from "@/lib/report/report-service.mjs";
import { createReportSummaryProvider } from "@/lib/report/report-summary.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;

const MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "Please sign in first.",
  NOT_FOUND: "Report not found.",
  SESSION_NOT_COMPLETED: "The interview has not ended yet.",
  NO_SCORED_ANSWERS: "No answer of this interview has been scored yet.",
  SERVER_ERROR: "Could not build the report. Please try again.",
};

function error(code: string, status: number) {
  return NextResponse.json({ error: { code, message: MESSAGES[code] } }, { status, headers: { "Cache-Control": "no-store" } });
}

// GET /api/report/{sessionId}[?retry=summary] – report of a completed interview
// (UC-09, SCRUM-186). Contract: docs/api/REPORT_API_v1.md
export async function GET(request: NextRequest, ctx: RouteContext<"/api/report/[sessionId]">) {
  if (!isSupabaseConfigured) return error("SERVER_ERROR", 500);
  const auth = await getSignedInClient(request);
  if (!auth) return error("UNAUTHORIZED", 401);

  const { sessionId } = await ctx.params;
  // Another user's session returns 404 as well, so ids cannot be probed.
  if (!isUuid(sessionId)) return error("NOT_FOUND", 404);

  const getReport = createReportService({
    repository: createReportRepository(auth.supabase),
    provider: createReportSummaryProvider(),
    consume: createAiCallCounter(auth.supabase),
  });
  try {
    const report = await getReport(sessionId, {
      retrySummary: request.nextUrl.searchParams.get("retry") === "summary",
      signal: request.signal,
    });
    return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof ReportError) return error(e.code, e.status);
    console.error("[api/report/:sessionId] failed:", e instanceof Error ? e.message : "unknown error");
    return error("SERVER_ERROR", 500);
  }
}
