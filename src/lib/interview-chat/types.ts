// Types for the chat interview page /interview/[id] (SCRUM-95). Owner: Khang.
// Contracts:
// - GET /api/interview/{id}: docs/api/INTERVIEW_SESSION_API_v1.md (Nhân)
// - POST /api/interview/next: docs/api/INTERVIEW_NEXT_API_v1.md (Hưng, SCRUM-92/93)
// If a provider changes the JSON shape, update this file first.

export type InterviewLanguage = "vi" | "en";
export type InterviewType = "hr" | "technical" | "behavioral";
export type InterviewDifficulty = "easy" | "medium" | "hard";
export type SessionStatus = "in_progress" | "completed" | "abandoned";

export type ChatSettings = {
  type: InterviewType;
  difficulty: InterviewDifficulty;
  language: InterviewLanguage;
  targetPosition: string;
  durationMinutes: number;
  plannedQuestions: number;
  inputMode: "text" | "voice";
};

export type ChatQuestion = {
  id: string;
  content: string;
  topic: string;
  kind: "main" | "follow_up";
  position: number;
};

export type ChatAnswer = { id: string; content: string };

// One question and (once the user replied) its saved answer.
export type ChatTurn = { question: ChatQuestion; answer: ChatAnswer | null };

export type ChatSession = {
  id: string;
  status: SessionStatus;
  startedAt: string | null;
  settings: ChatSettings;
  // Skill names from the linked /api/analyze-fit result; null when no analysis is linked.
  skills: { matched: string[]; missing: string[] } | null;
  turns: ChatTurn[];
};

export type NextAction = "follow_up" | "next_topic" | "end";
export type NextResult = { action: NextAction; question: ChatQuestion | null };

export type ChatErrorCode =
  | "BAD_INPUT"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "STALE_TURN"
  | "GENERATION_IN_PROGRESS"
  | "LEASE_LOST"
  | "SESSION_CONTEXT_INVALID"
  | "AI_CONTENT_BLOCKED"
  | "AI_RATE_LIMITED"
  | "INVALID_OUTPUT"
  | "AI_UNAVAILABLE"
  | "DATABASE_NOT_READY"
  | "AI_NOT_CONFIGURED"
  | "AI_TIMEOUT"
  | "AI_DAILY_LIMIT"
  | "SESSION_CLOSED"
  | "RESPONSE_TIMEOUT"
  | "REQUEST_CANCELLED"
  | "SAVE_FAILED" // client side: the answer could not be saved
  | "NETWORK_ERROR" // client side: the request never reached the server
  | "SERVER_ERROR";

export class InterviewChatError extends Error {
  constructor(
    public code: ChatErrorCode,
    message: string = code,
  ) {
    super(message);
  }
}

// Same limit as the interview engine (each answer at most 12k characters).
export const ANSWER_MAX_CHARS = 12000;
