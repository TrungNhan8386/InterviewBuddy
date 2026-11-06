# Chuẩn bị kiểm tra Chat và Supabase thật — 06/11/2026

Ghi chú xuất bản: đây là bản ghi giai đoạn chuẩn bị local. Code tương ứng được gom lên nhánh `feat/scrum-94-chat-streaming-hung`; xem [báo cáo xuất bản](SCRUM-94_PUBLICATION_20261106_VI.md). Các thông báo chưa commit/push ở dưới mô tả thời điểm chuẩn bị, không phải kết luận rằng code luôn chỉ ở local.

Hướng dẫn thực hiện cho cả nhóm: [Kết nối Supabase, analysis, Setup, Chat và streaming](../integration/TEAM_INTEGRATION_GUIDE_VI.md). Tài liệu có thứ tự ghép code, cấu hình trên từng máy, contract API và checklist bàn giao.

## Trạng thái

Chưa thực hiện request kiểm thử lên Supabase thật. Cả hai bản local của dự án chưa có `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`; chưa có thông tin tài khoản test được xác nhận. Không áp dụng migration lên cloud, không tạo dữ liệu cloud và không gọi Gemini thêm trong lần chuẩn bị này.

Đã fetch GitHub và tìm thấy code mới của nhóm. Supabase/persistence thuộc phần Nhân trong SCRUM-79; giao diện Chat thuộc Khang trong SCRUM-95; streaming và đo độ trễ thuộc Hưng trong SCRUM-94. Thiết lập `.env.local` là bước cấu hình trên từng máy, không phải yêu cầu Hưng xây lại database.

## Cần nhận từ Nhân/người quản lý project Supabase

1. URL project dùng chung và anon/public key để cấu hình file `main/src/.env.local`. Không cần service_role key cho luồng Chat của người dùng.
2. Xác nhận bốn migration đã được review/áp dụng, đặc biệt `20261103000000_interview_next.sql` và `20261105000000_session_resume_ai_limit.sql`. Hiện chưa xác minh trạng thái migration trên cloud.
3. Tài khoản test đã xác nhận email, hoặc người dùng đăng nhập trực tiếp khi chạy ứng dụng. Không đưa mật khẩu/token vào báo cáo/chat.

Sau đó Hưng kiểm tra luồng đăng nhập → tải/tạo phiên → sinh câu hỏi streaming → lưu answer → follow-up/next-topic → reload/resume → kết thúc. Kiểm tra RLS/hạn mức với tài khoản thử riêng và đo ít nhất 20 lượt sinh mới theo mốc SCRUM-94; không đếm HTTP giả lập thành nghiệm thu Supabase.

## Bản tích hợp riêng

- Thư mục: `D:/BackUp/HCMUS_Semester_7/introSE/project/scrum94-chat-supabase`.
- Nhánh local: `test/scrum94-chat-supabase-20261106`.
- Nền persistence: `origin/feat/scrum-79-session-persistence`, commit `b509af5`.
- Chat: patch từ `origin/feat/interview-chat-khang`, commit `ce7d687`, trên `origin/main` `366cbd3`.
- Streaming: các module SCRUM-94 local và test được chép có chọn lọc từ thư mục `main`; không chép `.env.local` hoặc các thay đổi layout/health riêng của người dùng.
- Không commit/push/merge vào nhánh chính trong lần chuẩn bị này.

Dependency được dùng lại bằng junction `src/node_modules` tới bản main. Turbopack cần additional root khi dependency nằm ngoài worktree; cấu hình này chỉ bật khi có `INTERVIEW_LINKED_DEPENDENCY_ROOT`. Runner giao diện tự đặt biến này. Không cài thêm package hoặc thay phiên bản dependency.

## Các chỗ đã nối/sửa trong bản tích hợp

- Chat lấy toàn bộ turns và startedAt từ GET session API của Nhân; lưu answer và kết thúc qua các API persistence, thay các lệnh ghi trực tiếp từ browser.
- `requestNext` dùng consumer SSE của SCRUM-94. UI hiển thị draft, thông báo 5/10 giây và nút hủy; ô trả lời chỉ mở sau complete hợp lệ. Xóa draft khi lỗi/hủy và dừng request khi rời trang. Lỗi và trạng thái có tiếng Việt/Anh.
- Loại retry tự động trong Chat; nút thử lại dùng lại đúng answer anchor.
- Bộ giới hạn AI của Nhân trước đây chỉ bọc `next()`; khi ghép thêm `stream()` từ SCRUM-94 thì đường stream chưa kiểm tra quota. Đã thêm kiểm tra hạn mức trước stream, không tính lượt end/hủy sớm, và giữ fail-closed khi thiếu RPC quota. Đây là lỗi tích hợp đã tái hiện offline, không phải cáo buộc cloud đã bị khai thác.

## Kiểm tra đã thực hiện

| Kiểm tra | Kết quả và phạm vi |
| --- | --- |
| TDD quota streaming | Ba ca thất bại trước sửa, sau sửa 4/4 ca đạt. Kiểm tra chặn Gemini khi hết quota/thiếu RPC và chỉ tính một lượt. |
| TDD Chat transport | 6/6 ca thất bại trước triển khai adapter; sau triển khai đều đạt. Kiểm tra route save/end/resume, SSE draft trước complete, answer anchor và không retry quota. |
| Toàn bộ `npm test` của bản ghép | **241/241 đạt**. Bao gồm PGlite/RLS cục bộ và HTTP localhost. Log: `main/tmp/scrum94-chat-integration-tests-20261106.log`. Không phải Supabase cloud. |
| TypeScript | Đạt sau `next typegen`. Đã dọn đúng các file types được Next dev sinh cho route fixture tạm sau khi xóa fixture. |
| ESLint các module thay đổi | Đạt trong lần kiểm tra các module Chat, quota và route. |
| Chat React trên Edge headless | 5 kịch bản đạt: vi/en preview/complete/khóa input, 5/10 giây và hủy, invalid output xóa draft, resume không gọi AI. HTTP được giả lập; không giả làm xác nhận Supabase. |
| Kiểm tra trực quan | Đã xem ảnh preview vi và complete en từ lần Turbopack có CSS Tailwind; đã kiểm tra `display:grid`. Ảnh Webpack trước đó không dùng làm bằng chứng bố cục vì loader Tailwind của repo chỉ cấu hình cho Turbopack. |

Runner UI tạo một route public tạm trong worktree để mount component thật, dùng dữ liệu/HTTP tổng hợp, rồi xóa route và đóng tiến trình sau test. Không bỏ xác thực của route Chat sản phẩm và không tắt RLS. Lần Turbopack đầu không tìm thấy dependency ngoài root; thêm additional root cho junction rồi kiểm tra lại đạt. Đây là cấu hình worktree, không phải thay đổi quyền cloud.

Bằng chứng nằm trong worktree riêng:

- `src/tests/interview-stream-quota.test.mjs`.
- `src/tests/interview-chat-transport.test.mjs`.
- `src/tests/browser/chat_stream_ui.py`.
- `output/chat-stream/tdd-red/report.json`: lỗi UI trước khi nối preview.
- `output/chat-stream/styled/report.json`: 5 kịch bản đạt với Turbopack/CSS; ảnh trong cùng thư mục.

**Chưa có kết quả Chat + Supabase thật hoặc xác nhận đạt tốc độ trên môi trường đó.** Khi có cấu hình và tài khoản, cần restart ứng dụng với mock mode tắt và chạy lại toàn luồng được bảo vệ, gồm trạng thái migration, lưu/resume, quyền sở hữu, quota và các số đo latency.
