// Targeted practice section on the Report page (UC-10). Owner: Khang. Jira: SCRUM-203, SCRUM-204.
// Shape of /api/practice/generate and /api/practice/start (docs/api/PRACTICE_API_v1.md).

export type PracticeCriterion = "content" | "structure" | "clarity" | "confidence";
export type PracticeLanguage = "vi" | "en";

export interface PracticeQuestion {
  id: string;
  position: number;
  question: string;
  tip: string | null;
  /** Latest practice session started from this question, or null. */
  practiceSessionId: string | null;
}

export interface PracticeGroup {
  criterion: PracticeCriterion;
  /** Average score of the criterion in this report (0–10). */
  score: number | null;
  questions: PracticeQuestion[];
}

export interface PracticeSet {
  sessionId: string;
  language: PracticeLanguage;
  generatedAt: string | null;
  /** Both criteria score 7.5 or more: show "no major weakness" (UC-10 AF3). */
  noMajorWeakness: boolean;
  alreadySaved: boolean;
  groups: PracticeGroup[];
}

export type PracticeErrorCode =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "SESSION_NOT_COMPLETED"
  | "NOT_ENOUGH_SCORES"
  | "AI_DAILY_LIMIT"
  | "AI_RATE_LIMITED"
  | "AI_UNAVAILABLE"
  | "AI_TIMEOUT"
  | "AI_CONTENT_BLOCKED"
  | "INVALID_OUTPUT"
  | "AI_NOT_CONFIGURED"
  | "AI_CONFIGURATION_ERROR"
  | "DATABASE_NOT_READY"
  | "NETWORK_ERROR"
  | "REQUEST_CANCELLED"
  | "SERVER_ERROR";

export class PracticeViewError extends Error {
  constructor(
    public code: PracticeErrorCode,
    public resetAt: string | null = null,
  ) {
    super(code);
    this.name = "PracticeViewError";
  }
}

// Codes where "Try again" can help (UC-10 AF4). The daily limit is shown without it.
export const RETRY_CODES: PracticeErrorCode[] = [
  "AI_RATE_LIMITED",
  "AI_UNAVAILABLE",
  "AI_TIMEOUT",
  "AI_CONTENT_BLOCKED",
  "INVALID_OUTPUT",
  "NETWORK_ERROR",
  "SERVER_ERROR",
];
