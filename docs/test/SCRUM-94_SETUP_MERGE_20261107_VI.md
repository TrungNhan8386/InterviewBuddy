# Ghép Setup, Dashboard và Settings với Chat streaming — 07/11/2026

## Kết quả

Đã ghép `origin/feat/setup-dashboard-settings` tại `c7d5ca7` vào nhánh `feat/scrum-94-chat-streaming-hung`, trên nền `de1b323`. Hai xung đột được xử lý theo chức năng cần giữ, không thay toàn bộ bản của một phía. Merge giữ lịch sử hai commit của Tài và các commit streaming/persistence trước đó.

## 1. Trang phỏng vấn

File xung đột: `src/app/(workspace)/interview/[id]/page.tsx`.

Giữ route đang import `components/interview-chat/InterviewChat`, metadata và `key={id}`. Nội dung route giống bản `de1b323`; không chuyển sang Chat JSON tối thiểu của nhánh Tài. Xác thực route vẫn do proxy đảm nhiệm; tải/lưu dữ liệu dùng các API đã kiểm tra quyền sở hữu.

Nhận Setup mới của Tài: kiểm tra form, gọi API tạo session, kiểm tra UUID rồi mở route trên. Chat tiếp tục dùng SSE, giữ preview và khóa input trước complete, lưu answer qua persistence API, truyền đúng answer ID cho câu tiếp theo, resume và kết thúc qua API.

Component tối thiểu `components/interview/InterviewChat` và RPC tương thích `save_own_interview_answer` được giữ trong lịch sử/bản bàn giao, nhưng không được route phỏng vấn hiện tại sử dụng. Chat tích hợp tiếp tục gọi `POST /api/interview/{id}/answers`, dùng `save_interview_answer` của migration 20261105.

## 2. Tài liệu database

File xung đột: `docs/analysis and design/database-design.md`.

- Giữ phần reservations, persistence và `ai_usage_daily` của Nhân/Hưng.
- Bổ sung migration Settings ngày 07/11 thành migration thứ 5, sau migration ngày 05/11.
- Gỡ migration/sơ đồ generation bị lặp do auto-merge, giữ quan hệ answer anchor và metadata.
- Bổ sung hai RPC của Tài và ghi rõ RPC nào được Chat chính sử dụng.
- Giữ phân biệt giữa schema local và migration đã triển khai lên cloud; xóa dữ liệu luyện tập không reset hạn mức AI.

Đồng thời chỉnh lại API register và hướng dẫn Week 7 để chúng mô tả Chat streaming đang dùng, đủ thứ tự migration và không trình bày kết quả 171 test của nhánh riêng thành kết quả bản ghép.

## 3. Các phần nhận từ nhánh Tài

Setup tạo phiên thật qua API, Dashboard lấy số lượng/danh sách phiên của user, Settings lưu ngôn ngữ mặc định và cung cấp xóa dữ liệu có xác nhận. Các API/contract/test/migration đi kèm được giữ. Không thay đổi framework, dependency, key hoặc cấu hình local để xử lý xung đột.

## 4. Kiểm tra

| Kiểm tra | Kết quả và giới hạn |
| --- | --- |
| Toàn bộ `npm test` trên bản ghép | **243/243 đạt**, 0 fail/skip; gồm streaming, persistence, hạn mức, RLS và Settings trên PGlite/HTTP cục bộ |
| `npm run lint` | Đạt trên toàn bộ source |
| `next typegen` rồi `npm run typecheck` | Đạt |
| Browser trước merge | Thất bại đúng tại nút Bắt đầu đang disabled; ghi nhận feature chưa nối |
| Browser sau merge | **5/5 nhóm kiểm tra đạt** trên trang sản phẩm có bảo vệ: Setup → SSE Chat vi/en; save/anchor/resume/end vi/en; Settings save/reload |
| Git | Hai xung đột đã đánh dấu giải quyết, không còn marker; merge được chốt bằng commit local |

Bộ browser dùng đăng nhập Supabase test và đọc profile thật, nhưng thay HTTP ở ranh giới nghiệp vụ interview/Settings bằng dữ liệu tổng hợp. Không gọi Gemini, không tạo/xóa practice data trên Supabase dùng chung. Đây là kiểm tra giao diện và nối component/API, không phải kiểm tra cloud persistence hoặc benchmark tốc độ AI.

Các điều được kiểm tra trên giao diện:

1. Form Setup gửi dữ liệu và mở Chat đúng session; preview câu hỏi xuất hiện trước complete, ô trả lời vẫn khóa.
2. Sau complete, ô trả lời được mở; câu trả lời được lưu trước khi request tiếp theo mang answer anchor đó.
3. Reload hiển thị lại câu đang chờ trả lời mà không gọi thêm generation.
4. Kết thúc qua dialog chuyển đúng trạng thái UI, cả vi/en.
5. Settings lưu/tải lại ngôn ngữ qua contract HTTP; không gửi yêu cầu xóa.

Trong quá trình dựng bộ chạy, đã khắc phục việc helper Windows để sót tiến trình thử và sửa selector để bấm nhãn radio hiển thị. Các điều chỉnh này nằm ở bộ chạy test, không dùng sửa logic ứng dụng để làm test đạt. Máy chủ do bộ kiểm tra tạo được dừng sau khi chạy.

Runner được bổ sung tại `src/tests/browser/setup_streaming_integration.py`. Runner cần app local đang chạy và tài khoản test trong cấu hình riêng; không truyền password qua dòng lệnh. Giữ output/screenshot của runner ở thư mục riêng ngoài checkout vì ảnh có thể chứa thông tin tài khoản.

## 5. Phần chưa được xác nhận

- Chưa áp dụng migration 20261107 lên Supabase thật; cần người quản lý database review và triển khai phần còn thiếu.
- Chưa chạy lại luồng Gemini/persistence thật trên bản ghép hoặc production build.
- Bộ UI có SSE giả lập không chứng minh tốc độ Gemini đạt mục tiêu SCRUM-94; không thay thế mẫu thật ngày 06/11 và không ghi nhận task đã nghiệm thu.
- Chưa push merge này hoặc đăng cập nhật Jira trong bước giải quyết xung đột.

Kết quả máy đọc được: [scrum94-setup-merge-20261107.json](results/scrum94-setup-merge-20261107.json). Log gốc và ảnh lỗi phục vụ kiểm tra được giữ ở máy người chạy; không đưa account screenshots, key, token, cookie, storage state hoặc ID database thật vào báo cáo công khai.
