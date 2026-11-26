import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAiCallCounter } from "@/lib/ai/daily-limit.mjs";
import { getSignedInClient, isSupabaseConfigured } from "@/lib/interview/http";
import { isUuid } from "@/lib/interview/session-contract.mjs";
import { renderReportPdf, reportPdfFileName } from "@/lib/report/report-pdf.mjs";
import { ReportError, createReportRepository, createReportService } from "@/lib/report/report-service.mjs";
import { createReportSummaryProvider } from "@/lib/report/report-summary.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;

const MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "Please sign in first.",
  NOT_FOUND: "Report not found.",
  SESSION_NOT_COMPLETED: "The interview has not ended yet.",
  NO_SCORED_ANSWERS: "No answer of this interview has been scored yet.",
  SERVER_ERROR: "Could not create the PDF. Please try again.",
};

function error(code: string, status: number) {
  return NextResponse.json({ error: { code, message: MESSAGES[code] } }, { status, headers: { "Cache-Control": "no-store" } });
}

// Geist (SIL Open Font License, see assets/fonts/OFL.txt), loaded once per server
// instance. next.config.ts includes assets/fonts in this route's deployment bundle.
let fontBytes: Promise<Uint8Array> | null = null;
function loadFont() {
  fontBytes ??= readFile(path.join(process.cwd(), "assets", "fonts", "Geist-Regular.ttf")).then((b) => new Uint8Array(b));
  return fontBytes.catch((e) => { fontBytes = null; throw e; });
}

// GET /api/report/{sessionId}/pdf – the report of a completed interview as a PDF
// file (UC-14, SCRUM-225). Same data and errors as GET /api/report/{sessionId}:
// the saved AI summary is reused and never retried from here.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/report/[sessionId]/pdf">) {
  if (!isSupabaseConfigured) return error("SERVER_ERROR", 500);
  const auth = await getSignedInClient(request);
  if (!auth) return error("UNAUTHORIZED", 401);

  const { sessionId } = await ctx.params;
  if (!isUuid(sessionId)) return error("NOT_FOUND", 404);

  const getReport = createReportService({
    repository: createReportRepository(auth.supabase),
    provider: createReportSummaryProvider(),
    consume: createAiCallCounter(auth.supabase),
  });
  try {
    const [report, font] = await Promise.all([getReport(sessionId, { signal: request.signal }), loadFont()]);
    const pdf = await renderReportPdf(report, { fontBytes: font });
    return new Response(new Blob([pdf as BlobPart], { type: "application/pdf" }), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${reportPdfFileName(report)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    if (e instanceof ReportError) return error(e.code, e.status);
    console.error("[api/report/:sessionId/pdf] failed:", e instanceof Error ? e.message : "unknown error");
    return error("SERVER_ERROR", 500);
  }
}
