import type { PlanCriterion } from "./types";

// UI text of the Practice Plan page (Vietnamese, like the other workspace pages).

export const PLAN_TEXT = {
  title: "Kế hoạch luyện tập",
  subtitle: (role: string, interviewDate: string, daysLeft: number) =>
    `${role} · phỏng vấn ngày ${interviewDate} (${daysLeft <= 0 ? "hôm nay" : `còn ${daysLeft} ngày`})`,
  sampleNote:
    "Dữ liệu mẫu: trang này chưa nối với dịch vụ tạo kế hoạch. Các nhiệm vụ dưới đây chỉ để xem bố cục.",
  interviewDateLabel: "Ngày phỏng vấn thật",
  generate: "Tạo kế hoạch",
  generateSoon: "Việc tạo kế hoạch bằng AI sẽ có ở bước sau. Hiện bạn chỉ xem bố cục với dữ liệu mẫu.",
  dateRequired: "Hãy chọn ngày phỏng vấn.",
  datePast: "Ngày phỏng vấn phải là hôm nay hoặc sau đó.",
  emptyTitle: "Bạn chưa có kế hoạch luyện tập",
  emptyBody: "Chọn ngày phỏng vấn thật để tạo kế hoạch theo từng ngày.",
  generalNote:
    "Bạn chưa có báo cáo nào, nên đây là kế hoạch chung theo vị trí mục tiêu. Hãy làm một buổi phỏng vấn thử để kế hoạch bám sát điểm yếu của bạn.",
  startInterview: "Làm phỏng vấn thử",
  progress: (done: number, total: number) => `Đã xong ${done}/${total} nhiệm vụ`,
  weakTitle: "Tập trung vào",
  today: "Hôm nay",
  missed: "Chưa làm",
  done: "Đã xong",
  markDone: (task: string) => `Đánh dấu đã xong: ${task}`,
  addToCalendar: "Thêm vào lịch",
  soon: "Sắp có",
  criteria: {
    content: "Nội dung",
    structure: "Cấu trúc STAR",
    clarity: "Độ rõ ràng",
    confidence: "Tự tin",
  } satisfies Record<PlanCriterion, string>,
};
