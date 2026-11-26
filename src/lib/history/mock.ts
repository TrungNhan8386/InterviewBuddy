import type { HistoryResponse, HistorySession } from "./types";

// Sample sessions for the History skeleton (SCRUM-206). Not real data.
// Try the states with /history?demo=empty | error | loading.
export type HistoryDemo = "default" | "empty" | "error" | "loading";
export const HISTORY_DEMOS: HistoryDemo[] = ["default", "empty", "error", "loading"];

const DAY = 24 * 60 * 60 * 1000;

function session(
  n: number,
  daysAgo: number,
  type: HistorySession["type"],
  score: number | null,
  extra: Partial<HistorySession> = {},
  now = Date.now(),
): HistorySession {
  const start = new Date(now - daysAgo * DAY);
  const durationSeconds = extra.status === "in_progress" ? null : 600 + n * 47;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    targetPosition: "Frontend Developer Intern",
    type,
    difficulty: "medium",
    language: "vi",
    status: "completed",
    isPractice: false,
    startedAt: start.toISOString(),
    endedAt: durationSeconds === null ? null : new Date(start.getTime() + durationSeconds * 1000).toISOString(),
    durationSeconds,
    overallScore: score,
    ...extra,
  };
}

/** Newest first, like the real list. Dates are relative to now so the date filter can be tried. */
export function mockHistory(demo: HistoryDemo = "default", now = Date.now()): HistoryResponse {
  if (demo === "empty") return { sessions: [] };
  return {
    sessions: [
      session(9, 0.1, "behavioral", null, { status: "in_progress", isPractice: true, targetPosition: "Frontend Developer Intern" }, now),
      session(8, 1, "behavioral", 7.4, { isPractice: true }, now),
      session(7, 2, "behavioral", 6.6, {}, now),
      session(6, 5, "technical", 6.9, { language: "en", targetPosition: "React Developer" }, now),
      session(5, 9, "hr", 7.8, { difficulty: "easy" }, now),
      session(4, 13, "technical", 5.8, {}, now),
      session(3, 18, "behavioral", 5.1, {}, now),
      session(2, 26, "technical", null, { status: "abandoned" }, now),
      session(1, 41, "hr", 4.9, { difficulty: "easy", targetPosition: "Software Engineer Intern" }, now),
    ],
  };
}
