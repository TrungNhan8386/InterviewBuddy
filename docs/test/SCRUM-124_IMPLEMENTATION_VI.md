# SCRUM-124 — Tách prompt sang cấu hình

Ngày thực hiện: 13/11/2026. Nguồn yêu cầu: [SCRUM-124](https://nhom3-24c01-se.atlassian.net/browse/SCRUM-124), “Move all prompt texts into config files so they can change without code changes.” Jira chưa có Description hoặc Acceptance Criteria bổ sung tại lúc đọc.

Đã kiểm tra trạng thái nhánh và fetch `origin --prune` trước khi thực hiện. Nhánh đích `origin/main` tại commit `0668228`; tạo worktree riêng `scrum124-prompt-config`, nhánh `feat/scrum-124-prompt-config-hung`. Giữ nguyên các thay đổi chưa commit của SCRUM-120/121/122/123. Không merge các nhánh thành viên hoặc nhánh task chưa hợp nhất vào main.

## Kết quả triển khai

| Phạm vi | Cấu hình mới | Thành phần sử dụng |
|---|---|---|
| Analysis: yêu cầu, bằng chứng, coaching, ngôn ngữ | `src/config/prompts/analysis.json` | `src/lib/analysis/gemini.mjs` |
| Interview: system instruction, hỏi tiếp, ngôn ngữ | `src/config/prompts/interviewer.json` | `src/lib/interview/interviewer-prompt.mjs` |
| Vòng technical/behavioral/hr và 9 chính sách độ khó | `src/config/prompts/question-plan.json` | `src/lib/interview/question-plan.mjs` |
| Câu lệnh diagnostic Gemini | `src/config/prompts/health.json` | `src/lib/ai/health-prompt.mjs` và route Health |

Loader dùng static JSON imports, kiểm tra version/các dòng/ngôn ngữ/chính sách và đóng băng dữ liệu cấu hình. Không eval, không đường dẫn từ client, không tải remote config hoặc nội suy CV/JD vào system instruction. Node standalone và Next.js dùng cùng các file. Request vẫn theo [GenerateContent API](https://ai.google.dev/api/generate-content), giữ nguyên systemInstruction, contents và generationConfig; không đổi SDK, model, key hay schema.

Bản tách độc lập ban đầu giữ nguyên prompt của main: Interview `0.10`, question-plan `jd-cv-context-v3`. Khi chuẩn bị PR đã tích hợp theo chuỗi các task; xem phần kiểm chứng mới bên dưới. Hai file Analysis và Health có metadata version `1.0`. Chưa bổ sung cột database hoặc đổi API response để đưa hai version mới này ra ngoài.

Đã có [hướng dẫn sửa cấu hình](../../src/config/prompts/README.md) cho nhóm. Production cần rebuild/redeploy; task này không triển khai hot reload hoặc giao diện quản trị prompt. Không cần thay đổi mã logic để chỉnh lời hướng dẫn trong các file đã tách.

## Kiểm chứng

- Dùng test-driven-development: test ban đầu thất bại vì chưa có cấu hình; sau khi tạo JSON, các test tiếp tục phát hiện builder bỏ qua nội dung chỉnh và không kiểm tra cấu hình sai. Riêng round/difficulty cũng được thấy thất bại trước khi nối vào config.
- 11 test mới thay JSON trong thư mục tạm rồi chạy builder thật: Analysis/Interview Việt và Anh, version, Health, mọi tổ hợp loại vòng/độ khó, thiếu policy, dòng rỗng, sai kiểu, thiếu locale và version. Không sửa file làm việc để giả lập; không gọi model trong các test này.
- So sánh request trước/sau với baseline được chụp trước refactor: 56 request Interview (14 fixture × 2 ngôn ngữ × 2 context mode), 2 Analysis và 1 Health giống hoàn toàn, gồm lời hướng dẫn, dữ liệu, schema, thông số và policy. [Bằng chứng so sánh](results/scrum124/request-preservation.json).
- Toàn bộ `npm test`: **266/266 đạt**, không skip. Số lượng này là 255 test của main + 11 test mới; không bao gồm test của các nhánh SCRUM-121/122/123 chưa merge.
- `npm run lint`: đạt. `npm run build`: đạt, bao gồm TypeScript và đóng gói JSON trong Next.js 16.4.2. Build dùng URL/key Supabase tổng hợp, không dùng credentials thật hoặc gọi Gemini/Supabase nhóm.

## Ranh giới nghiệm thu

Không sửa UI, database, migration, quy tắc tính điểm hoặc cơ chế lưu/giới hạn. Những đoạn ví dụ trong fixture và câu trả lời giả ở mock mode là dữ liệu test, không phải prompt ứng dụng. Marker biểu diễn đoạn nguồn bị lược bỏ và mã field/schema vẫn nằm ở logic chương trình.

Không gọi lại Gemini thật vì đây là refactor bảo toàn request; bằng chứng là request equality và test tích hợp offline, không phải phép đo chất lượng model, tốc độ hoặc nghiệm thu Chat/Supabase thật. Nếu nhóm sửa nội dung cấu hình, cần đánh giá Gemini riêng. Kiểm tra hình dạng config không chứng minh prompt mới an toàn hoặc đúng chuyên môn.

Phần triển khai độc lập ban đầu chưa kế thừa SCRUM-121/123. Đợt chuẩn bị PR đã xử lý các xung đột, đưa prose kết hợp sang JSON và giữ validator/safetySettings/quota; xem kết quả mới bên dưới.

Chưa commit/push, tạo PR, đăng comment hoặc đổi trạng thái Jira trong task này.

## Kiểm chứng bản kết hợp trước khi tạo PR ngày 13/11/2026

PR dựa trên `feat/scrum-123-guardrails-hung`, commit `732c5b6`, kế thừa SCRUM-121/122/123. Prompt Interview trong JSON là `0.13-guardrails-1`; Analysis giữ hướng dẫn chống tiêu chí phân biệt đối xử. Không xóa quota helper, safetySettings hoặc validator khi giải quyết xung đột.

Đã so sánh nguyên request với nhánh cha: 56 Interview, 2 Analysis và 1 Health giống hoàn toàn, gồm safetySettings và chính sách. `stack-request-preservation.json` là bằng chứng mới; `request-preservation.json` giữ lịch sử so với main trước khi tích hợp. Số 266 test phía trên là bản độc lập. Bản kết hợp: **294/294 test đạt**, lint và production build/TypeScript đạt. Kết quả xuất bản lưu ở `publication-verification.json`.

Không gọi lại Gemini hoặc Supabase thật trong đợt chuẩn bị PR. Test cấu trúc và request equality không biến các số replay cũ thành kết quả model của phiên bản kết hợp. Thứ tự tích hợp PR và cách retarget sau khi merge đã ghi trong README cấu hình.
