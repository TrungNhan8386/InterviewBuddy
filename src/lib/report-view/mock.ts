import type { ReportResponse } from "./types";

// Sample report for the Report page skeleton (SCRUM-185). Same shape as
// docs/api/examples/report.response.json (Nhân, SCRUM-186), with realistic times.
// W8: replace with GET /api/report/{sessionId}.

export type ReportDemo = "default" | "typed" | "behavioral" | "summary-unavailable" | "en";
export const REPORT_DEMOS: ReportDemo[] = ["default", "typed", "behavioral", "summary-unavailable", "en"];

const base: ReportResponse = {
  sessionId: "00000000-0000-4000-8000-000000000001",
  generatedAt: "2026-11-19T03:19:30.000Z",
  settings: {
    type: "technical",
    difficulty: "medium",
    language: "vi",
    targetPosition: "Frontend Developer Intern",
    durationMinutes: 30,
  },
  overview: {
    overallScore: 6.6,
    scale: 10,
    mainQuestions: 4,
    followUps: 1,
    answeredQuestions: 4,
    scoredAnswers: 4,
    startedAt: "2026-11-19T03:00:00.000Z",
    endedAt: "2026-11-19T03:18:20.000Z",
    durationSeconds: 1100,
    trend: { previousSessionId: "00000000-0000-4000-8000-000000000000", previousOverallScore: 6.1, change: 0.5 },
  },
  criteria: { content: 7, structure: null, clarity: 7, confidence: 6 },
  structureApplies: false,
  speaking: {
    answeredQuestions: 4,
    totalWords: 412,
    avgAnswerWords: 103,
    fillerWords: {
      total: 9,
      per100Words: 2.2,
      top: [
        { word: "kiểu như", count: 4 },
        { word: "ừm", count: 3 },
        { word: "nói chung", count: 2 },
      ],
    },
    paceAvailable: true,
    timedAnswers: 2,
    wordsPerMinute: 118,
  },
  summary: {
    status: "ready",
    text: "Bạn có kiến thức nền tảng tốt về React và biết các kỹ thuật tối ưu cơ bản. Để cải thiện, hãy nêu số liệu cụ thể trước và sau khi tối ưu, và giảm các từ ngập ngừng khi nói.",
    strengths: [
      "Biết dùng React DevTools để tìm component bị render lại nhiều lần.",
      "Đề xuất được React.memo, useMemo và AbortController cho đúng tình huống.",
    ],
    improvements: [
      "Nêu con số đo được (thời gian tải, số lần render) trước và sau khi tối ưu.",
      "Giảm các từ ngập ngừng như “ừm”, “kiểu như” khi trả lời bằng giọng nói.",
    ],
  },
  timeline: [
    {
      position: 1, kind: "main", topic: "React rendering",
      question: "Bạn xử lý một component render chậm như thế nào?",
      askedAt: "2026-11-19T03:00:02.000Z", offsetSeconds: 0, answered: true, answerWords: 128, durationSeconds: 64.5,
      score: 7.5, scores: { content: 8, structure: null, clarity: 7, confidence: 7 },
    },
    {
      position: 2, kind: "follow_up", topic: "React rendering",
      question: "Bạn đo hiệu quả trước và sau khi tối ưu như thế nào?",
      askedAt: "2026-11-19T03:03:10.000Z", offsetSeconds: 188, answered: true, answerWords: 74, durationSeconds: 41,
      score: 5.5, scores: { content: 6, structure: null, clarity: 6, confidence: 5 },
    },
    {
      position: 3, kind: "main", topic: "REST API",
      question: "Bạn xử lý lỗi khi gọi API phía client như thế nào?",
      askedAt: "2026-11-19T03:07:35.000Z", offsetSeconds: 453, answered: true, answerWords: 116, durationSeconds: null,
      score: 6.8, scores: { content: 7, structure: null, clarity: 8, confidence: 6 },
    },
    {
      position: 4, kind: "main", topic: "Testing",
      question: "Bạn kiểm thử một component React như thế nào?",
      askedAt: "2026-11-19T03:12:40.000Z", offsetSeconds: 758, answered: true, answerWords: 94, durationSeconds: null,
      score: 6.6, scores: { content: 7, structure: null, clarity: 7, confidence: 6 },
    },
    {
      position: 5, kind: "main", topic: "Accessibility",
      question: "Bạn làm gì để một form dễ dùng với bàn phím và trình đọc màn hình?",
      askedAt: "2026-11-19T03:17:55.000Z", offsetSeconds: 1073, answered: false, answerWords: 0, durationSeconds: null,
      score: null, scores: null,
    },
  ],
};

/** Variants for checking each state of the page: /reports/demo?demo=typed … */
export function mockReport(demo: ReportDemo = "default"): ReportResponse {
  const report: ReportResponse = structuredClone(base);
  if (demo === "typed") {
    // UC-09 AF4: every answer was typed, so there is no speaking pace.
    report.speaking = { ...report.speaking, paceAvailable: false, timedAnswers: 0, wordsPerMinute: null };
    report.timeline = report.timeline.map((item) => ({ ...item, durationSeconds: null }));
    report.overview.trend = null; // first session: no trend (UC-09 AF3)
  }
  if (demo === "behavioral") {
    report.settings.type = "behavioral";
    report.structureApplies = true;
    report.criteria = { content: 7, structure: 5.5, clarity: 7, confidence: 6 };
  }
  if (demo === "summary-unavailable") {
    // UC-09 AF2: scores are shown, the AI summary failed and can be tried again.
    report.summary = { status: "unavailable", errorCode: "AI_RATE_LIMITED", text: null, strengths: [], improvements: [] };
  }
  if (demo === "en") {
    report.settings.language = "en";
    report.speaking.fillerWords.top = [
      { word: "um", count: 4 },
      { word: "like", count: 3 },
    ];
    report.summary = {
      status: "ready",
      text: "You know the basics of React well and can name the usual optimisations. To improve, give measured numbers before and after a change, and use fewer filler words.",
      strengths: ["Used React DevTools to find components that render too often.", "Chose React.memo and AbortController for the right cases."],
      improvements: ["Give numbers (load time, render count) before and after optimising.", "Use fewer fillers such as “um” and “like” in voice answers."],
    };
  }
  return report;
}
