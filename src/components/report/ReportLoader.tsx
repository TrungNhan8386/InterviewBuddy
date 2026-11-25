"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ReportView from "@/components/report/ReportView";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { USE_MOCK } from "@/lib/interview-chat/client";
import { ReportLoadError, loadReport, type ReportLoadErrorCode } from "@/lib/report-view/client";
import { mockReport } from "@/lib/report-view/mock";
import { REPORT_STATE_TEXT as S } from "@/lib/report-view/text";
import type { ReportResponse } from "@/lib/report-view/types";

// Loads the report of one session and shows it (UC-09). Owner: Tài. Jira: SCRUM-198.
// States: loading, error (codes of docs/api/REPORT_API_v1.md §4), ready.
// "Try again" of the AI summary calls ?retry=summary and keeps the scores on screen meanwhile.
// With NEXT_PUBLIC_INTERVIEW_MOCK=1 the sample report is shown (no API, no sign-in).

type State =
  | { status: "loading" }
  | { status: "error"; code: ReportLoadErrorCode }
  | { status: "ready"; report: ReportResponse };

function codeOf(error: unknown): ReportLoadErrorCode {
  return error instanceof ReportLoadError ? error.code : "SERVER_ERROR";
}

export default function ReportLoader({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<State>(
    USE_MOCK ? { status: "ready", report: mockReport("default") } : { status: "loading" },
  );
  const [retryingSummary, setRetryingSummary] = useState(false);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (USE_MOCK) return;
    const controller = new AbortController();
    loadReport(sessionId, { signal: controller.signal })
      .then((report) => setState({ status: "ready", report }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ status: "error", code: codeOf(error) });
      });
    return () => controller.abort();
  }, [sessionId, attempt]);

  function reload() {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }

  async function retrySummary() {
    setRetryingSummary(true);
    setSummaryFailed(false);
    try {
      const report = await loadReport(sessionId, { retrySummary: true });
      setState({ status: "ready", report });
      setSummaryFailed(report.summary.status === "unavailable");
    } catch {
      setSummaryFailed(true);
    } finally {
      setRetryingSummary(false);
    }
  }

  if (state.status === "loading") {
    return (
      <p role="status" className="py-10 text-center text-sm text-slate-600">
        {S.loading}
      </p>
    );
  }

  if (state.status === "error") {
    const message = S.errors[state.code];
    const canRetry = state.code === "NO_SCORED_ANSWERS" || state.code === "SERVER_ERROR" || state.code === "NETWORK" || state.code === "INVALID_RESPONSE";
    return (
      <Card className="mx-auto max-w-lg space-y-3 text-center" role="alert">
        <h1 className="text-lg font-semibold">{message.title}</h1>
        <p className="text-sm text-slate-600">{message.body}</p>
        <div className="flex flex-col justify-center gap-2 sm:flex-row">
          {canRetry && <Button onClick={reload}>{S.retry}</Button>}
          {state.code === "UNAUTHORIZED" && (
            <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700">
              {S.toLogin}
            </Link>
          )}
          {state.code === "SESSION_NOT_COMPLETED" && (
            <Link href={`/interview/${sessionId}`} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700">
              {S.toInterview}
            </Link>
          )}
          <Link href="/dashboard" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-100">
            {S.toDashboard}
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {retryingSummary && (
        <p role="status" className="text-sm text-slate-600">
          {S.retrying}
        </p>
      )}
      {summaryFailed && !retryingSummary && (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {S.retryFailed}
        </p>
      )}
      <ReportView report={state.report} onRetrySummary={retryingSummary ? undefined : () => void retrySummary()} />
    </div>
  );
}
