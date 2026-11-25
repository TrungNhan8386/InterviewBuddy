import type { ChatErrorCode, InterviewDifficulty, InterviewLanguage, InterviewType, VoiceError } from "./types";
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
  answerPlaceholderVoice: string;
  answerHint: string;
  // SCRUM-180/182/183 (UC-07): voice answers.
  voiceStart: string;
  voiceStop: string;
  voiceListening: string;
  voiceStopFirst: string;
  voiceUnsupported: string;
  voiceDismiss: string;
  voiceErrors: Record<VoiceError, string>;
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
  toDashboard: string;
  newInterview: string;
  // SCRUM-128: end-of-interview screen (placeholder for the report until Week 8).
  endedReason: Record<"completed" | "time_up" | "user" | "reopened", string>; // EndReason in types.ts
  statMain: string;
  statFollowUps: string;
  statTime: string;
  statTimeOf: (minutes: number) => string;
  reportTitle: string;
  reportSoon: string;
  reportButton: string;
  noAnswers: string;
  reviewTranscript: string;
  // SCRUM-129: empty answer and load-error states.
  emptyAnswer: string;
  loadErrorTitle: string;
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
    answerPlaceholderVoice: "Gõ câu trả lời, hoặc bấm “Trả lời bằng giọng nói” để nói…",
    answerHint: "Ctrl + Enter để gửi. Câu trả lời được lưu ngay sau khi gửi.",
    voiceStart: "Trả lời bằng giọng nói",
    voiceStop: "Dừng ghi",
    voiceListening: "Đang nghe… Nói câu trả lời của bạn, rồi bấm “Dừng ghi”. Hệ thống tự dừng sau vài giây im lặng.",
    voiceStopFirst: "Bấm “Dừng ghi” trước, kiểm tra và sửa bản chép lời rồi mới gửi.",
    voiceUnsupported:
      "Trình duyệt này không hỗ trợ nhận giọng nói, nên chỉ trả lời bằng cách gõ được. Dùng Chrome hoặc Edge để trả lời bằng giọng nói.",
    voiceDismiss: "Đóng",
    voiceErrors: {
      denied:
        "Trình duyệt chưa được phép dùng micro. Bấm biểu tượng ổ khóa hoặc micro trên thanh địa chỉ, chọn Cho phép (Allow) cho micro, rồi bấm lại nút giọng nói. Bạn vẫn có thể gõ câu trả lời.",
      "no-mic": "Không tìm thấy micro. Hãy cắm hoặc bật micro rồi thử lại, hoặc gõ câu trả lời.",
      "no-speech": "Không nghe thấy tiếng nói. Hãy nói gần micro hơn rồi thử lại, hoặc gõ câu trả lời.",
      network:
        "Mất kết nối tới dịch vụ nhận giọng nói. Phần đã nhận được vẫn ở trong ô, bạn có thể sửa rồi gửi, hoặc thử nói lại.",
      unavailable: "Không bật được nhận giọng nói trên trình duyệt này. Hãy gõ câu trả lời.",
    },
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
    toDashboard: "Về Dashboard",
    newInterview: "Phỏng vấn mới",
    endedReason: {
      completed: "Bạn đã trả lời hết các câu hỏi chính của buổi này.",
      time_up: "Đã hết thời gian của buổi phỏng vấn. Các câu đã gửi vẫn được lưu.",
      user: "Bạn đã kết thúc buổi phỏng vấn sớm.",
      reopened: "Buổi phỏng vấn này đã kết thúc trước đó.",
    },
    statMain: "Câu hỏi chính",
    statFollowUps: "Câu hỏi đào sâu",
    statTime: "Thời gian",
    statTimeOf: (m) => `trên ${m} phút`,
    reportTitle: "Báo cáo chi tiết",
    reportSoon:
      "Xem điểm từng tiêu chí, điểm mạnh, điểm cần cải thiện và dòng thời gian của buổi này.",
    reportButton: "Xem báo cáo",
    noAnswers: "Bạn chưa trả lời câu nào nên buổi này không có báo cáo.",
    reviewTranscript: "Xem lại hội thoại",
    emptyAnswer: "Hãy viết câu trả lời trước khi gửi.",
    loadErrorTitle: "Không mở được buổi phỏng vấn",
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
      ANSWER_CONFLICT: "Câu trả lời trước của bạn đã được lưu, nên nội dung vừa sửa không được gửi. Đã tải lại buổi phỏng vấn theo câu trả lời đã lưu.",
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
    answerPlaceholderVoice: "Type your answer, or click “Answer by voice” to speak…",
    answerHint: "Ctrl + Enter to send. Your answer is saved as soon as you send it.",
    voiceStart: "Answer by voice",
    voiceStop: "Stop",
    voiceListening: "Listening… Speak your answer, then click “Stop”. It also stops after a few seconds of silence.",
    voiceStopFirst: "Click “Stop” first, then check and edit the transcript before sending.",
    voiceUnsupported:
      "This browser does not support speech recognition, so you can only type your answer. Use Chrome or Edge to answer by voice.",
    voiceDismiss: "Close",
    voiceErrors: {
      denied:
        "The browser is not allowed to use the microphone. Click the lock or microphone icon in the address bar, choose Allow for the microphone, then click the voice button again. You can still type your answer.",
      "no-mic": "No microphone was found. Connect or turn on a microphone and try again, or type your answer.",
      "no-speech": "No speech was detected. Speak closer to the microphone and try again, or type your answer.",
      network:
        "The speech recognition service could not be reached. The text recognised so far is in the box; you can edit and send it, or try speaking again.",
      unavailable: "Speech recognition could not start in this browser. Please type your answer.",
    },
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
    toDashboard: "Back to Dashboard",
    newInterview: "New interview",
    endedReason: {
      completed: "You answered all the main questions of this session.",
      time_up: "The time for this interview is up. The answers you sent are saved.",
      user: "You ended the interview early.",
      reopened: "This interview has already ended.",
    },
    statMain: "Main questions",
    statFollowUps: "Follow-up questions",
    statTime: "Time",
    statTimeOf: (m) => `of ${m} min`,
    reportTitle: "Detailed report",
    reportSoon:
      "See the score by criterion, strengths, areas to improve and the timeline of this session.",
    reportButton: "View report",
    noAnswers: "You did not answer any question, so this session has no report.",
    reviewTranscript: "Review the conversation",
    emptyAnswer: "Please write an answer before sending.",
    loadErrorTitle: "Could not open the interview",
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
      ANSWER_CONFLICT: "Your earlier answer was already saved, so the edited text was not sent. The interview was reloaded with the saved answer.",
      RESPONSE_TIMEOUT: "The server took too long. Retry the same turn to recover any saved question.",
      REQUEST_CANCELLED: "Question generation was cancelled. You can retry the same turn.",
      SAVE_FAILED: "Your answer was not saved. It is still in the box; please try again.",
      NETWORK_ERROR: "Could not reach the server. Check your connection and try again.",
      SERVER_ERROR: "The server had an error. Please try again.",
    },
  },
};
