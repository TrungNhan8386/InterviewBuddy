// Types for the Interview Session API. Import these in the Setup page, e.g.
// import type { CreateInterviewRequest } from "@/lib/interview/session-contract.mjs";

export type InterviewType = 'hr' | 'technical' | 'behavioral';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type InterviewLanguage = 'vi' | 'en';
export type DurationMinutes = 15 | 30 | 45;
export type InputMode = 'text' | 'voice';
export type SessionStatus = 'in_progress' | 'completed' | 'abandoned';

/** Body of POST /api/interview. */
export interface CreateInterviewRequest {
  type: InterviewType;
  difficulty: Difficulty;
  language: InterviewLanguage;
  targetPosition: string;
  /** YYYY-MM-DD, today or later. Optional. */
  interviewDate?: string | null;
  durationMinutes: DurationMinutes;
  inputMode: InputMode;
  /** Omit to link the latest saved analysis; null for none. */
  fitAnalysisId?: string | null;
}

/** 201 response of POST /api/interview. */
export interface CreateInterviewResponse {
  sessionId: string;
  fitAnalysisId: string | null;
}

export interface InterviewSettings {
  type: InterviewType;
  difficulty: Difficulty;
  language: InterviewLanguage;
  targetPosition: string | null;
  interviewDate: string | null;
  durationMinutes: DurationMinutes;
  inputMode: InputMode;
  plannedQuestions: number;
}

/** 200 response of GET /api/interview/{id}. */
export interface InterviewSessionResponse {
  id: string;
  status: SessionStatus;
  createdAt: string;
  /** Set when the first question is requested; the interview timer starts here. */
  startedAt: string | null;
  endedAt: string | null;
  settings: InterviewSettings;
  analysis: {
    id: string;
    fitScore: number | null;
    language: InterviewLanguage;
    createdAt: string;
    /** The saved /api/analyze-fit response. */
    result: Record<string, unknown>;
  } | null;
}

/** One question of the session and the user's answer (null until answered). */
export interface InterviewTurn {
  question: {
    id: string;
    position: number;
    kind: 'main' | 'follow_up' | 'practice';
    topic: string | null;
    content: string;
    createdAt: string;
  };
  answer: {
    id: string;
    content: string;
    inputMode: InputMode;
    durationSeconds: number | null;
    createdAt: string;
  } | null;
}

/** What the chat page should do when it opens a session (SCRUM-80). */
export type ResumeState =
  | { state: 'not_started'; afterAnswerId: null }
  | { state: 'awaiting_answer'; questionId: string }
  | { state: 'awaiting_question'; afterAnswerId: string }
  | { state: 'finished' };

export interface InterviewProgress {
  mainQuestionsAsked: number;
  mainQuestionsAnswered: number;
  plannedQuestions: number;
}

/** 200 response of GET /api/interview/{id}. */
export interface InterviewSessionDetailResponse extends InterviewSessionResponse {
  turns: InterviewTurn[];
  progress: InterviewProgress;
  resume: ResumeState;
}

/** Body of POST /api/interview/{id}/answers. */
export interface SaveAnswerRequest {
  questionId: string;
  content: string;
  /** Default 'text'. */
  inputMode?: InputMode;
  /** Seconds spent answering (voice answers), 0–3600. */
  durationSeconds?: number | null;
}

/** 201 (new) or 200 (already saved) response of POST /api/interview/{id}/answers. */
export interface SaveAnswerResponse {
  answer: { id: string; questionId: string; createdAt: string };
  alreadySaved: boolean;
}

/** 200 response of POST /api/interview/{id}/end. */
export interface EndInterviewResponse {
  id: string;
  status: SessionStatus;
  endedAt: string | null;
}

export type InterviewApiErrorCode =
  | 'BAD_INPUT' | 'UNAUTHORIZED' | 'NOT_FOUND' | 'STALE_TURN' | 'SESSION_CLOSED' | 'SERVER_ERROR';

export interface InterviewApiError {
  error: {
    code: InterviewApiErrorCode;
    message: string;
    /** For BAD_INPUT: field name -> problem. */
    fields?: Record<string, string>;
  };
}

export type ValidationResult =
  | { ok: true; value: Required<Omit<CreateInterviewRequest, 'fitAnalysisId'>> & { fitAnalysisId: string | null | undefined } }
  | { ok: false; fields: Record<string, string> };

export const INTERVIEW_TYPES: InterviewType[];
export const DIFFICULTIES: Difficulty[];
export const LANGUAGES: InterviewLanguage[];
export const DURATIONS: DurationMinutes[];
export const INPUT_MODES: InputMode[];
export const QUESTIONS_BY_DURATION: Record<DurationMinutes, number>;
export const TARGET_POSITION_MAX: number;

export function isUuid(value: unknown): value is string;
export function todayInVietnam(now?: Date): string;
export function validateCreateSession(body: unknown, options: { today: string }): ValidationResult;
export function toSessionRow(
  value: Extract<ValidationResult, { ok: true }>['value'],
  context: { userId: string; analysis: { id: string; jd_text: string; cv_text: string } | null },
): Record<string, unknown>;
export function toSessionResponse(row: Record<string, unknown>): InterviewSessionResponse;

export const ANSWER_MAX: number;
export const ANSWER_DURATION_MAX: number;
export function validateSaveAnswer(body: unknown):
  | { ok: true; value: Required<SaveAnswerRequest> }
  | { ok: false; fields: Record<string, string> };
export function toTurns(questionRows: Record<string, unknown>[]): InterviewTurn[];
export function toResumeState(status: SessionStatus, turns: InterviewTurn[]): ResumeState;
export function toProgress(turns: InterviewTurn[], plannedQuestions: number): InterviewProgress;
