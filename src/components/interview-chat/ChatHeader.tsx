"use client";

import { useEffect, useState } from "react";
import type { CHAT_TEXT } from "@/lib/interview-chat/text";
import type { ChatSettings } from "@/lib/interview-chat/types";

type Props = {
  text: (typeof CHAT_TEXT)["vi"];
  settings: ChatSettings;
  currentQuestion: number; // number of main questions asked so far
  startedAt: string | null;
  running: boolean;
};

function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// SCRUM-97: interview type, progress "Question 3 of 10", timer.
export default function ChatHeader({ text, settings, currentQuestion, startedAt, running }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);

  const total = settings.plannedQuestions;
  const shown = Math.min(Math.max(currentQuestion, 1), total);
  const percent = Math.round((Math.min(currentQuestion, total) / total) * 100);

  const start = startedAt ? Date.parse(startedAt) : NaN;
  const left = Number.isFinite(start) ? settings.durationMinutes * 60 - (now - start) / 1000 : null;
  const lowTime = left !== null && left <= 60;

  return (
    <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
            {text.types[settings.type]} · {text.difficulties[settings.difficulty]}
          </p>
          <h1 className="mt-1 break-words text-lg font-bold sm:text-xl">{settings.targetPosition}</h1>
        </div>

        <div className="text-right" aria-live="off">
          <p className="text-xs text-slate-500">{text.timeLeft}</p>
          <p
            className={`font-mono text-lg font-semibold tabular-nums ${lowTime ? "text-red-600" : "text-slate-900"}`}
            role="timer"
          >
            {left === null ? "--:--" : left <= 0 ? text.timeUp : formatClock(left)}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex justify-between text-xs text-slate-600">
          <span>{text.questionOf(shown, total)}</span>
          <span>{percent}%</span>
        </div>
        <div
          className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={Math.min(currentQuestion, total)}
          aria-label={text.questionOf(shown, total)}
        >
          <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </header>
  );
}
