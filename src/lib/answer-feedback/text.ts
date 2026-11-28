import type { InterviewLanguage } from "../interview-chat/types";
import { CHAT_TEXT } from "../interview-chat/text";
import type { Criterion, FeedbackErrorCode } from "./types";

// UI text of the Answer Feedback screen (Screen 5), in the language of the interview session.
// Kept apart from interview-chat/text.ts so voice (Tài, SCRUM-179) and feedback can change in parallel.
type FeedbackText = {
  title: string;
  evaluating: string;
  evaluatingHint: string;
  stopScoring: string;
  questionLabel: string;
  answerLabel: string;
  answeredAt: (time: string) => string;
  overall: string;
  outOf10: string;
  criteria: Record<Criterion, string>;
  criteriaHint: Record<Criterion, string>;
  structureHidden: string;
  confidenceEstimate: string;
  strengths: string;
  improvements: string;
  noItems: string;
  whyTitle: string;
  whyHint: string;
  noEvidence: string;
  effect: Record<"positive" | "negative" | "neutral", string>;
  outlineTitle: string;
  outlineKeyPoints: string;
  star: Record<"situation" | "task" | "action" | "result", string>;
  notice: string;
  backToQuestion: string;
  practiceSimilar: string;
  practiceSoon: string;
  continueInterview: string;
  continueWithout: string;
  showFeedback: string;
  reviewingHint: string;
  errorTitle: string;
  errors: Record<FeedbackErrorCode, string>;
  retry: string;
};

const vi: FeedbackText = {
  title: "Nhận xét câu trả lời",
  evaluating: "AI đang chấm điểm câu trả lời của bạn…",
  evaluatingHint: "Thường mất vài giây. Câu trả lời đã được lưu.",
  stopScoring: "Dừng chấm điểm",
  questionLabel: "Câu hỏi",
  answerLabel: "Câu trả lời của bạn",
  answeredAt: (time) => `Chấm lúc ${time}`,
  overall: "Điểm tổng",
  outOf10: "/10",
  criteria: { content: "Nội dung", structure: "Cấu trúc STAR", clarity: "Rõ ràng", confidence: "Tự tin" },
  criteriaHint: {
    content: "Đúng trọng tâm, có ví dụ và chi tiết",
    structure: "Tình huống, nhiệm vụ, hành động, kết quả",
    clarity: "Mạch lạc, dễ theo dõi",
    confidence: "Ước tính từ cách viết, không phải giọng nói",
  },
  structureHidden: "Không chấm STAR vì đây không phải câu hỏi hành vi. Điểm tổng tính từ 3 tiêu chí còn lại.",
  confidenceEstimate: "ước tính",
  strengths: "Điểm mạnh",
  improvements: "Cần cải thiện",
  noItems: "AI chưa nêu mục nào.",
  whyTitle: "Vì sao có điểm này",
  whyHint: "Các câu được tô màu là lời của chính bạn mà AI dùng làm bằng chứng.",
  noEvidence: "AI không trích được câu cụ thể nào từ câu trả lời.",
  effect: { positive: "Điểm cộng", negative: "Điểm trừ", neutral: "Bằng chứng" },
  outlineTitle: "Gợi ý dàn ý câu trả lời",
  outlineKeyPoints: "Các ý chính nên có",
  // UC08-03 (BUG-06): Vietnamese only in a Vietnamese interview.
  star: { situation: "Tình huống", task: "Nhiệm vụ", action: "Hành động", result: "Kết quả" },
  notice:
    "Nhận xét do AI tạo ra để bạn luyện tập và có thể chưa chính xác. Điểm Tự tin chỉ là ước tính dựa trên văn bản.",
  backToQuestion: "Quay lại câu hỏi",
  practiceSimilar: "Luyện câu tương tự",
  practiceSoon: "Luyện câu tương tự sẽ có ở Build 2 (UC-10).",
  continueInterview: "Tiếp tục phỏng vấn",
  continueWithout: "Tiếp tục không cần nhận xét",
  showFeedback: "Xem lại nhận xét",
  reviewingHint: "Bạn đang xem lại câu hỏi và câu trả lời ở trên.",
  errorTitle: "Chưa tạo được nhận xét cho câu trả lời này. Câu trả lời của bạn vẫn được lưu.",
  errors: {
    ...CHAT_TEXT.vi.errors,
    NOT_FOUND: "Không tìm thấy câu trả lời này, hoặc nó không thuộc tài khoản của bạn.",
    INVALID_OUTPUT: "AI trả về nhận xét sai định dạng nên không dùng được. Hãy thử lại.",
    REQUEST_CANCELLED: "Đã dừng chấm điểm. Bạn có thể thử lại.",
    FEEDBACK_UNAVAILABLE: "Máy chủ chưa có chức năng chấm điểm (/api/evaluate-answer). Bạn có thể tiếp tục phỏng vấn.",
  },
  retry: "Thử lại",
};

const en: FeedbackText = {
  title: "Answer feedback",
  evaluating: "The AI is scoring your answer…",
  evaluatingHint: "This usually takes a few seconds. Your answer is saved.",
  stopScoring: "Stop scoring",
  questionLabel: "Question",
  answerLabel: "Your answer",
  answeredAt: (time) => `Scored at ${time}`,
  overall: "Overall score",
  outOf10: "/10",
  criteria: { content: "Content", structure: "STAR structure", clarity: "Clarity", confidence: "Confidence" },
  criteriaHint: {
    content: "On topic, with examples and detail",
    structure: "Situation, task, action, result",
    clarity: "Well organised and easy to follow",
    confidence: "Estimated from the text, not from your voice",
  },
  structureHidden: "STAR is not scored because this is not a behavioural question. The overall score uses the other 3 criteria.",
  confidenceEstimate: "estimate",
  strengths: "Strengths",
  improvements: "Areas to improve",
  noItems: "The AI did not list any.",
  whyTitle: "Why this score",
  whyHint: "Highlighted sentences are your own words that the AI used as evidence.",
  noEvidence: "The AI did not quote any specific sentence from your answer.",
  effect: { positive: "Helped", negative: "Lowered", neutral: "Evidence" },
  outlineTitle: "Suggested answer outline",
  outlineKeyPoints: "Key points to cover",
  star: { situation: "Situation", task: "Task", action: "Action", result: "Result" },
  notice:
    "This feedback is generated by AI for practice and may be wrong. Confidence is only an estimate based on your text.",
  backToQuestion: "Back to question",
  practiceSimilar: "Practice similar question",
  practiceSoon: "Practice similar question arrives in Build 2 (UC-10).",
  continueInterview: "Continue interview",
  continueWithout: "Continue without feedback",
  showFeedback: "Show feedback again",
  reviewingHint: "You are reviewing the question and your answer above.",
  errorTitle: "The feedback for this answer could not be created. Your answer is still saved.",
  errors: {
    ...CHAT_TEXT.en.errors,
    NOT_FOUND: "This answer was not found, or it does not belong to your account.",
    INVALID_OUTPUT: "The AI returned feedback in the wrong format, so it cannot be used. Please try again.",
    REQUEST_CANCELLED: "Scoring was stopped. You can try again.",
    FEEDBACK_UNAVAILABLE: "Scoring (/api/evaluate-answer) is not available on this server yet. You can continue the interview.",
  },
  retry: "Try again",
};

export const FEEDBACK_TEXT: Record<InterviewLanguage, FeedbackText> = { vi, en };
export type { FeedbackText };
