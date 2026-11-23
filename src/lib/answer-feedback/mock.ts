import type { InterviewLanguage, InterviewType } from "../interview-chat/types";
import { AnswerFeedbackError, type AnswerFeedback, type Evidence } from "./types";

// Sample feedback used when NEXT_PUBLIC_FEEDBACK_MODE=mock or NEXT_PUBLIC_INTERVIEW_MOCK=1.
// The scores follow simple rules so the screen can be tested without Gemini:
// longer answers with numbers score higher; quotes are real sentences from the answer.
// Type "#loi-fb" or "#error-fb" in an answer to simulate one failed evaluation.
// Open /interview/demo-behavioral to see the STAR version.

export type MockFeedbackInput = {
  answer: string;
  questionType: InterviewType;
  language: InterviewLanguage;
};

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new AnswerFeedbackError("REQUEST_CANCELLED"));
    });
  });

const failedOnce = new Set<string>();
// Like the real API, asking twice for the same answer returns the same saved feedback.
const saved = new Map<string, AnswerFeedback>();

const clamp = (n: number) => Math.max(0, Math.min(10, Math.round(n)));

const TEXT = {
  vi: {
    strengths: ["Trả lời đúng trọng tâm câu hỏi.", "Có nêu ví dụ từ trải nghiệm của bạn."],
    strengthNumbers: "Có số liệu cụ thể, giúp câu trả lời đáng tin hơn.",
    improvements: [
      "Nói rõ vai trò của chính bạn, dùng “tôi” thay vì “chúng tôi”.",
      "Kết thúc bằng kết quả đo được hoặc bài học rút ra.",
    ],
    improvementShort: "Câu trả lời còn ngắn. Hãy thêm bối cảnh và các bước bạn đã làm.",
    goodQuote: "Câu này cho thấy bạn hiểu vấn đề và có hành động cụ thể.",
    weakQuote: "Câu này còn chung chung, chưa có ví dụ hay kết quả.",
    star: {
      situation: "Nêu ngắn gọn bối cảnh: dự án gì, lúc nào, nhóm mấy người.",
      task: "Nhiệm vụ của riêng bạn là gì, mục tiêu cần đạt là gì.",
      action: "2–3 việc cụ thể bạn đã làm, theo thứ tự, và lý do chọn cách đó.",
      result: "Kết quả đo được (thời gian, số lỗi, điểm số…) và bài học rút ra.",
    },
    points: [
      "Trả lời thẳng vào câu hỏi trong 1–2 câu đầu.",
      "Giải thích cách làm hoặc khái niệm chính, kèm lý do.",
      "Đưa một ví dụ từ dự án của bạn.",
      "Nêu điểm cần lưu ý hoặc cách bạn kiểm tra kết quả.",
    ],
  },
  en: {
    strengths: ["Your answer addresses the question directly.", "You gave an example from your own experience."],
    strengthNumbers: "You used concrete numbers, which makes the answer more convincing.",
    improvements: [
      "Make your own role clear: say “I” rather than “we”.",
      "Finish with a measurable result or what you learned.",
    ],
    improvementShort: "The answer is short. Add the context and the steps you took.",
    goodQuote: "This sentence shows you understood the problem and took concrete action.",
    weakQuote: "This sentence is general, with no example or result.",
    star: {
      situation: "Briefly set the scene: which project, when, how big the team was.",
      task: "What was your own task and what goal did you need to reach.",
      action: "2–3 concrete things you did, in order, and why you chose them.",
      result: "A measurable result (time, bugs, scores…) and what you learned.",
    },
    points: [
      "Answer the question directly in the first one or two sentences.",
      "Explain the main approach or concept and why.",
      "Give one example from your own project.",
      "Mention a caveat or how you checked the result.",
    ],
  },
};

function sentences(answer: string): string[] {
  return answer
    .split(/(?<=[.!?…])\s+|\n+/u)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12);
}

export async function mockEvaluateAnswer(
  answerId: string,
  input: MockFeedbackInput | undefined,
  signal?: AbortSignal,
): Promise<AnswerFeedback> {
  await wait(1500, signal); // pretend the AI is scoring
  const existing = saved.get(answerId);
  if (existing) return existing;

  const answer = input?.answer ?? "";
  const questionType = input?.questionType ?? "technical";
  const t = TEXT[input?.language ?? "vi"];

  if (/#(loi|error)-fb/i.test(answer) && !failedOnce.has(answerId)) {
    failedOnce.add(answerId);
    throw new AnswerFeedbackError("AI_UNAVAILABLE");
  }

  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  const hasNumbers = /\d/.test(answer);
  const base = words < 15 ? 4 : words < 40 ? 6 : 7;
  const behavioral = questionType === "behavioral";
  const scores = {
    content: clamp(base + (hasNumbers ? 1 : 0)),
    structure: behavioral ? clamp(base - 1 + (words >= 60 ? 1 : 0)) : null,
    clarity: clamp(base + 1),
    confidence: clamp(base - (/(có lẽ|chắc là|maybe|i think|i guess)/i.test(answer) ? 2 : 0)),
  };
  const used = [scores.content, scores.structure, scores.clarity, scores.confidence].filter(
    (s): s is number => s !== null,
  );
  const overall = Math.round((used.reduce((a, b) => a + b, 0) / used.length) * 10) / 10;

  const list = sentences(answer);
  const evidence: Evidence[] = [];
  if (list[0]) evidence.push({ criterion: "content", quote: list[0], comment: t.goodQuote, effect: "positive" });
  if (list.length > 1) {
    evidence.push({ criterion: "clarity", quote: list[list.length - 1], comment: t.weakQuote, effect: "negative" });
  }

  const feedback: AnswerFeedback = {
    feedbackId: `mock-fb-${answerId}`,
    answerId,
    questionType,
    scores,
    overall,
    evidence,
    strengths: hasNumbers ? [...t.strengths, t.strengthNumbers] : t.strengths,
    improvements: words < 15 ? [t.improvementShort, ...t.improvements] : t.improvements,
    outline: behavioral ? { format: "star", ...t.star } : { format: "key_points", points: t.points },
    createdAt: new Date().toISOString(),
  };
  saved.set(answerId, feedback);
  return feedback;
}
