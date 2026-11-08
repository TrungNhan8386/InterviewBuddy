// Short messages for the interview pages (SCRUM-81), by error code from the
// Session API (/api/interview/*) and the engine (/api/interview/next).
// Browser-safe: no server imports. Usage in the chat page:
//   const { error } = await res.json();
//   showError(interviewErrorMessage(error?.code, settings.language));

const MESSAGES = {
  vi: {
    BAD_INPUT: 'Dữ liệu gửi lên chưa hợp lệ. Vui lòng kiểm tra lại.',
    UNAUTHORIZED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    NOT_FOUND: 'Không tìm thấy buổi phỏng vấn này.',
    STALE_TURN: 'Câu hỏi đã thay đổi. Đang tải lại buổi phỏng vấn…',
    SESSION_CLOSED: 'Buổi phỏng vấn này đã kết thúc.',
    GENERATION_IN_PROGRESS: 'AI đang soạn câu hỏi, vui lòng chờ một chút.',
    LEASE_LOST: 'Câu hỏi đã được tạo ở nơi khác. Đang tải lại…',
    SESSION_CONTEXT_INVALID: 'Dữ liệu buổi phỏng vấn bị lỗi. Vui lòng tạo buổi mới.',
    AI_DAILY_LIMIT: 'Bạn đã dùng hết lượt AI hôm nay. Hạn mức được làm mới lúc 0:00 (giờ Việt Nam).',
    AI_RATE_LIMITED: 'AI đang quá tải. Vui lòng thử lại sau ít phút.',
    AI_CONTENT_BLOCKED: 'AI không xử lý được nội dung này. Hãy diễn đạt lại câu trả lời.',
    INVALID_OUTPUT: 'AI trả kết quả không hợp lệ. Vui lòng thử lại.',
    AI_UNAVAILABLE: 'Không kết nối được AI. Vui lòng thử lại.',
    AI_TIMEOUT: 'AI phản hồi quá lâu. Vui lòng thử lại.',
    AI_NOT_CONFIGURED: 'Máy chủ chưa cấu hình AI. Vui lòng báo nhóm phát triển.',
    AI_CONFIGURATION_ERROR: 'Máy chủ chưa cấu hình AI. Vui lòng báo nhóm phát triển.',
    DATABASE_NOT_READY: 'Cơ sở dữ liệu chưa sẵn sàng. Vui lòng báo nhóm phát triển.',
    REQUEST_CANCELLED: 'Yêu cầu đã bị hủy.',
    NETWORK_ERROR: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.',
    SERVER_ERROR: 'Có lỗi ở máy chủ. Vui lòng thử lại sau.',
  },
  en: {
    BAD_INPUT: 'Some data is missing or invalid. Please check and try again.',
    UNAUTHORIZED: 'Your session has expired. Please sign in again.',
    NOT_FOUND: 'This interview could not be found.',
    STALE_TURN: 'The question has changed. Reloading the interview…',
    SESSION_CLOSED: 'This interview has already ended.',
    GENERATION_IN_PROGRESS: 'The AI is writing the question. Please wait a moment.',
    LEASE_LOST: 'The question was created elsewhere. Reloading…',
    SESSION_CONTEXT_INVALID: 'This interview has invalid data. Please start a new one.',
    AI_DAILY_LIMIT: 'You have used all AI calls for today. The limit resets at 00:00 Vietnam time.',
    AI_RATE_LIMITED: 'The AI service is busy. Please try again in a few minutes.',
    AI_CONTENT_BLOCKED: 'The AI could not process this content. Please rephrase your answer.',
    INVALID_OUTPUT: 'The AI returned an invalid result. Please try again.',
    AI_UNAVAILABLE: 'Could not reach the AI service. Please try again.',
    AI_TIMEOUT: 'The AI took too long to respond. Please try again.',
    AI_NOT_CONFIGURED: 'The AI is not configured on the server. Please tell the team.',
    AI_CONFIGURATION_ERROR: 'The AI is not configured on the server. Please tell the team.',
    DATABASE_NOT_READY: 'The database is not ready. Please tell the team.',
    REQUEST_CANCELLED: 'The request was cancelled.',
    NETWORK_ERROR: 'Could not reach the server. Check your connection and try again.',
    SERVER_ERROR: 'A server error occurred. Please try again later.',
  },
};

export const INTERVIEW_ERROR_CODES = Object.keys(MESSAGES.en);

/** Codes after which the page should reload GET /api/interview/{id} instead of retrying. */
export const RELOAD_CODES = ['STALE_TURN', 'LEASE_LOST'];

/** Codes the user can fix by pressing "Try again" (same request). */
export const RETRY_CODES = [
  'GENERATION_IN_PROGRESS', 'AI_RATE_LIMITED', 'INVALID_OUTPUT', 'AI_UNAVAILABLE',
  'AI_TIMEOUT', 'NETWORK_ERROR', 'SERVER_ERROR',
];

export function interviewErrorMessage(code, language = 'vi') {
  const messages = MESSAGES[language === 'en' ? 'en' : 'vi'];
  return messages[code] ?? messages.SERVER_ERROR;
}
