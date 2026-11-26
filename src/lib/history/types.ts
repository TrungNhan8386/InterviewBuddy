// History page (Screen: History, UC-11). Owner: Khang. Jira: SCRUM-206 (W8 skeleton with sample data).
// Draft shape for the History API (Hưng, W9, sample due Tue 1/12). The page only reads these fields,
// so when the real API arrives only client.ts changes. See docs/api/HISTORY_CONTRACT_DRAFT.md.

export type HistoryType = "hr" | "technical" | "behavioral";
export type HistoryStatus = "in_progress" | "completed" | "abandoned";

export interface HistorySession {
  id: string;
  targetPosition: string | null;
  type: HistoryType;
  difficulty: "easy" | "medium" | "hard";
  language: "vi" | "en";
  status: HistoryStatus;
  /** True when the session was started from a targeted practice question (UC-10). */
  isPractice: boolean;
  startedAt: string;
  endedAt: string | null;
  /** Real length of the session in seconds; null while unfinished. */
  durationSeconds: number | null;
  /** Overall report score 0–10; null when unfinished or not scored. */
  overallScore: number | null;
}

export interface HistoryResponse {
  sessions: HistorySession[];
}

export type HistoryTypeFilter = "all" | HistoryType;
export type HistoryDateFilter = "all" | "7d" | "30d";
