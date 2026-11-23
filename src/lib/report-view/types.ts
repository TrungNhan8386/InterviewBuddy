// Report page (Screen 6, UC-09). Owner: Tài. Jira: SCRUM-185 (skeleton, W7), W8: connect to the API.
// Shape of GET /api/report/{sessionId} (Nhân, SCRUM-186, docs/api/REPORT_API_v1.md).
// Copied from src/lib/report/report-service.d.mts on branch feat/scrum-186-report-backend, which is
// not merged yet. After the merge, import ReportResponse from there and delete this copy.

export type ReportCriterion = "content" | "structure" | "clarity" | "confidence";

export type ReportSummaryErrorCode =
  | "AI_DAILY_LIMIT"
  | "AI_RATE_LIMITED"
  | "AI_UNAVAILABLE"
  | "AI_TIMEOUT"
  | "AI_CONTENT_BLOCKED"
  | "INVALID_OUTPUT"
  | "AI_NOT_CONFIGURED"
  | "AI_CONFIGURATION_ERROR"
  | "SUMMARY_NOT_GENERATED";

export interface ReportTimelineItem {
  position: number;
  kind: "main" | "follow_up" | "practice";
  topic: string | null;
  question: string;
  askedAt: string | null;
  /** Seconds after the interview started. */
  offsetSeconds: number | null;
  answered: boolean;
  answerWords: number;
  durationSeconds: number | null;
  /** Overall score of the answer (0–10); null when not scored. */
  score: number | null;
  scores: Record<ReportCriterion, number | null> | null;
}

export interface ReportResponse {
  sessionId: string;
  generatedAt: string;
  settings: {
    type: "hr" | "technical" | "behavioral";
    difficulty: "easy" | "medium" | "hard";
    language: "vi" | "en";
    targetPosition: string | null;
    durationMinutes: number;
  };
  overview: {
    overallScore: number;
    scale: 10;
    mainQuestions: number;
    followUps: number;
    answeredQuestions: number;
    scoredAnswers: number;
    startedAt: string | null;
    endedAt: string | null;
    durationSeconds: number | null;
    /** Compared with the previous completed session that has a report; null for the first one. */
    trend: { previousSessionId: string; previousOverallScore: number; change: number } | null;
  };
  /** Averages on 0–10. structure is null when STAR does not apply (non-behavioral interview). */
  criteria: Record<ReportCriterion, number | null>;
  structureApplies: boolean;
  speaking: {
    answeredQuestions: number;
    totalWords: number;
    avgAnswerWords: number;
    fillerWords: { total: number; per100Words: number; top: { word: string; count: number }[] };
    /** false when no answer has a recorded duration (typed answers). */
    paceAvailable: boolean;
    timedAnswers: number;
    wordsPerMinute: number | null;
  };
  summary:
    | { status: "ready"; text: string; strengths: string[]; improvements: string[] }
    | { status: "unavailable"; errorCode: ReportSummaryErrorCode | null; text: null; strengths: []; improvements: [] };
  timeline: ReportTimelineItem[];
}
