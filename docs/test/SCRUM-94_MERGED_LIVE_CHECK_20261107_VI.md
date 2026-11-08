# Kiểm tra thật bản ghép Setup và SCRUM-94 — 07/11/2026

Đây là snapshot đợt đầu gồm 6 request Chat. Sau khi đối chiếu file cấu hình người dùng gửi lại, đã chạy tiếp các ca còn thiếu; xem [báo cáo tổng hợp 20 yêu cầu mới](SCRUM-94_LIVE_RECHECK_20261107_VI.md). Các số liệu bên dưới được giữ làm lịch sử của đợt đầu.

## Kết luận

Đã chạy bản ghép `53a955c` qua giao diện có bảo vệ với **Supabase và Gemini thật**, không mô phỏng HTTP nghiệp vụ. Setup tạo phiên, Analysis lưu kết quả, Chat lưu câu trả lời, Settings lưu ngôn ngữ, Dashboard và phân quyền hoạt động trong các ca đã kiểm tra.

Gemini tạo được **4 câu hỏi được lưu**, nhưng có **2 lượt lỗi `AI_UNAVAILABLE` trong tổng 6 lượt gọi Chat**. Các lượt thành công hiện chữ sau khoảng **3,45–4,35 giây**, hoàn tất khoảng **3,85–4,74 giây**. Chưa đạt mục tiêu hai giây và chưa đủ 20 yêu cầu sinh mới để nghiệm thu SCRUM-94.

Không áp dụng migration trong lần này. Plugin Supabase đã được cài nhưng hai lần đọc danh sách project đều trả lỗi công cụ `Unknown tool`; chưa có truy vấn quản trị hoặc DDL nào được thực thi.

## 1. Môi trường và phạm vi

- Nhánh `feat/scrum-94-chat-streaming-hung`, commit `53a955c`, Next.js dev trên Windows, Edge headless, model cấu hình `gemini-3.5-flash-lite`.
- Mock Chat và Analysis đều tắt. Observer chỉ theo dõi fetch/DOM, không thay response hoặc đọc lại body SSE trong ứng dụng.
- Dùng CV tổng hợp 685 ký tự và JD 415 ký tự; không có dữ liệu ứng viên thật. Analysis tiếng Việt trả 200, hiển thị và lưu thành công.
- Đăng nhập bằng tài khoản test qua UI; API dùng cookie/quyền của tài khoản đó. Không dùng service-role.
- Có giãn nhịp ít nhất 8 giây giữa thời điểm bắt đầu các request AI. Khoảng chờ này nằm trước thao tác đo; không được trừ thời gian chờ provider khỏi số đo.
- Lần mở đầu đo từ bấm Start, gồm tạo phiên/chuyển trang; các lượt sau đo từ Send, gồm lưu answer. Có thêm số đo từ next-fetch đến hiển thị để phân biệt. Đây không phải môi trường production hoặc kiểm tra khả năng chịu tải.

## 2. Kết quả chức năng thật

| Kiểm tra | Kết quả |
| --- | --- |
| Đăng nhập A | Đạt |
| Settings lưu English, đọc lại và Setup mới nhận mặc định English | Đạt; sau đó khôi phục về vi |
| Analysis CV/JD qua UI | 200, lưu thành công; fit score 87,5 trong ca này, chưa đánh giá độ đúng chuyên môn của điểm |
| Setup qua UI | Tạo một phiên thật, chuyển đúng Chat |
| Câu trả lời ngắn “Dạ có.” | Nhận một câu `follow_up` được lưu |
| Persistence sau lỗi AI | Giữ đủ 4 câu hỏi và 4 câu trả lời, ID câu hỏi không trùng; answer cuối vẫn được giữ |
| Dashboard | Có link tới phiên test thật vừa tạo |
| Kết thúc và mở lại | Kết thúc qua API, đọc lại completed; UI hiển thị phiên đã kết thúc, không gọi thêm AI |
| User B truy cập phiên A | API 404/NOT_FOUND; UI hiển thị thông báo tiếng Việt và nút thử lại/về Dashboard, không lộ nội dung phiên |

Tổng cộng 10 kiểm tra chức năng ghi nhận đạt. Một assertion UI ban đầu bị vướng hai phần tử alert (một alert dev rỗng); đã đọc lại toàn bộ alert và kiểm tra ảnh, xác nhận thông báo NOT_FOUND đúng. Không sửa code ứng dụng để làm kiểm tra này đạt.

Không xóa dữ liệu test/seed. Giữ một session, một analysis, bốn question và bốn answer mới để nhóm đối soát; session đã kết thúc, ngôn ngữ profile đã khôi phục.

## 3. Thống kê Chat và lỗi

| Nhóm | Số liệu |
| --- | --- |
| Yêu cầu sinh mới | 5; trong đó 3 hợp lệ/lưu được, 2 lỗi |
| Retry thủ công có chủ đích | 1, thành công; tách khỏi mẫu sinh mới |
| Tổng HTTP next | 6; 4 thành công, 2 lỗi |
| Nhanh ≤2 giây và cuối cùng hợp lệ/lưu | 0/5 yêu cầu mới |
| Hoàn tất hợp lệ/lưu ≤5 giây | 3/5 yêu cầu mới |
| Phản hồi busy/khóa input ≤200 ms | Quan sát 5/5 yêu cầu mới; không phải chữ câu hỏi |
| Hạn mức app | Từ 0 lên 7/100: 1 analysis + 6 next; không chạm hạn mức ngày của ứng dụng |

Lượt mở đầu lỗi được giữ nguyên. Sau khi đối chiếu log, một retry có chủ đích thành công, rồi ba lượt mới tiếp theo thành công. Lượt mới thứ năm lại lỗi `AI_UNAVAILABLE`; dừng batch AI tại đây để chẩn đoán và giữ dữ liệu, không gọi lặp tới khi có kết quả đẹp.

Backend trace xác nhận hai lỗi `AI_UNAVAILABLE` xuất hiện sau khi request đã xác thực, claim và chuẩn bị context; lượt lỗi đầu nhận upstream headers/frame sau khoảng 12 giây nhưng chưa có chữ câu hỏi. HTTP của SSE vẫn có thể là 200 rồi mới phát error. Không coi HTTP 200 hoặc một draft là thành công.

Đây là lỗi ở giai đoạn provider/stream được backend phân loại; chưa xác định chính xác điều kiện dịch vụ/transport phía Gemini. Không có bằng chứng đây là lỗi thiếu migration Settings hoặc hết quota ứng dụng. Không đổi key/model hay tăng quota để vượt lỗi.

Các số liệu thành công không bao gồm lỗi không có chữ đầu. Cả hai lỗi vẫn nằm trong mẫu, và retry không thay kết quả lượt lỗi gốc. Mẫu chỉ có 5 yêu cầu mới, nên không được ghi nhận đã đủ bộ 20 hoặc đã nghiệm thu.

## 4. Migration Settings

File đã chuẩn bị và được kiểm tra local trong bản ghép: `src/supabase/migrations/20261107000000_settings_data.sql`.

- Kiểm tra bridge `save_own_interview_answer` bằng input rỗng trả 404/PGRST202; input không thể ghi answer. Chưa có đủ quyền để kiểm tra definition/lịch sử migration của database cloud.
- Schema discovery qua Data API trả 401, nên không suy diễn rằng các RPC persistence cũ đều thiếu; luồng Chat thật đã dùng chúng để lưu và kết thúc phiên.
- Supabase được cài nhưng kênh quản trị trả `Unknown tool` khi đọc project; không gọi apply_migration hoặc execute_sql.
- Chat hiện dùng persistence API/migration 20261105. Migration 20261107 cần cho chức năng purge và bridge tương thích, không phải điều kiện mới để Chat streaming chạy.
- Không gọi `delete_own_practice_data`, không bấm xóa lịch sử/CV và không reset database.

Nhân/admin cần đối chiếu project và lịch sử migration rồi áp dụng phần thiếu theo [quy trình migration của Supabase](https://supabase.com/docs/guides/deployment/database-migrations). Không dùng anon key để thực thi DDL hoặc tự sửa quyền/RLS để vượt lỗi.

## 5. Bằng chứng và giới hạn

[JSON đã ẩn ID thật](results/scrum94-merged-live-20261107.json) ghi đủ sáu attempt, retry, trace số, chức năng đã kiểm tra và trạng thái migration. Log gốc, đối chiếu ID và ảnh có tài khoản test được giữ riêng ở máy người chạy; không đưa key/password/token/cookie/storage state vào báo cáo.

Chưa kiểm tra English/long-profile thật trong đợt này vì batch bị dừng sau lỗi provider lặp lại; không lấy kết quả UI mô phỏng trước đó thay cho các ca còn thiếu. Chưa chạy production build, PDF extraction, purge thật hoặc đủ 20 lượt latency. Cần chạy tiếp bộ mẫu mới có giữ toàn bộ lỗi sau khi chẩn đoán/ổn định provider; báo cáo này không ghi nhận SCRUM-94 Done.

Không sửa runtime, commit/push hoặc đăng Jira trong lần kiểm tra thật này.
