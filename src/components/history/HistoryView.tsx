"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ProgressChart from "@/components/history/ProgressChart";
import SessionList from "@/components/history/SessionList";
import { mockHistory, type HistoryDemo } from "@/lib/history/mock";
import { HISTORY_TEXT as t } from "@/lib/history/text";
import type { HistoryDateFilter, HistorySession, HistoryTypeFilter } from "@/lib/history/types";

// History page (UC-11). Owner: Khang. Jira: SCRUM-206 – W8 skeleton with sample data:
// session list, Progress Overview chart, filters by type and date, empty / no-match /
// loading / error states. W9: load the History API (Hưng) in load() and remove the notice.

type State = { kind: "loading" } | { kind: "error" } | { kind: "ready"; sessions: HistorySession[]; loadedAt: number };

const DAYS: Record<HistoryDateFilter, number | null> = { all: null, "7d": 7, "30d": 30 };

export default function HistoryView({ demo = "default" }: { demo?: HistoryDemo }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [type, setType] = useState<HistoryTypeFilter>("all");
  const [range, setRange] = useState<HistoryDateFilter>("all");

  // Sample data for now; a short delay so the loading state can be checked.
  // State changes only in the timer callback (the first render already shows "loading").
  const fetchSessions = useCallback(() => {
    if (demo === "loading") return undefined;
    const timer = setTimeout(() => {
      const now = Date.now();
      setState(demo === "error" ? { kind: "error" } : { kind: "ready", sessions: mockHistory(demo, now).sessions, loadedAt: now });
    }, 400);
    return () => clearTimeout(timer);
  }, [demo]);

  useEffect(() => fetchSessions(), [fetchSessions]);

  function retry() {
    setState({ kind: "loading" });
    fetchSessions();
  }

  const all = useMemo(() => (state.kind === "ready" ? state.sessions : []), [state]);
  const loadedAt = state.kind === "ready" ? state.loadedAt : 0;
  const filtered = useMemo(() => {
    const days = DAYS[range];
    // "Last 7 days" counts from when the list was loaded.
    const since = days === null ? null : loadedAt - days * 24 * 60 * 60 * 1000;
    return all.filter((s) => (type === "all" || s.type === type) && (since === null || Date.parse(s.startedAt) >= since));
  }, [all, type, range, loadedAt]);
  const filtering = type !== "all" || range !== "all";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t.title}</h1>
        <p className="mt-1 text-sm text-slate-600">{t.subtitle}</p>
      </div>
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800" role="note">
        {t.sampleNotice}
      </p>

      {state.kind === "loading" && (
        <Card aria-busy="true">
          <p className="flex items-center gap-2 text-sm text-slate-700" role="status">
            <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
            {t.loading}
          </p>
          <div className="mt-4 space-y-3" aria-hidden="true">
            <div className="h-36 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
          </div>
        </Card>
      )}

      {state.kind === "error" && (
        <Card role="alert" className="space-y-2 border-amber-200 bg-amber-50 text-amber-900">
          <h2 className="font-semibold">{t.errorTitle}</h2>
          <p className="text-sm">{t.errorHint}</p>
          <Button variant="secondary" onClick={retry}>
            {t.retry}
          </Button>
        </Card>
      )}

      {state.kind === "ready" && all.length === 0 && (
        <Card className="py-10 text-center">
          <h2 className="text-lg font-semibold text-slate-900">{t.emptyTitle}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{t.emptyHint}</p>
          <Link
            href="/interview/new"
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            {t.startNew}
          </Link>
        </Card>
      )}

      {state.kind === "ready" && all.length > 0 && (
        <>
          {/* Filters: one row above the chart and the list, both follow them (UC-11 step 4–5). */}
          <div className="grid grid-cols-2 gap-3 sm:flex sm:items-end">
            <label className="block min-w-0 text-xs font-medium text-slate-600">
              {t.filterType}
              <select
                value={type}
                onChange={(e) => setType(e.target.value as HistoryTypeFilter)}
                className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 sm:w-44"
              >
                {(Object.keys(t.types) as HistoryTypeFilter[]).map((k) => (
                  <option key={k} value={k}>
                    {t.types[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-0 text-xs font-medium text-slate-600">
              {t.filterDate}
              <select
                value={range}
                onChange={(e) => setRange(e.target.value as HistoryDateFilter)}
                className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 sm:w-44"
              >
                {(Object.keys(t.dates) as HistoryDateFilter[]).map((k) => (
                  <option key={k} value={k}>
                    {t.dates[k]}
                  </option>
                ))}
              </select>
            </label>
            {filtering && (
              <Button variant="secondary" className="col-span-2 sm:col-span-1" onClick={() => { setType("all"); setRange("all"); }}>
                {t.clearFilters}
              </Button>
            )}
          </div>

          <ProgressChart sessions={filtered} />

          <Card>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold">{t.sessionsTitle}</h2>
              <span className="text-xs text-slate-500">{t.count(filtered.length, all.length)}</span>
            </div>
            {filtered.length === 0 ? (
              <div className="mt-4 rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-600">
                <p>{t.noMatch}</p>
                <Button variant="secondary" className="mt-3" onClick={() => { setType("all"); setRange("all"); }}>
                  {t.clearFilters}
                </Button>
              </div>
            ) : (
              <div className="mt-2">
                <SessionList sessions={filtered} />
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
