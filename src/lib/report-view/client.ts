import type { ReportResponse } from "./types";

// Loads GET /api/report/{sessionId}[?retry=summary] (Nhân, SCRUM-186, docs/api/REPORT_API_v1.md)
// for the Report page. Same-origin request: the sign-in cookie is sent by the browser.

export type ReportLoadErrorCode =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "SESSION_NOT_COMPLETED"
  | "NO_SCORED_ANSWERS"
  | "SERVER_ERROR"
  | "NETWORK"
  | "INVALID_RESPONSE";

export class ReportLoadError extends Error {
  code: ReportLoadErrorCode;
  constructor(code: ReportLoadErrorCode) {
    super(code);
    this.name = "ReportLoadError";
    this.code = code;
  }
}

const KNOWN: ReadonlySet<string> = new Set(["UNAUTHORIZED", "NOT_FOUND", "SESSION_NOT_COMPLETED", "NO_SCORED_ANSWERS", "SERVER_ERROR"]);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

// Checks the main parts of the response, so a wrong payload shows an error instead of a broken page.
export function parseReport(body: unknown): ReportResponse {
  if (!isRecord(body)) throw new ReportLoadError("INVALID_RESPONSE");
  const { overview, criteria, speaking, summary, timeline, settings } = body;
  if (
    !isRecord(overview) ||
    typeof overview.overallScore !== "number" ||
    !isRecord(criteria) ||
    !isRecord(speaking) ||
    !isRecord(summary) ||
    (summary.status !== "ready" && summary.status !== "unavailable") ||
    !Array.isArray(timeline) ||
    !isRecord(settings) ||
    (settings.language !== "vi" && settings.language !== "en")
  ) {
    throw new ReportLoadError("INVALID_RESPONSE");
  }
  return body as unknown as ReportResponse;
}

export async function loadReport(
  sessionId: string,
  options: { retrySummary?: boolean; signal?: AbortSignal } = {},
): Promise<ReportResponse> {
  const query = options.retrySummary ? "?retry=summary" : "";
  let response: Response;
  try {
    response = await fetch(`/api/report/${encodeURIComponent(sessionId)}${query}`, {
      cache: "no-store",
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ReportLoadError("NETWORK");
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // not JSON: handled below
  }

  if (!response.ok) {
    const code = isRecord(body) && isRecord(body.error) ? body.error.code : undefined;
    throw new ReportLoadError(typeof code === "string" && KNOWN.has(code) ? (code as ReportLoadErrorCode) : "SERVER_ERROR");
  }
  return parseReport(body);
}
