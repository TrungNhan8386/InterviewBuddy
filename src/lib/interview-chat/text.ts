import type { ChatErrorCode, InterviewDifficulty, InterviewLanguage, InterviewType } from "./types";
import { providerLimitMessage } from "../ai/provider-limit.mjs";

// UI text of the chat page, in the language of the interview session.
type ChatText = {
  types: Record<InterviewType, string>;
  difficulties: Record<InterviewDifficulty, string>;
  questionOf: (current: number, total: number) => string;
  timeLeft: string;
  timeUp: string;
  interviewer: string;
  you: string;
  followUp: string;
  topic: string;
  thinking: string;
  slow: string;
  extendedWait: string;
  cancelGeneration: string;
  provisional: string;
  saving: string;
  answerLabel: string;
  answerPlaceholder: string;
  answerHint: string;
  answerTooLong: (max: number) => string;
  send: string;
  end: string;
  retry: string;
  reload: string;
  endConfirmTitle: string;
  endConfirmBody: (answered: number) => string;
  endConfirmYes: string;
  endConfirmNo: string;
  endedTitle: string;
  endedBody: string;
  toDashboard: string;
  newInterview: string;
  loading: string;
  emptyTranscript: string;
  panelRole: string;
  panelRound: string;
  panelSkills: string;
  panelMatched: string;
  panelMissing: string;
  panelNoAnalysis: string;
  panelAnalyze: string;
  panelTips: string;
  tips: Record<InterviewType, string[]>;
  aiNotice: string;
  mockNotice: string;
  errors: Record<ChatErrorCode, string>;
};

export const CHAT_TEXT: Record<InterviewLanguage, ChatText> = {
  vi: {
    types: { hr: "Phỏng vấn HR", technical: "Phỏng vấn kỹ thuật", behavioral: "Phỏng vấn hành vi" },
    difficulties: { easy: "Dễ", medium: "Trung bình", hard: "Khó" },
    questionOf: (c, t) => `Câu ${c} / ${t}`,
    timeLeft: "Thời gian còn lại",
    timeUp: "Hết giờ",
    interviewer: "Người phỏng vấn AI",
    you: "Bạn",
    followUp: "Câu hỏi đào sâu",
    topic: "Chủ đề",
    thinking: "AI đang soạn câu hỏi…",
    slow: "Phản hồi đang chậm. Bạn có thể tiếp tục chờ hoặc hủy.",
    extendedWait: "Đã chờ hơn 10 giây. Bạn có thể hủy rồi thử lại cùng lượt.",
    cancelGeneration: "Hủy tạo câu hỏi",
    provisional: "Câu hỏi đang tạo, chưa được xác nhận lưu",
    saving: "Đang lưu câu trả lời…",
    answerLabel: "Câu trả lời của bạn",
    answerPlaceholder: "Gõ câu trả lời ở đây…",
    answerHint: "Ctrl + Enter để gửi. Câu trả lời được lưu ngay sau khi gửi.",
    answerTooLong: (max) => `Câu trả lời dài quá ${max} ký tự, hãy rút gọn.`,
    send: "Gửi",
    end: "Kết thúc phỏng vấn",
    retry: "Thử lại",
    reload: "Tải lại trang",
    endConfirmTitle: "Kết thúc buổi phỏng vấn?",
    endConfirmBody: (n) =>
      `Bạn đã trả lời ${n} câu. Sau khi kết thúc, bạn không thể trả lời thêm trong buổi này.`,
    endConfirmYes: "Kết thúc",
    endConfirmNo: "Tiếp tục phỏng vấn",
    endedTitle: "Buổi phỏng vấn đã kết thúc",
    endedBody: "Các câu trả lời đã được lưu. Trang nhận xét chi tiết sẽ có ở bản sau.",
    toDashboard: "Về Dashboard",
    newInterview: "Phỏng vấn mới",
    loading: "Đang tải buổi phỏng vấn…",
    emptyTranscript: "Chưa có câu hỏi nào.",
    panelRole: "Vị trí",
    panelRound: "Vòng phỏng vấn",
    panelSkills: "Kỹ năng từ bản phân tích CV/JD",
    panelMatched: "Đã có",
    panelMissing: "Còn thiếu",
    panelNoAnalysis: "Buổi này chưa gắn bản phân tích CV/JD.",
    panelAnalyze: "Phân tích CV/JD",
    panelTips: "Mẹo trả lời",
    tips: {
      hr: [
        "Trả lời ngắn gọn, thật lòng, gắn với vị trí đang ứng tuyển.",
        "Nêu lý do cụ thể bạn muốn làm ở công ty này.",
        "Khi nói điểm yếu, kể luôn bạn đang cải thiện thế nào.",
      ],
      technical: [
        "Nói hướng tiếp cận trước, rồi mới đi vào chi tiết.",
        "Nêu ưu nhược điểm (trade-off) của cách bạn chọn.",
        "Chưa chắc thì nói giả định của mình, đừng im lặng.",
      ],
      behavioral: [
        "Dùng STAR: Tình huống, Nhiệm vụ, Hành động, Kết quả.",
        "Tập trung vào việc bạn đã làm, không phải cả nhóm.",
        "Kết thúc bằng kết quả đo được hoặc bài học rút ra.",
      ],
    },
    aiNotice:
      "Câu hỏi và nhận xét do AI tạo, chỉ để luyện tập và có thể sai. Đừng nhập thông tin nhạy cảm.",
    mockNotice: "Đang dùng dữ liệu mẫu (NEXT_PUBLIC_INTERVIEW_MOCK=1). Không có gì được lưu.",
    errors: {
      BAD_INPUT: "Yêu cầu không hợp lệ. Hãy tải lại trang.",
      UNAUTHORIZED: "Phiên đăng nhập đã hết. Hãy đăng nhập lại.",
      NOT_FOUND: "Không tìm thấy buổi phỏng vấn này, hoặc nó không thuộc tài khoản của bạn.",
      STALE_TURN: "Buổi phỏng vấn vừa thay đổi ở tab khác. Đang tải lại…",
      GENERATION_IN_PROGRESS: "AI vẫn đang soạn câu hỏi. Hãy thử lại sau vài giây.",
      LEASE_LOST: "Phiên tạo câu hỏi đã hết hạn. Hãy tải lại trang.",
      SESSION_CONTEXT_INVALID: "Dữ liệu buổi phỏng vấn không hợp lệ. Hãy tạo buổi mới.",
      AI_CONTENT_BLOCKED: "AI từ chối nội dung này. Hãy sửa câu trả lời rồi gửi lại.",
      AI_RATE_LIMITED: providerLimitMessage("vi", "interview"),
      INVALID_OUTPUT: "AI trả về kết quả lỗi. Hãy thử lại.",
      AI_UNAVAILABLE: "Không kết nối được AI. Hãy thử lại.",
      DATABASE_NOT_READY: "Máy chủ chưa sẵn sàng (thiếu cấu hình hoặc migration).",
      AI_NOT_CONFIGURED: "Máy chủ chưa cấu hình AI.",
      AI_TIMEOUT: "AI phản hồi quá lâu. Hãy thử lại.",
      AI_DAILY_LIMIT: "Bạn đã dùng hết lượt AI hôm nay. Hạn mức làm mới lúc 0:00 giờ Việt Nam.",
      SESSION_CLOSED: "Buổi phỏng vấn đã đóng. Hãy tải lại trang.",
      RESPONSE_TIMEOUT: "Máy chủ phản hồi quá lâu. Thử lại cùng lượt để lấy kết quả đã lưu nếu có.",
      REQUEST_CANCELLED: "Đã hủy tạo câu hỏi. Bạn có thể thử lại cùng lượt.",
      SAVE_FAILED: "Chưa lưu được câu trả lời. Nội dung vẫn còn trong ô, hãy thử lại.",
      NETWORK_ERROR: "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.",
      SERVER_ERROR: "Máy chủ gặp lỗi. Hãy thử lại.",
    },
  },
  en: {
    types: { hr: "HR interview", technical: "Technical interview", behavioral: "Behavioral interview" },
    difficulties: { easy: "Easy", medium: "Medium", hard: "Hard" },
    questionOf: (c, t) => `Question ${c} of ${t}`,
    timeLeft: "Time left",
    timeUp: "Time is up",
    interviewer: "AI interviewer",
    you: "You",
    followUp: "Follow-up",
    topic: "Topic",
    thinking: "The AI is writing the question…",
    slow: "The response is taking longer. You can keep waiting or cancel.",
    extendedWait: "You have waited over 10 seconds. You can cancel and retry the same turn.",
    cancelGeneration: "Cancel question generation",
    provisional: "Draft question, not yet confirmed saved",
    saving: "Saving your answer…",
    answerLabel: "Your answer",
    answerPlaceholder: "Type your answer here…",
    answerHint: "Ctrl + Enter to send. Your answer is saved as soon as you send it.",
    answerTooLong: (max) => `Your answer is longer than ${max} characters. Please shorten it.`,
    send: "Send",
    end: "End interview",
    retry: "Try again",
    reload: "Reload page",
    endConfirmTitle: "End this interview?",
    endConfirmBody: (n) =>
      `You have answered ${n} question(s). After ending, you cannot answer more in this session.`,
    endConfirmYes: "End",
    endConfirmNo: "Keep going",
    endedTitle: "The interview has ended",
    endedBody: "Your answers are saved. The detailed feedback page comes in a later version.",
    toDashboard: "Back to Dashboard",
    newInterview: "New interview",
    loading: "Loading the interview…",
    emptyTranscript: "No questions yet.",
    panelRole: "Position",
    panelRound: "Round",
    panelSkills: "Skills from your CV/JD analysis",
    panelMatched: "Matched",
    panelMissing: "Missing",
    panelNoAnalysis: "No CV/JD analysis is linked to this session.",
    panelAnalyze: "Analyze CV/JD",
    panelTips: "Tips",
    tips: {
      hr: [
        "Keep answers short, honest and tied to the role.",
        "Give a concrete reason for wanting this company.",
        "When you name a weakness, say how you are improving it.",
      ],
      technical: [
        "State your approach first, then the details.",
        "Mention the trade-offs of your choice.",
        "If unsure, say your assumptions instead of staying silent.",
      ],
      behavioral: [
        "Use STAR: Situation, Task, Action, Result.",
        "Focus on what you did, not the whole team.",
        "End with a measurable result or a lesson learned.",
      ],
    },
    aiNotice:
      "Questions and feedback are generated by AI for practice only and may be wrong. Do not enter sensitive information.",
    mockNotice: "Using sample data (NEXT_PUBLIC_INTERVIEW_MOCK=1). Nothing is saved.",
    errors: {
      BAD_INPUT: "Invalid request. Please reload the page.",
      UNAUTHORIZED: "Your sign-in has expired. Please sign in again.",
      NOT_FOUND: "This interview was not found or does not belong to your account.",
      STALE_TURN: "The interview changed in another tab. Reloading…",
      GENERATION_IN_PROGRESS: "The AI is still writing the question. Try again in a few seconds.",
      LEASE_LOST: "The question request expired. Please reload the page.",
      SESSION_CONTEXT_INVALID: "This interview's data is invalid. Please start a new one.",
      AI_CONTENT_BLOCKED: "The AI rejected this content. Edit your answer and send it again.",
      AI_RATE_LIMITED: providerLimitMessage("en", "interview"),
      INVALID_OUTPUT: "The AI returned an invalid result. Please try again.",
      AI_UNAVAILABLE: "Could not reach the AI. Please try again.",
      DATABASE_NOT_READY: "The server is not ready (missing configuration or migration).",
      AI_NOT_CONFIGURED: "The server has no AI configuration.",
      AI_TIMEOUT: "The AI took too long. Please try again.",
      AI_DAILY_LIMIT: "You have used today's AI allowance. It resets at 00:00 Vietnam time.",
      SESSION_CLOSED: "This interview is closed. Please reload the page.",
      RESPONSE_TIMEOUT: "The server took too long. Retry the same turn to recover any saved question.",
      REQUEST_CANCELLED: "Question generation was cancelled. You can retry the same turn.",
      SAVE_FAILED: "Your answer was not saved. It is still in the box; please try again.",
      NETWORK_ERROR: "Could not reach the server. Check your connection and try again.",
      SERVER_ERROR: "The server had an error. Please try again.",
    },
  },
};
