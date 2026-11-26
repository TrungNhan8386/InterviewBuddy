"use client";

import { useEffect, useRef, useState } from "react";
import Card from "@/components/ui/Card";
import { HISTORY_TEXT as t } from "@/lib/history/text";
import type { HistorySession } from "@/lib/history/types";

// Progress Overview (UC-11 step 3): overall score of each scored session in time order.
// One series, so no legend; the session table below is the table view of the same data.

const H = 200;
const PAD = { left: 32, right: 16, top: 16, bottom: 28 };

function one(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function shortDate(iso: string) {
  return new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit" }).format(new Date(iso));
}

export default function ProgressChart({ sessions }: { sessions: HistorySession[] }) {
  const [active, setActive] = useState<number | null>(null);
  // The SVG is drawn at its real width, so labels keep their size from 360 px to desktop.
  const box = useRef<HTMLDivElement>(null);
  const drawn = sessions.filter((s) => s.status === "completed" && s.overallScore !== null).length >= 2;
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, [drawn]);
  const points = sessions
    .filter((s): s is HistorySession & { overallScore: number } => s.status === "completed" && s.overallScore !== null)
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));

  const scores = points.map((p) => p.overallScore);
  const average = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const change = scores.length >= 2 ? scores[scores.length - 1] - scores[0] : null;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (score: number) => PAD.top + plotH - (score / 10) * plotH;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.overallScore).toFixed(1)}`).join(" ");
  const shown = active !== null ? points[active] : null;

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">{t.progressTitle}</h2>
          <p className="mt-1 text-sm text-slate-600">{t.progressHint}</p>
        </div>
        {scores.length > 0 && (
          <dl className="grid grid-cols-3 gap-2 text-center sm:min-w-72">
            <div className="rounded-lg bg-slate-50 px-2 py-1.5">
              <dt className="text-xs text-slate-500">{t.average}</dt>
              <dd className="font-semibold tabular-nums text-slate-900">{one(Math.round((average ?? 0) * 10) / 10)}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 px-2 py-1.5">
              <dt className="text-xs text-slate-500">{t.best}</dt>
              <dd className="font-semibold tabular-nums text-slate-900">{one(Math.max(...scores))}</dd>
            </div>
            <div className="rounded-lg bg-slate-50 px-2 py-1.5">
              <dt className="text-xs text-slate-500">{t.latest}</dt>
              <dd className="font-semibold tabular-nums text-slate-900">{one(scores[scores.length - 1])}</dd>
            </div>
          </dl>
        )}
      </div>

      {points.length < 2 ? (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-600">{t.progressFew}</p>
      ) : (
        <div ref={box} className="relative mt-4">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width={W}
            height={H}
            className="block w-full"
            role="img"
            aria-label={`${t.progressTitle}: ${points.map((p) => `${shortDate(p.startedAt)} ${one(p.overallScore)}`).join(", ")}`}
            onMouseLeave={() => setActive(null)}
          >
            {[0, 2.5, 5, 7.5, 10].map((g) => (
              <g key={g}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(g)} y2={y(g)} stroke="#e2e8f0" strokeWidth="1" />
                <text x={PAD.left - 8} y={y(g) + 4} textAnchor="end" className="fill-slate-500 text-[11px]">
                  {g % 1 === 0 ? g : ""}
                </text>
              </g>
            ))}
            {shown && active !== null && (
              <line x1={x(active)} x2={x(active)} y1={PAD.top} y2={PAD.top + plotH} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />
            )}
            <path d={path} fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) => (
              <g key={p.id}>
                <circle cx={x(i)} cy={y(p.overallScore)} r={active === i ? 6 : 4.5} fill="#4f46e5" stroke="#ffffff" strokeWidth="2" />
                {(i === 0 || i === points.length - 1) && (
                  <text x={x(i)} y={PAD.top + plotH + 18} textAnchor={i === 0 ? "start" : "end"} className="fill-slate-500 text-[11px]">
                    {shortDate(p.startedAt)}
                  </text>
                )}
                {/* Hit target wider than the mark. */}
                <rect
                  x={x(i) - plotW / Math.max(points.length - 1, 1) / 2}
                  y={PAD.top}
                  width={plotW / Math.max(points.length - 1, 1)}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  tabIndex={0}
                  aria-label={`${shortDate(p.startedAt)}: ${one(p.overallScore)}/10`}
                />
              </g>
            ))}
          </svg>
          {shown && active !== null && (
            <div
              className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow"
              style={{ left: `${Math.min(88, Math.max(12, (x(active) / W) * 100))}%` }}
              role="status"
            >
              {shortDate(shown.startedAt)} · {t.typeShort[shown.type]}
              {shown.isPractice ? ` · ${t.practice}` : ""} · <span className="font-semibold">{one(shown.overallScore)}/10</span>
            </div>
          )}
          {change !== null && (
            <p className={`mt-1 text-xs ${change > 0 ? "text-emerald-700" : change < 0 ? "text-amber-700" : "text-slate-500"}`}>
              {t.change(`${change > 0 ? "+" : ""}${one(Math.round(change * 10) / 10)}`)}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
