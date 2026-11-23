export type FeedbackQuestionType = 'behavioral' | 'technical' | 'hr';
export type CriterionScore = { score: number; reason: string; quotes: string[]; applicable: true };
export type InapplicableStar = { score: null; reason: null; quotes: []; applicable: false };
export interface AnswerFeedback {
  id: string;
  answerId: string;
  questionId: string;
  sessionId: string;
  createdAt: string;
  schemaVersion: 'uc08-feedback-v1';
  rubricVersion: string;
  language: 'vi' | 'en';
  questionType: FeedbackQuestionType;
  confidenceBasis: 'text_estimated';
  overallScore: number;
  scores: { content: CriterionScore; star: CriterionScore | InapplicableStar; clarity: CriterionScore; confidence: CriterionScore };
  strengths: string[];
  improvements: string[];
  outline: { kind: 'star' | 'key_points'; sections: { label: string; guidance: string }[] };
  labels: { content: string; star: string; clarity: string; confidence: string; notApplicable: string };
  disclaimer: string;
}
export type EvaluateAnswerRequest = { answerId: string };
export type EvaluateAnswerResponse = { feedback: AnswerFeedback; state: 'ready'; alreadySaved: boolean };
export type ReadFeedbackResponse = EvaluateAnswerResponse | { feedback: null; state: 'not_evaluated' | 'generating' | 'failed' };
export type FeedbackErrorResponse = { error: { code: string; message: string } };
