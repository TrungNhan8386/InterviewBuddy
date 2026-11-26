import Link from "next/link";
import { HISTORY_TEXT as t } from "@/lib/history/text";
import type { HistorySession } from "@/lib/history/types";

// Session list (UC-11 step 2): role and type, date, duration, score and View Report / Resume.
// A table from 640 px up; stacked cards on phones (360 px) so nothing scrolls sideways.

function one(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function date(iso: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function clock(seconds: number | null) {
  if (seconds === null) return "--:--";
  const s = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function scoreChip(score: number | null) {
  if (score === null) return "bg-slate-100 text-slate-600";
  if (score >= 7.5) return "bg-emerald-50 text-emerald-800";
  if (score >= 5) return "bg-indigo-50 text-indigo-800";
  return "bg-amber-50 text-amber-900";
}

function Action({ s }: { s: HistorySession }) {
  const cls = "inline-flex min-h-11 items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";
  if (s.status === "in_progress") {
    return (
      <Link href={`/interview/${s.id}`} className={`${cls} bg-indigo-600 text-white hover:bg-indigo-700`}>
        {t.resume}
      </Link>
    );
  }
  if (s.status === "completed") {
    return (
      <Link href={`/reports/${s.id}`} className={`${cls} border border-slate-300 bg-white text-slate-700 hover:bg-slate-100`}>
        {t.viewReport}
      </Link>
    );
  }
  return null;
}

function Badges({ s }: { s: HistorySession }) {
  return (
    <span className="flex flex-wrap gap-1">
      {s.isPractice && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800">{t.practice}</span>}
      {s.status !== "completed" && (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{t.status[s.status]}</span>
      )}
    </span>
  );
}

export default function SessionList({ sessions }: { sessions: HistorySession[] }) {
  return (
    <>
      {/* Phones */}
      <ul className="divide-y divide-slate-100 sm:hidden">
        {sessions.map((s) => (
          <li key={s.id} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words font-semibold text-slate-900">{s.targetPosition || t.noRole}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {t.typeShort[s.type]} · {date(s.startedAt)} · {clock(s.durationSeconds)}
                </p>
                <div className="mt-1">
                  <Badges s={s} />
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-sm font-semibold tabular-nums ${scoreChip(s.overallScore)}`}>
                {s.overallScore === null ? t.noScore : one(s.overallScore)}
              </span>
            </div>
            <div className="mt-2 flex justify-end [&>a]:w-full">
              <Action s={s} />
            </div>
          </li>
        ))}
      </ul>

      {/* Tablet and desktop */}
      <div className="hidden sm:block">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr className="border-b border-slate-200">
              <th scope="col" className="py-2 pr-3 font-medium">{t.columns.role}</th>
              <th scope="col" className="py-2 pr-3 font-medium">{t.columns.type}</th>
              <th scope="col" className="py-2 pr-3 font-medium">{t.columns.date}</th>
              <th scope="col" className="py-2 pr-3 font-medium">{t.columns.duration}</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">{t.columns.score}</th>
              <th scope="col" className="py-2 font-medium"><span className="sr-only">{t.viewReport}</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sessions.map((s) => (
              <tr key={s.id}>
                <td className="py-3 pr-3">
                  <p className="font-medium text-slate-900">{s.targetPosition || t.noRole}</p>
                  <Badges s={s} />
                </td>
                <td className="py-3 pr-3 text-slate-700">{t.typeShort[s.type]}</td>
                <td className="py-3 pr-3 tabular-nums text-slate-700">{date(s.startedAt)}</td>
                <td className="py-3 pr-3 font-mono tabular-nums text-slate-700">{clock(s.durationSeconds)}</td>
                <td className="py-3 pr-3 text-right">
                  <span className={`rounded-full px-2 py-0.5 font-semibold tabular-nums ${scoreChip(s.overallScore)}`}>
                    {s.overallScore === null ? t.noScore : one(s.overallScore)}
                  </span>
                </td>
                <td className="py-3 text-right">
                  <Action s={s} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
