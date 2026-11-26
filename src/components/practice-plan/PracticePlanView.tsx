"use client";

import Link from "next/link";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { PLAN_TEXT as T } from "@/lib/practice-plan/text";
import type { PlanTask, PracticePlan } from "@/lib/practice-plan/types";

// Screen: Practice Plan (UC-13). Owner: Tài. Jira: SCRUM-201 (skeleton with sample data).
// Done checkboxes only change local state here. Later they are saved through the plan API (UC-13 AF1).
// Generate plan and Add to Calendar are placeholders until the plan service exists.

type Props = {
  /** Today in Asia/Ho_Chi_Minh, YYYY-MM-DD (from the server, so the page renders the same on both sides). */
  today: string;
  plan: PracticePlan | null;
};

function dayNumber(day: string) {
  return Math.round(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
}

function display(day: string) {
  const [year, month, date] = day.split("-");
  return `${date}/${month}/${year}`;
}

function weekday(day: string) {
  return new Intl.DateTimeFormat("vi-VN", { weekday: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}

export default function PracticePlanView({ today, plan }: Props) {
  const [tasks, setTasks] = useState<PlanTask[]>(plan?.tasks ?? []);
  const [interviewDate, setInterviewDate] = useState(plan?.interviewDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState(false);

  function toggle(id: string) {
    setTasks((current) => current.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
  }

  function generate() {
    setNotice(false);
    if (!interviewDate) return setError(T.dateRequired);
    if (interviewDate < today) return setError(T.datePast);
    setError(null);
    setNotice(true);
  }

  const doneCount = tasks.filter((item) => item.done).length;
  const percent = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{T.title}</h1>
          {plan ? (
            <p className="mt-1 text-sm text-slate-600">
              {T.subtitle(plan.targetRole, display(plan.interviewDate), dayNumber(plan.interviewDate) - dayNumber(today))}
            </p>
          ) : null}
        </div>
        <Button variant="secondary" disabled title={T.soon}>
          {T.addToCalendar} · {T.soon}
        </Button>
      </header>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label htmlFor="interview-date" className="block text-sm font-medium text-slate-700">
              {T.interviewDateLabel}
            </label>
            <input
              id="interview-date"
              type="date"
              min={today}
              value={interviewDate}
              onChange={(event) => {
                setInterviewDate(event.target.value);
                setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "interview-date-error" : undefined}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm"
            />
          </div>
          <Button onClick={generate}>{T.generate}</Button>
        </div>
        {error ? (
          <p id="interview-date-error" role="alert" className="mt-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="mt-2 text-sm text-slate-600">
            {T.generateSoon}
          </p>
        ) : null}
      </Card>

      {plan ? (
        <>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800" role="note">
            {T.sampleNote}
          </p>

          {plan.weakCriteria.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-sky-50 px-3 py-3 text-sm text-sky-800" role="note">
              <span>{T.generalNote}</span>
              <Link href="/interview/new" className="font-medium underline">
                {T.startInterview}
              </Link>
            </div>
          ) : (
            <p className="text-sm text-slate-700">
              <span className="font-medium">{T.weakTitle}: </span>
              {plan.weakCriteria.map((criterion) => T.criteria[criterion]).join(", ")}
            </p>
          )}

          <Card>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{T.progress(doneCount, tasks.length)}</span>
              <span className="text-slate-500">{percent}%</span>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={T.progress(doneCount, tasks.length)}
            >
              <div className="h-full bg-indigo-500" style={{ width: `${percent}%` }} />
            </div>
          </Card>

          <ol className="space-y-3" aria-label={T.title}>
            {tasks.map((item) => {
              const isToday = item.date === today;
              const isMissed = item.date < today && !item.done;
              return (
                <li
                  key={item.id}
                  aria-current={isToday ? "date" : undefined}
                  className={`flex items-start gap-3 rounded-xl border p-4 ${
                    isToday ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => toggle(item.id)}
                    aria-label={T.markDone(item.task)}
                    className="mt-1 h-5 w-5 shrink-0 accent-indigo-600"
                  />
                  <div className="shrink-0 text-center text-xs text-slate-500">
                    <p className="font-medium uppercase">{weekday(item.date)}</p>
                    <p className="text-base font-bold text-slate-800">{item.date.slice(8)}/{item.date.slice(5, 7)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {isToday ? <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-medium text-white">{T.today}</span> : null}
                      {isMissed ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">{T.missed}</span> : null}
                      {item.done ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">{T.done}</span> : null}
                      {item.criterion ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{T.criteria[item.criterion]}</span> : null}
                    </div>
                    <p className={`mt-1 text-sm font-medium ${item.done ? "text-slate-500 line-through" : "text-slate-900"}`}>{item.task}</p>
                    <p className="mt-1 text-xs text-slate-600">{item.reason}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <Card className="text-center">
          <h2 className="text-lg font-semibold">{T.emptyTitle}</h2>
          <p className="mt-1 text-sm text-slate-600">{T.emptyBody}</p>
        </Card>
      )}
    </div>
  );
}
