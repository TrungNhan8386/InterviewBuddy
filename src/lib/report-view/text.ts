import type { ReportCriterion, ReportResponse, ReportSummaryErrorCode } from "./types";

// UI text of the Report page, in the language of the interview session (like the chat page).

type ReportText = {
  title: string;
  back: string;
  exportPdf: string;
  share: string;
  soon: string;
  types: Record<ReportResponse["settings"]["type"], string>;
  difficulties: Record<ReportResponse["settings"]["difficulty"], string>;
  overall: string;
  outOf: (scale: number) => string;
  trendUp: (change: string) => string;
  trendDown: (change: string) => string;
  trendSame: string;
  trendNone: string;
  interviewType: string;
  duration: string;
  durationOf: (minutes: number) => string;
  answered: string;
  answeredDetail: (main: number, followUps: number) => string;
  criteriaTitle: string;
  criteria: Record<ReportCriterion, string>;
  criteriaHint: Record<ReportCriterion, string>;
  structureHidden: string;
  confidenceNote: string;
  summaryTitle: string;
  strengths: string;
  improvements: string;
  summaryUnavailable: string;
  summaryErrors: Partial<Record<ReportSummaryErrorCode, string>>;
  retry: string;
  speakingTitle: string;
  fillers: string;
  fillersPer100: (value: number) => string;
  fillersNone: string;
  pace: string;
  paceUnit: string;
  paceFrom: (n: number) => string;
  paceNone: string;
  avgLength: string;
  wordsUnit: string;
  timelineTitle: string;
  kind: Record<"main" | "follow_up" | "practice", string>;
  notAnswered: string;
  words: (n: number) => string;
  spoke: (seconds: string) => string;
  noScore: string;
  aiNotice: string;
};

export const REPORT_TEXT: Record<"vi" | "en", ReportText> = {
  vi: {
    title: "Báo cáo kết quả phỏng vấn",
    back: "Về Dashboard",
    exportPdf: "Xuất PDF",
    share: "Chia sẻ báo cáo",
    soon: "Sắp có",
    types: { hr: "Phỏng vấn HR", technical: "Phỏng vấn kỹ thuật", behavioral: "Phỏng vấn hành vi" },
    difficulties: { easy: "Dễ", medium: "Trung bình", hard: "Khó" },
    overall: "Điểm tổng",
    outOf: (scale) => `/ ${scale}`,
    trendUp: (c) => `Tăng ${c} điểm so với buổi trước`,
    trendDown: (c) => `Giảm ${c} điểm so với buổi trước`,
    trendSame: "Bằng buổi trước",
    trendNone: "Buổi đầu tiên, chưa có buổi để so sánh",
    interviewType: "Loại phỏng vấn",
    duration: "Thời lượng",
    durationOf: (m) => `trên ${m} phút`,
    answered: "Câu đã trả lời",
    answeredDetail: (main, f) => `trên ${main + f} câu đã hỏi (${main} câu chính, ${f} câu đào sâu)`,
    criteriaTitle: "Điểm theo tiêu chí",
    criteria: { content: "Nội dung", structure: "Cấu trúc STAR", clarity: "Rõ ràng", confidence: "Tự tin" },
    criteriaHint: {
      content: "Đúng và đủ ý",
      structure: "Tình huống, nhiệm vụ, hành động, kết quả",
      clarity: "Dễ hiểu, mạch lạc",
      confidence: "Ước lượng từ câu chữ",
    },
    structureHidden: "Cấu trúc STAR chỉ chấm cho phỏng vấn hành vi, nên không có ở buổi này.",
    confidenceNote: "Điểm Tự tin được ước lượng từ câu chữ của bạn, không đo từ giọng nói.",
    summaryTitle: "Nhận xét chung",
    strengths: "Điểm mạnh",
    improvements: "Cần cải thiện",
    summaryUnavailable: "Chưa tạo được nhận xét chung. Điểm số bên dưới vẫn chính xác.",
    summaryErrors: {
      AI_DAILY_LIMIT: "Bạn đã dùng hết lượt AI hôm nay. Hãy thử lại sau 0:00 giờ Việt Nam.",
      AI_RATE_LIMITED: "AI đang bận. Hãy chờ một lát rồi thử lại.",
      AI_TIMEOUT: "AI phản hồi quá lâu. Hãy thử lại.",
      AI_UNAVAILABLE: "Không kết nối được AI. Hãy thử lại.",
    },
    retry: "Thử lại",
    speakingTitle: "Chỉ số khi nói",
    fillers: "Từ ngập ngừng",
    fillersPer100: (v) => `${v} từ trên 100 từ`,
    fillersNone: "Không có từ ngập ngừng",
    pace: "Tốc độ nói",
    paceUnit: "từ/phút",
    paceFrom: (n) => `Tính từ ${n} câu trả lời bằng giọng nói`,
    paceNone: "Không có: các câu đều được gõ. Trả lời bằng giọng nói để đo tốc độ nói.",
    avgLength: "Độ dài trung bình",
    wordsUnit: "từ/câu",
    timelineTitle: "Diễn biến buổi phỏng vấn",
    kind: { main: "Câu chính", follow_up: "Câu đào sâu", practice: "Luyện tập" },
    notAnswered: "Chưa trả lời",
    words: (n) => `${n} từ`,
    spoke: (s) => `nói ${s}`,
    noScore: "Chưa chấm",
    aiNotice: "Điểm và nhận xét do AI tạo, chỉ để luyện tập và có thể sai.",
  },
  en: {
    title: "Interview results report",
    back: "Back to Dashboard",
    exportPdf: "Export PDF",
    share: "Share report",
    soon: "Coming soon",
    types: { hr: "HR interview", technical: "Technical interview", behavioral: "Behavioral interview" },
    difficulties: { easy: "Easy", medium: "Medium", hard: "Hard" },
    overall: "Overall score",
    outOf: (scale) => `/ ${scale}`,
    trendUp: (c) => `Up ${c} from the previous session`,
    trendDown: (c) => `Down ${c} from the previous session`,
    trendSame: "Same as the previous session",
    trendNone: "First session, nothing to compare yet",
    interviewType: "Interview type",
    duration: "Duration",
    durationOf: (m) => `of ${m} min`,
    answered: "Questions answered",
    answeredDetail: (main, f) => `of ${main + f} questions asked (${main} main, ${f} follow-up)`,
    criteriaTitle: "Score by criterion",
    criteria: { content: "Content", structure: "STAR structure", clarity: "Clarity", confidence: "Confidence" },
    criteriaHint: {
      content: "Correct and complete",
      structure: "Situation, task, action, result",
      clarity: "Easy to follow",
      confidence: "Estimated from your words",
    },
    structureHidden: "STAR structure is scored only in behavioral interviews, so it is not shown for this session.",
    confidenceNote: "Confidence is estimated from your words, not measured from your voice.",
    summaryTitle: "Summary",
    strengths: "Strengths",
    improvements: "Areas to improve",
    summaryUnavailable: "The summary could not be created yet. The scores below are still correct.",
    summaryErrors: {
      AI_DAILY_LIMIT: "You have used today's AI allowance. Try again after 00:00 Vietnam time.",
      AI_RATE_LIMITED: "The AI is busy. Wait a moment and try again.",
      AI_TIMEOUT: "The AI took too long. Please try again.",
      AI_UNAVAILABLE: "Could not reach the AI. Please try again.",
    },
    retry: "Try again",
    speakingTitle: "Speaking indicators",
    fillers: "Filler words",
    fillersPer100: (v) => `${v} per 100 words`,
    fillersNone: "No filler words",
    pace: "Speaking pace",
    paceUnit: "words/min",
    paceFrom: (n) => `From ${n} voice answer(s)`,
    paceNone: "Not available: every answer was typed. Answer by voice to measure your pace.",
    avgLength: "Average length",
    wordsUnit: "words/answer",
    timelineTitle: "Session timeline",
    kind: { main: "Main question", follow_up: "Follow-up", practice: "Practice" },
    notAnswered: "Not answered",
    words: (n) => `${n} words`,
    spoke: (s) => `spoke ${s}`,
    noScore: "Not scored",
    aiNotice: "Scores and feedback are generated by AI for practice only and may be wrong.",
  },
};
