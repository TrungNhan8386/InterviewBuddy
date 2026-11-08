# SCRUM-94 — xuất bản code, tích hợp và kiểm tra

Ngày: 06/11/2026. Người thực hiện yêu cầu: Lâm Gia Hưng. Thao tác ghép code/kiểm thử dưới đây do Codex chạy theo yêu cầu; không phải biên bản thành viên nhóm đã kiểm tra thủ công hoặc giảng viên nghiệm thu.

## 1. Phạm vi đưa lên GitHub

Nhánh: `feat/scrum-94-chat-streaming-hung`. Nền: `origin/main` tại `366cbd3`.

Nhánh giữ lịch sử tác giả bằng cách merge các nguồn trước khi thêm sửa tích hợp:

| Nguồn | Commit | Vai trò |
| --- | --- | --- |
| Nhân — `feat/scrum-79-session-persistence`, PR #19 | `b509af5` | API persistence/resume, hạn mức AI và migration. |
| Khang — `feat/interview-chat-khang`, PR #20 | `ce7d687` | Trang/component Chat và các tài liệu/test được bàn giao. |
| Hướng dẫn nhóm — `docs/scrum94-team-integration-guide`, PR #21 | `026568c` | Hướng dẫn tích hợp và liên kết README. |
| Triển khai SCRUM-94 local | Thay đổi trên nền SCRUM-93 `baa2f8e` | Streaming, consumer, chẩn đoán, fixture, kiểm thử và bằng chứng trước đó. |

Đây là nhánh tích hợp để review; không tự merge PR #19/#20/#21 vào `main` và không xác nhận thay người phụ trách các phần đó. Khi các PR nguồn vào main, phần chênh lệch của PR tích hợp sẽ thu gọn theo lịch sử chung.

## 2. Code và test được bổ sung

- Provider Gemini đọc stream, kết thúc khi nhận `STOP`, kiểm tra decision đầy đủ trước khi lưu.
- HTTP SSE `ready`/`delta`/`complete`/`error`, giữ tương thích response JSON.
- Consumer browser xử lý draft, xác nhận cuối, deadline 35 giây, hủy, cảnh báo 5/10 giây và số đo.
- Timing backend tùy chọn qua `INTERVIEW_TIMING_LOGS`; không log CV/JD/answer hoặc credentials.
- Chat dùng API tải phiên, lưu answer, kết thúc; chỉ xin câu tiếp theo với ID answer đã lưu.
- Giao diện hiển thị preview, khóa input tới complete, xóa draft khi lỗi/hủy, vi/en, resume và thử lại có chủ đích.
- Quota bao phủ cả `next()` và `stream()`; thiếu RPC/hết quota thì chặn trước Gemini.
- Kiểm thử provider/HTTP/consumer/diagnostics/quota/transport; browser harness và fixture tổng hợp.
- Runner UI tự nhận đường dẫn dependency junction; không yêu cầu máy khác có thư mục `main` bên cạnh.
- Tài liệu API, nghiên cứu, mốc nghiệm thu và các báo cáo cũ được kèm theo với nguồn gốc và giới hạn môi trường.

Không đưa khóa, `.env.local`, môi trường Python, `node_modules`, output tạm hay các file Word cũ vào commit triển khai. Các sửa `src/app/api/health/route.ts` và `src/app/layout.tsx` ở working tree ban đầu không thuộc lần xuất bản này và được giữ nguyên ở local.

## 3. Kết quả kiểm tra bản chuẩn bị xuất bản

| Kiểm tra mới chạy | Kết quả | Giới hạn |
| --- | --- | --- |
| `npm test` | 241/241 đạt, không bỏ qua ca nào. | Offline, có PGlite/RLS cục bộ và HTTP localhost; không phải Supabase cloud. |
| Streaming browser harness | 13 kịch bản đạt. | Consumer/service/provider thật với upstream tổng hợp, Auth giả lập và PGlite. |
| Chat UI với Turbopack | 5 kịch bản đạt, không có page error. | Component Chat thật, HTTP giả lập; kiểm tra CSS grid, vi/en, input lock, save→next, 5/10 giây/hủy, invalid output và resume. |
| TypeScript | `next typegen` và `npm run typecheck` đạt. | Kiểm tra trên bản ghép, không sử dụng sửa layout riêng ở working tree ban đầu. |
| ESLint | 28 file runtime/test/type declaration thay đổi đạt. | Kiểm tra có chọn lọc theo các file code mới/sửa, không phải kết luận mọi file toàn repo đều sạch lint. |
| Bí mật và phạm vi stage | Scan 264 file không phát hiện khóa; `.env.local` được ignore, không tracked. `git diff --cached --check` đạt. | Stage 55 file triển khai/test/báo cáo; không có sửa health/layout hay file Word ngoài phạm vi. |
| Liên kết tài liệu | 40 liên kết local trong các Markdown mới/sửa đều tồn tại. | Không kiểm tra lại trạng thái mọi website nguồn học thuật trong lần xuất bản code. |

Bằng chứng mới:

- [Streaming browser controlled](results/scrum94-browser-controlled-publication-controlled.json).
- [Chat UI](results/scrum94-chat-ui-publication-20261106.json).
- Log offline local: `publish-scrum94/tmp/scrum94-publication-offline.log`; ảnh Chat local: `publish-scrum94/output/chat-stream/publication-styled/`.

Các JSON live cũ được giữ để truy vết, không đổi thành kết quả của lần xuất bản này. Lần chuẩn bị xuất bản không gọi thêm Gemini và không áp dụng migration hoặc tạo dữ liệu trên Supabase cloud. Các tiến trình test và route fixture tạm được dọn sau kiểm tra.

## 4. Phần còn chờ

- Nhân/admin xác nhận URL/anon key, migration/RPC và user test đã xác nhận email.
- Tài/người phụ trách SCRUM-84 nối form Setup với tạo session và chuyển đến Chat; nút bắt đầu ở snapshot hiện tại vẫn disabled.
- Kiểm tra trên Chat sản phẩm đã đăng nhập + Supabase dùng chung, gồm ownership/quota/resume và ít nhất 20 lượt sinh mới theo [mốc nghiệm thu](SCRUM-94_ACCEPTANCE_TARGETS_VI.md).
- Các mốc tốc độ vẫn là tiêu chí làm việc chờ thống nhất, chưa có kết luận đạt. Không dùng 241 test offline hoặc 5 ca HTTP giả lập để đánh dấu Done.
- Không chạy lại production build trong lần xuất bản này. Báo cáo trước ghi nhận lỗi build Turbopack ở môi trường local; Webpack compile thành công trước đó không xác nhận CSS Tailwind theo cấu hình Turbopack hiện có.

Đọc [hướng dẫn kết nối nhóm](../integration/TEAM_INTEGRATION_GUIDE_VI.md) để cấu hình và chạy luồng thật. Nhánh tích hợp chưa chứng minh production sẵn sàng và không tự thay đổi trạng thái Jira.
