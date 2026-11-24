"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PracticeQuestions from "@/components/practice/PracticeQuestions";
import { REPORT_TEXT } from "@/lib/report-view/text";
import type { ReportCriterion, ReportResponse, ReportTimelineItem } from "@/lib/report-view/types";

// Screen 6 – Interview Results Report (UC-09). Owner: Tài. Jira: SCRUM-185 (skeleton with sample data).
// Sections follow the UI Design document: overview cards, score by criterion, summary
// (strengths / improvements), speaking indicators and the session timeline.
// W8: the page loads GET /api/report/{sessionId} and passes onRetrySummary (?retry=summary).
// Export PDF and Share are placeholders until Week 9 (UC-14, UC-15).

type Props = {
  report: ReportResponse;
  onRetrySummary?: () => void;
};

const CRITERIA: ReportCriterion[] = ["content", "structure", "clarity", "confidence"];

function one(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function clock(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return "--:--";
  const total = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function scoreTone(score: number | null) {
  if (score === null) return { bar: "bg-slate-300", chip: "bg-slate-100 text-slate-600" };
  if (score >= 7.5) return { bar: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-800" };
  if (score >= 5) return { bar: "bg-indigo-500", chip: "bg-indigo-50 text-indigo-800" };
  return { bar: "bg-amber-500", chip: "bg-amber-50 text-amber-900" };
}

function sessionDate(iso: string | null, language: "vi" | "en") {
  if (!iso) return null;
  return new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function ScoreRing({ score, scale }: { score: number; scale: number }) {
  const ratio = Math.max(0, Math.min(1, score / scale));
  const r = 30;
  const length = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 72 72" className="h-16 w-16 shrink-0" aria-hidden="true">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke="#4f46e5"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${length * ratio} ${length}`}
        transform="rotate(-90 36 36)"
      />
    </svg>
  );
}

export default function ReportView({ report, onRetrySummary }: Props) {
  const t = REPORT_TEXT[report.settings.language];
  const { overview, speaking, summary } = report;
  const criteria = CRITERIA.filter((c) => c !== "structure" || report.structureApplies);

  const trend = overview.trend;
  const trendText =
    trend === null
      ? t.trendNone
      : trend.change > 0
        ? t.trendUp(one(trend.change))
        : trend.change < 0
          ? t.trendDown(one(Math.abs(trend.change)))
          : t.trendSame;
  const trendColor = trend === null || trend.change === 0 ? "text-slate-500" : trend.change > 0 ? "text-emerald-700" : "text-amber-700";

  const subtitle = [
    sessionDate(overview.startedAt, report.settings.language),
    report.settings.targetPosition,
    `${t.types[report.settings.type]} · ${t.difficulties[report.settings.difficulty]}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link href="/dashboard" className="text-sm font-medium text-indigo-700 hover:underline">
            ← {t.back}
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{t.title}</h1>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled title={t.soon}>
            {t.exportPdf}
          </Button>
          <Button variant="secondary" disabled title={t.soon}>
            {t.share}
          </Button>
        </div>
      </div>

      {/* Overview cards */}
      <section aria-label={t.overall} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-4">
          <ScoreRing score={overview.overallScore} scale={overview.scale} />
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">{t.overall}</p>
            <p className="text-2xl font-bold tabular-nums text-indigo-700">
              {one(overview.overallScore)}{" "}
              <span className="text-base font-medium text-slate-500">{t.outOf(overview.scale)}</span>
            </p>
            <p className={`text-xs ${trendColor}`}>{trendText}</p>
          </div>
        </Card>
        <Card>
          <p className="text-xs font-medium text-slate-500">{t.interviewType}</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{t.types[report.settings.type]}</p>
          <p className="text-xs text-slate-500">{t.difficulties[report.settings.difficulty]}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-slate-500">{t.duration}</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-slate-900">{clock(overview.durationSeconds)}</p>
          <p className="text-xs text-slate-500">{t.durationOf(report.settings.durationMinutes)}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-slate-500">{t.answered}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{overview.answeredQuestions}</p>
          <p className="text-xs text-slate-500">{t.answeredDetail(overview.mainQuestions, overview.followUps)}</p>
        </Card>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Score by criterion */}
        <Card>
          <h2 className="text-base font-semibold">{t.criteriaTitle}</h2>
          <ul className="mt-4 space-y-4">
            {criteria.map((c) => {
              const value = report.criteria[c];
              const tone = scoreTone(value);
              return (
                <li key={c}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium text-slate-800">
                      {t.criteria[c]}
                      <span className="ml-2 text-xs font-normal text-slate-500">{t.criteriaHint[c]}</span>
                    </span>
                    <span className="font-semibold tabular-nums text-slate-900">
                      {value === null ? "—" : `${one(value)} / 10`}
                    </span>
                  </div>
                  <div
                    className="mt-1.5 h-2.5 rounded-full bg-slate-100"
                    role="meter"
                    aria-label={t.criteria[c]}
                    aria-valuemin={0}
                    aria-valuemax={10}
                    aria-valuenow={value ?? 0}
                  >
                    <div className={`h-2.5 rounded-full ${tone.bar}`} style={{ width: `${((value ?? 0) / 10) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            {!report.structureApplies && <>{t.structureHidden} </>}
            {t.confidenceNote}
          </p>
        </Card>

        {/* Summary: strengths and improvements */}
        <Card>
          <h2 className="text-base font-semibold">{t.summaryTitle}</h2>
          {summary.status === "ready" ? (
            <>
              <p className="mt-2 text-sm leading-6 text-slate-700">{summary.text}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-emerald-50 p-3">
                  <h3 className="text-sm font-semibold text-emerald-900">{t.strengths}</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-emerald-950">
                    {summary.strengths.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg bg-amber-50 p-3">
                  <h3 className="text-sm font-semibold text-amber-900">{t.improvements}</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-950">
                    {summary.improvements.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-3 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">
              <p>{t.summaryUnavailable}</p>
              {summary.errorCode && t.summaryErrors[summary.errorCode] && <p>{t.summaryErrors[summary.errorCode]}</p>}
              <Button variant="secondary" onClick={onRetrySummary} disabled={!onRetrySummary}>
                {t.retry}
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Speaking indicators */}
      <Card>
        <h2 className="text-base font-semibold">{t.speakingTitle}</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="text-xs font-medium text-slate-500">{t.fillers}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{speaking.fillerWords.total}</dd>
            <dd className="text-xs text-slate-500">
              {speaking.fillerWords.total === 0 ? t.fillersNone : t.fillersPer100(speaking.fillerWords.per100Words)}
            </dd>
            {speaking.fillerWords.top.length > 0 && (
              <dd className="mt-2 flex flex-wrap gap-1">
                {speaking.fillerWords.top.map((f) => (
                  <span key={f.word} className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-700 ring-1 ring-slate-200">
                    “{f.word}” × {f.count}
                  </span>
                ))}
              </dd>
            )}
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="text-xs font-medium text-slate-500">{t.pace}</dt>
            {speaking.paceAvailable && speaking.wordsPerMinute !== null ? (
              <>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                  {speaking.wordsPerMinute} <span className="text-sm font-normal text-slate-500">{t.paceUnit}</span>
                </dd>
                <dd className="text-xs text-slate-500">{t.paceFrom(speaking.timedAnswers)}</dd>
              </>
            ) : (
              <dd className="mt-1 text-sm text-slate-600">{t.paceNone}</dd>
            )}
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <dt className="text-xs font-medium text-slate-500">{t.avgLength}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
              {speaking.avgAnswerWords} <span className="text-sm font-normal text-slate-500">{t.wordsUnit}</span>
            </dd>
          </div>
        </dl>
      </Card>

      {/* Session timeline */}
      <Card>
        <h2 className="text-base font-semibold">{t.timelineTitle}</h2>
        <ol className="mt-4 space-y-0">
          {report.timeline.map((item, index) => (
            <TimelineRow key={item.position} item={item} last={index === report.timeline.length - 1} t={t} />
          ))}
        </ol>
      </Card>

      {/* Targeted practice questions (UC-10). Owner: Khang, SCRUM-203/204. */}
      <PracticeQuestions sessionId={report.sessionId} language={report.settings.language} />

      <p className="text-xs text-slate-500">{t.aiNotice}</p>
    </div>
  );
}

function TimelineRow({ item, last, t }: { item: ReportTimelineItem; last: boolean; t: (typeof REPORT_TEXT)["vi"] }) {
  const tone = scoreTone(item.score);
  const details = [
    item.topic,
    item.answered ? t.words(item.answerWords) : null,
    item.durationSeconds ? t.spoke(clock(item.durationSeconds)) : null,
  ].filter(Boolean);
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!last && <span aria-hidden="true" className="absolute left-[calc(3.8125rem-0.5px)] top-6 h-full w-px bg-slate-200" />}
      <span className="w-11 shrink-0 pt-0.5 text-right font-mono text-xs tabular-nums text-slate-500">
        {clock(item.offsetSeconds)}
      </span>
      <span
        aria-hidden="true"
        className={`relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${item.answered ? "bg-indigo-600" : "border-2 border-slate-300 bg-white"}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">
            {item.position}. {t.kind[item.kind]}
          </span>
          {!item.answered ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{t.notAnswered}</span>
          ) : (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${tone.chip}`}>
              {item.score === null ? t.noScore : `${one(item.score)} / 10`}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-slate-900">{item.question}</p>
        {details.length > 0 && <p className="text-xs text-slate-500">{details.join(" · ")}</p>}
      </div>
    </li>
  );
}
