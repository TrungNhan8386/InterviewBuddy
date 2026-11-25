import type { PlanCriterion, PlanDemo, PlanTask, PracticePlan } from "./types";

// Sample data for the Practice Plan skeleton. Dates are built from `today` (YYYY-MM-DD),
// so "today's task" is always visible. Try the states with ?demo=empty | general.

export const PLAN_DEMOS: PlanDemo[] = ["default", "empty", "general"];

function addDays(day: string, days: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

type Seed = { task: string; reason: string; criterion: PlanCriterion | null };

const WEAK_SEEDS: Seed[] = [
  { task: "Luyện trả lời 2 câu hành vi theo STAR, ghi rõ Tình huống và Kết quả.", reason: "Điểm cấu trúc STAR của bạn thấp nhất trong báo cáo gần nhất.", criterion: "structure" },
  { task: "Trả lời 3 câu hỏi kỹ thuật bằng giọng nói, mỗi câu dưới 90 giây.", reason: "Giúp nói gọn và giảm từ ngập ngừng.", criterion: "confidence" },
  { task: "Viết lại câu trả lời yếu nhất từ buổi trước và thêm số liệu cụ thể.", reason: "Nội dung cần ví dụ có con số đo được.", criterion: "content" },
  { task: "Làm một buổi phỏng vấn thử 15 phút và xem lại báo cáo.", reason: "Kiểm tra tiến bộ sau hai ngày luyện tập.", criterion: null },
  { task: "Luyện 2 câu “Điểm yếu của bạn là gì?” và “Vì sao bạn chọn vị trí này?”.", reason: "Câu hỏi HR thường gặp, cần trả lời rõ ràng và trung thực.", criterion: "clarity" },
  { task: "Luyện STAR với một dự án nhóm: nêu vai trò riêng của bạn.", reason: "Tránh trả lời chung chung “chúng tôi”.", criterion: "structure" },
  { task: "Làm một buổi phỏng vấn thử 30 phút, trả lời bằng giọng nói.", reason: "Tập giữ nhịp trong thời lượng gần với buổi thật.", criterion: null },
  { task: "Ôn lại các điểm cần cải thiện trong hai báo cáo gần nhất.", reason: "Chốt lại những lỗi lặp lại.", criterion: null },
  { task: "Chuẩn bị 3 câu hỏi để hỏi nhà tuyển dụng và luyện câu chào, câu kết.", reason: "Mở đầu và kết thúc tốt tạo ấn tượng.", criterion: "clarity" },
  { task: "Nghỉ ngơi, đọc lại ghi chú và kiểm tra micro, mạng trước buổi phỏng vấn.", reason: "Giữ tinh thần ổn định.", criterion: null },
];

const GENERAL_SEEDS: Seed[] = [
  { task: "Làm một buổi phỏng vấn thử 15 phút cho vị trí mục tiêu.", reason: "Chưa có báo cáo, nên bắt đầu bằng một buổi thử để biết điểm yếu.", criterion: null },
  { task: "Đọc lại mô tả công việc và liệt kê 5 kỹ năng quan trọng nhất.", reason: "Biết nhà tuyển dụng cần gì.", criterion: null },
  { task: "Luyện giới thiệu bản thân trong 60 giây.", reason: "Câu mở đầu gần như chắc chắn được hỏi.", criterion: "clarity" },
  { task: "Luyện 2 câu hành vi theo cấu trúc STAR.", reason: "Cấu trúc giúp câu trả lời mạch lạc.", criterion: "structure" },
  { task: "Làm thêm một buổi phỏng vấn thử và xem báo cáo đầu tiên.", reason: "Từ báo cáo này kế hoạch sẽ được cập nhật theo điểm yếu thật.", criterion: null },
];

export function mockPlan(today: string, variant: PlanDemo = "default"): PracticePlan | null {
  if (variant === "empty") return null;
  const general = variant === "general";
  const seeds = general ? GENERAL_SEEDS : WEAK_SEEDS;
  // Start two days ago so the list shows done, missed, today and upcoming tasks.
  const start = addDays(today, -2);
  const tasks: PlanTask[] = seeds.map((seed, index) => ({
    id: `task-${index + 1}`,
    date: addDays(start, index),
    task: seed.task,
    reason: seed.reason,
    criterion: seed.criterion,
    done: index === 0,
  }));
  return {
    interviewDate: tasks[tasks.length - 1].date,
    targetRole: "Frontend Developer Intern",
    weakCriteria: general ? [] : ["structure", "confidence"],
    tasks,
  };
}
