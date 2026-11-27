import type { ChatQuestion, ChatSession, InterviewLanguage, NextResult } from "./types";
import { InterviewChatError } from "./types";

// Sample interview used when NEXT_PUBLIC_INTERVIEW_MOCK=1 (no database, no Gemini).
// Open /interview/demo (Vietnamese) or /interview/demo-en (English).
// An id containing "behavioral" (for example /interview/demo-behavioral) makes a behavioural
// interview, so the Answer Feedback screen shows the STAR score (SCRUM-175).
// Rules copied from docs/api/INTERVIEW_FLOW_CONTEXT_v1.md, simplified:
// a short answer (< 15 words) gets one follow-up, otherwise the next topic;
// the interview ends after plannedQuestions main questions are answered.
// Type "#loi" or "#error" in an answer to simulate one AI failure.
// UC-10 (SCRUM-205): an id containing "practice" is a practice session from saved questions
// (/interview/mock-practice = one question, /interview/mock-practice-all = three in order):
// no timer, no follow-up, the end screen links back to the report.

const MAIN: Record<InterviewLanguage, { topic: string; content: string }[]> = {
  vi: [
    { topic: "Giới thiệu", content: "Bạn hãy giới thiệu ngắn về bản thân và lý do bạn ứng tuyển vị trí Frontend Intern." },
    { topic: "React state", content: "Khi nào bạn dùng useState, khi nào dùng useReducer? Cho một ví dụ trong dự án của bạn." },
    { topic: "Gọi API", content: "Nếu người dùng bấm tìm kiếm liên tục, làm sao để kết quả cũ không ghi đè kết quả mới?" },
    { topic: "Làm việc nhóm", content: "Kể về một lần bạn bất đồng với bạn cùng nhóm về cách làm. Bạn đã xử lý thế nào?" },
    { topic: "Tối ưu hiệu năng", content: "Trang web của bạn tải chậm trên điện thoại. Bạn sẽ kiểm tra những gì trước?" },
  ],
  en: [
    { topic: "Introduction", content: "Please introduce yourself briefly and tell me why you applied for the Frontend Intern role." },
    { topic: "React state", content: "When do you use useState and when useReducer? Give an example from your project." },
    { topic: "API requests", content: "If a user clicks search many times, how do you stop an old response from overwriting a newer one?" },
    { topic: "Teamwork", content: "Tell me about a time you disagreed with a teammate about how to do something. What did you do?" },
    { topic: "Performance", content: "Your page loads slowly on phones. What would you check first?" },
  ],
};

const PRACTICE: Record<InterviewLanguage, string[]> = {
  vi: [
    "Hãy giải thích ngắn gọn cho người không chuyên: vì sao trang web cần trạng thái loading?",
    "Kể lại một lỗi bạn từng sửa, nói ý chính trong câu đầu tiên.",
    "Bạn sẽ trả lời thế nào nếu được hỏi về một công nghệ bạn chưa dùng?",
  ],
  en: [
    "Explain to a non-technical person why a web page needs a loading state.",
    "Describe a bug you fixed, with the main point in your first sentence.",
    "How would you answer a question about a technology you have not used?",
  ],
};

const FOLLOW_UP: Record<InterviewLanguage, string> = {
  vi: "Bạn có thể nói cụ thể hơn không? Ví dụ bạn đã làm gì và kết quả ra sao?",
  en: "Could you be more specific? For example, what exactly did you do and what was the result?",
};

// replies: like the real API, asking for the same turn twice returns the same question
// (React Strict Mode in `npm run dev` starts the page twice).
type MockStore = { session: ChatSession; failNext: boolean; replies: Map<string, NextResult> };
const stores = new Map<string, MockStore>();

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let counter = 0;
const newId = () => `mock-${Date.now()}-${++counter}`;

function store(id: string): MockStore {
  let s = stores.get(id);
  if (!s) {
    const language: InterviewLanguage = id.endsWith("en") ? "en" : "vi";
    const practice = id.includes("practice")
      ? { mode: id.includes("all") ? ("all" as const) : ("single" as const), total: id.includes("all") ? 3 : 1, sourceSessionId: "demo" }
      : null;
    s = {
      failNext: false,
      replies: new Map(),
      session: {
        id,
        status: "in_progress",
        startedAt: new Date().toISOString(),
        settings: {
          type: id.includes("behavioral") ? "behavioral" : "technical",
          difficulty: "medium",
          language,
          targetPosition: "Frontend Intern",
          durationMinutes: 15,
          plannedQuestions: practice ? practice.total : MAIN[language].length,
          inputMode: "text",
        },
        skills: {
          matched: ["React", "TypeScript", "Git"],
          missing: ["Unit testing", "Next.js"],
        },
        turns: [],
        practice,
      },
    };
    stores.set(id, s);
  }
  return s;
}

export async function mockLoadSession(id: string): Promise<ChatSession> {
  await wait(400);
  const s = store(id).session;
  return { ...s, turns: s.turns.map((t) => ({ ...t })) };
}

export async function mockSaveAnswer(sessionId: string, questionId: string, content: string) {
  await wait(300);
  const s = store(sessionId);
  const turn = s.session.turns.find((t) => t.question.id === questionId);
  if (!turn) throw new InterviewChatError("SAVE_FAILED");
  if (!turn.answer) turn.answer = { id: newId(), content };
  if (/#(loi|error)/i.test(content)) s.failNext = true;
  return turn.answer.id;
}

export async function mockRequestNext(sessionId: string, afterAnswerId: string | null): Promise<NextResult> {
  const s = store(sessionId);
  const turnKey = afterAnswerId ?? "opening";
  await wait(1200); // pretend the AI is thinking
  const replay = s.replies.get(turnKey);
  if (replay) return replay;
  const { session } = s;
  if (s.failNext) {
    s.failNext = false;
    throw new InterviewChatError("AI_UNAVAILABLE");
  }
  const last = session.turns.at(-1);
  if ((last?.answer?.id ?? null) !== afterAnswerId) throw new InterviewChatError("STALE_TURN");

  const lang = session.settings.language;
  const mains = session.turns.filter((t) => t.question.kind === "main");
  const lastMain = mains.at(-1);
  const followUps = lastMain
    ? session.turns.filter((t) => t.question.kind === "follow_up" && t.question.topic === lastMain.question.topic)
    : [];
  const words = last?.answer?.content.trim().split(/\s+/).length ?? 0;

  let question: ChatQuestion | null = null;
  let action: NextResult["action"] = "next_topic";
  const practice = session.practice;
  if (practice) {
    // Saved questions in order, never a follow-up (UC10-02, UC10-03).
    if (mains.length < practice.total) {
      const topic = lang === "en" ? "Practice: clarity" : "Luyện tập: mạch lạc";
      question = { id: newId(), kind: "main", topic, content: PRACTICE[lang][mains.length], position: session.turns.length + 1 };
    } else {
      action = "end";
      session.status = "completed";
    }
  } else if (last && lastMain && words < 15 && followUps.length === 0) {
    action = "follow_up";
    question = { id: newId(), kind: "follow_up", topic: lastMain.question.topic, content: FOLLOW_UP[lang], position: session.turns.length + 1 };
  } else if (mains.length < session.settings.plannedQuestions) {
    const next = MAIN[lang][mains.length];
    question = { id: newId(), kind: "main", topic: next.topic, content: next.content, position: session.turns.length + 1 };
  } else {
    action = "end";
    session.status = "completed";
  }
  if (question) session.turns.push({ question, answer: null });
  const result = { action, question };
  s.replies.set(turnKey, result);
  return result;
}

export async function mockEndSession(sessionId: string) {
  await wait(300);
  store(sessionId).session.status = "completed";
}
