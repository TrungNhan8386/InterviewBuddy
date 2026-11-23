// Types for the Answer Feedback screen (Screen 5, UC-08). Owner: Khang. Jira: SCRUM-172 (174–177).
// Contract: POST /api/evaluate-answer (Hưng, SCRUM-166/168).
// Hưng has not sent the sample yet (SCRUM-168), so this is the DRAFT in
// docs/api/EVALUATE_ANSWER_CONTRACT_DRAFT.md. When the real sample arrives, update this file first.

import type { ChatErrorCode, InterviewType } from "../interview-chat/types";

// Rubric keys, same names as the columns of the feedbacks table (content_score, structure_score, …).
export type Criterion = "content" | "structure" | "clarity" | "confidence";

export const CRITERIA: Criterion[] = ["content", "structure", "clarity", "confidence"];

// Each score is 0–10 (smallint in the database). structure is null when STAR does not apply
// (the question is not behavioural, UC-08 alternative flow 1).
export type CriterionScores = {
  content: number;
  structure: number | null;
  clarity: number;
  confidence: number;
};

// A sentence quoted from the user's own answer, and why it affected the score.
export type Evidence = {
  criterion: Criterion;
  quote: string;
  comment: string;
  // "positive" = helped the score, "negative" = lowered it.
  effect: "positive" | "negative";
};

// Suggested answer outline: STAR for behavioural questions, key points otherwise.
export type AnswerOutline =
  | { format: "star"; situation: string; task: string; action: string; result: string }
  | { format: "key_points"; points: string[] };

export type AnswerFeedback = {
  feedbackId: string;
  answerId: string;
  questionType: InterviewType;
  scores: CriterionScores;
  overall: number; // 0–10, one decimal
  evidence: Evidence[];
  strengths: string[];
  improvements: string[];
  outline: AnswerOutline;
  createdAt: string; // ISO time the feedback was saved
};

// Codes the feedback call can fail with. Same codes as the interview API, plus
// FEEDBACK_UNAVAILABLE when /api/evaluate-answer does not exist on this server yet (404/405).
export type FeedbackErrorCode = ChatErrorCode | "FEEDBACK_UNAVAILABLE";

export class AnswerFeedbackError extends Error {
  constructor(
    public code: FeedbackErrorCode,
    message: string = code,
  ) {
    super(message);
  }
}
