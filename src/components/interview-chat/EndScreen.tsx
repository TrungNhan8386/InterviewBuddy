"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import type { CHAT_TEXT } from "@/lib/interview-chat/text";
import type { ChatSession, EndReason } from "@/lib/interview-chat/types";

type Props = {
  text: (typeof CHAT_TEXT)["vi"];
  session: ChatSession;
  reason: EndReason;
  endedAt: number | null; // ms, only known when the interview ended on this page
  onReview: () => void;
};

function formatDuration(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// SCRUM-128: end-of-interview screen. The report itself (score, criteria, timeline) is the
// Report page /reports/{sessionId} (UC-09, SCRUM-198); the button below links to it.
export default function EndScreen({ text, session, reason, endedAt, onReview }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus and scroll here, so a phone user sees the result without scrolling down.
  useEffect(() => {
    headingRef.current?.focus();
    headingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const answered = session.turns.filter((t) => t.answer && t.answer.id !== "pending");
  const mainAnswered = answered.filter((t) => t.question.kind === "main").length;
  const followUpsAnswered = answered.length - mainAnswered;
  const started = session.startedAt ? Date.parse(session.startedAt) : NaN;
  const limit = session.settings.durationMinutes * 60_000;
  const practice = session.practice ?? null;
  const used = endedAt !== null && Number.isFinite(started)
    ? (practice ? endedAt - started : Math.min(endedAt - started, limit)) : null;

  // UC-10 (SCRUM-205): a practice session has no follow-ups, no time limit and no report.
  const stats: { label: string; value: string; sub?: string }[] = practice ? [
    { label: text.statMain, value: `${mainAnswered}/${practice.total}` },
    { label: text.statTime, value: used === null ? "--:--" : formatDuration(used), sub: text.practiceNoLimit },
  ] : [
    { label: text.statMain, value: `${mainAnswered}/${session.settings.plannedQuestions}` },
    { label: text.statFollowUps, value: String(followUpsAnswered) },
    {
      label: text.statTime,
      value: used === null ? "--:--" : formatDuration(used),
      sub: text.statTimeOf(session.settings.durationMinutes),
    },
  ];

  return (
    <Card className="space-y-4" data-testid="end-screen">
      <div className="text-center">
        <h2 ref={headingRef} tabIndex={-1} className="scroll-mt-4 text-lg font-semibold outline-none">
          {practice ? text.practiceEndedTitle : text.endedTitle}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {practice && reason === "completed" ? text.practiceEnded : text.endedReason[reason]}
        </p>
      </div>

      <dl className={`grid gap-2 text-center ${practice ? "grid-cols-2" : "grid-cols-3"}`}>
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg bg-slate-50 px-2 py-3">
            <dt className="text-xs text-slate-500">{s.label}</dt>
            <dd className="mt-1 font-mono text-base font-semibold tabular-nums text-slate-900">{s.value}</dd>
            {s.sub && <dd className="text-xs text-slate-500">{s.sub}</dd>}
          </div>
        ))}
      </dl>

      {practice ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-4">
          <p className="text-sm text-slate-600">{text.practiceNoReport}</p>
          {practice.sourceSessionId && (
            <Link
              href={`/reports/${practice.sourceSessionId}`}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 sm:w-auto"
            >
              {text.backToReport}
            </Link>
          )}
        </div>
      ) : (
      <div className="rounded-lg border border-dashed border-slate-300 p-4">
        <h3 className="text-sm font-semibold">{text.reportTitle}</h3>
        <p className="mt-1 text-sm text-slate-600">{answered.length > 0 ? text.reportSoon : text.noAnswers}</p>
        {answered.length > 0 && (
          <Link
            href={`/reports/${session.id}`}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 sm:w-auto"
          >
            {text.reportButton}
          </Link>
        )}
      </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Link
          href="/dashboard"
          className={practice
            ? "inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-100"
            : "inline-flex min-h-11 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"}
        >
          {text.toDashboard}
        </Link>
        <Link
          href="/interview/new"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          {text.newInterview}
        </Link>
        {answered.length > 0 && (
          <Button variant="secondary" onClick={onReview}>
            {text.reviewTranscript}
          </Button>
        )}
      </div>
    </Card>
  );
}
