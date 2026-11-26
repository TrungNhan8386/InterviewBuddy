import type { PracticeLanguage, PracticeSet } from "./types";

// Sample practice set, used with NEXT_PUBLIC_PRACTICE_MODE=mock (no Gemini, no database).
// Try the states on the Report page with ?practice=strong | error | limit | few.
export type PracticeDemo = "default" | "strong" | "error" | "limit" | "few";
export const PRACTICE_DEMOS: PracticeDemo[] = ["default", "strong", "error", "limit", "few"];

const VI = {
  confidence: [
    ["Nếu trưởng nhóm không đồng ý với giải pháp kỹ thuật của bạn, bạn sẽ bảo vệ nó thế nào?", "Nêu rõ quyết định của bạn và lý do, tránh “chắc là”, “có lẽ”."],
    ["Thành tựu nào trong dự án gần nhất mà bạn tự hào nhất? Phần đóng góp của riêng bạn là gì?", "Dùng “tôi đã…” cho phần việc của bạn và nói kết quả cụ thể."],
    ["Khi gặp một yêu cầu bạn chưa từng làm, bạn bắt đầu từ đâu?", "Trình bày các bước một cách chắc chắn, có thứ tự."],
    ["Vì sao bạn tin mình phù hợp với vị trí này hơn các ứng viên khác?", "Chọn 2 điểm mạnh có bằng chứng, nói thẳng vào ý."],
  ],
  clarity: [
    ["Giải thích ngắn gọn cho người không chuyên: React re-render khi nào?", "Trả lời ý chính trong câu đầu, sau đó mới thêm ví dụ."],
    ["Trong 1 phút, hãy trình bày cách bạn chia nhỏ một tính năng lớn thành các task.", "Dùng 2–3 ý có thứ tự: trước hết, sau đó, cuối cùng."],
    ["Bạn sẽ mô tả dự án cá nhân tốt nhất của mình như thế nào cho nhà tuyển dụng?", "Nêu mục tiêu, vai trò của bạn và một kết quả, tránh lan man."],
  ],
};
const EN = {
  confidence: [
    ["If your team lead disagreed with your technical solution, how would you defend it?", "State your decision and the reason; avoid “maybe” and “I guess”."],
    ["What achievement in your latest project are you proudest of, and what was your own part?", "Say “I did…” for your part and give a concrete result."],
    ["When you get a requirement you have never built before, where do you start?", "Present your steps firmly and in order."],
    ["Why are you a better fit for this role than other candidates?", "Pick 2 strengths with evidence and get straight to the point."],
  ],
  clarity: [
    ["Explain to a non-technical person when a React component re-renders.", "Give the main point in the first sentence, then an example."],
    ["In one minute, explain how you break a large feature into smaller tasks.", "Use 2–3 ordered points: first, then, finally."],
    ["How would you describe your best personal project to a recruiter?", "State the goal, your role and one result without drifting."],
  ],
};

export function mockPractice(sessionId: string, language: PracticeLanguage, demo: PracticeDemo = "default"): PracticeSet {
  const bank = language === "en" ? EN : VI;
  let position = 0;
  const group = (criterion: "confidence" | "clarity", score: number) => ({
    criterion,
    score,
    questions: bank[criterion].map(([question, tip]) => ({
      id: `00000000-0000-4000-8000-${String(++position).padStart(12, "0")}`,
      position,
      question,
      tip,
      practiceSessionId: null,
    })),
  });
  const strong = demo === "strong";
  return {
    sessionId,
    language,
    generatedAt: "2026-11-24T08:00:00.000Z",
    noMajorWeakness: strong,
    alreadySaved: false,
    groups: [group("clarity", strong ? 7.8 : 5.2), group("confidence", strong ? 8.1 : 6.0)],
  };
}
