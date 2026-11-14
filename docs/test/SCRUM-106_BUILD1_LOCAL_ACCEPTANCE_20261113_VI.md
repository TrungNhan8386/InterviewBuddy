# SCRUM-106 – Kiểm thử tích hợp Build 1 trên bản production chạy local (13/11/2026)

Người thực hiện: Nguyễn Trần Trung Nhân · Jira: SCRUM-107, SCRUM-108, SCRUM-109, SCRUM-110 · Kết quả chi tiết: [results/scrum106-local-acceptance-20261113.json](results/scrum106-local-acceptance-20261113.json)

## 1. Kết luận

| Việc | Kết quả |
| --- | --- |
| SCRUM-107 – 4 test case được giao (UC02-03, UC06-02, UC06-04, UC06-06) | **4/4 Pass ở mức API**, đã ghi vào `test_use_cases/InterviewBuddy_Test_Cases_Build1_v1.0.xlsx`. UC06-06 bước 2 là N/A (feedback thuộc tuần 7). |
| SCRUM-108 – Luồng đầy đủ: đăng nhập → phân tích → Setup → phỏng vấn đến hết | **Đạt** ở lần chạy thứ hai. Lần đầu kẹt ở lượt 4 vì engine trả `INVALID_OUTPUT` ba lần liên tiếp (lỗi B3, mục 4). |
| SCRUM-109 – Câu hỏi tiếp theo xuất hiện trong 5 giây với ≥ 95% của 20 lượt | **Đạt: 19/20 = 95%**. Thời gian hoàn tất p50 2,91 s, p95 4,13 s. Lượt còn lại lỗi `AI_UNAVAILABLE` do Gemini quá tải. |
| SCRUM-110 – Lỗi tích hợp | 2 lỗi đã sửa ở [PR #25](https://github.com/TrungNhan8386/InterviewBuddy/pull/25). 1 lỗi engine cần Hưng xử lý (B3). |

**Giới hạn:** nhóm chưa deploy staging, nên lần kiểm thử này dùng bản production chạy local, nối với Supabase và Gemini thật. Kết quả về chức năng tương đương staging. Thời gian trên Vercel có thể khác vì có thêm độ trễ mạng và cold start của hàm serverless, nên cần đo lại sau khi deploy. Các bước chỉ nhìn thấy được trên giao diện (thông báo, thanh tiến độ, nội dung còn trong ô trả lời) chưa được bấm thử trong trình duyệt.

## 2. Môi trường

| Mục | Giá trị |
| --- | --- |
| App | `next build` + `next start`, `http://localhost:3000`, `main` @ `0668228` cùng bản sửa của PR #25 |
| Database | Supabase dùng chung; đủ 5 migration, RLS bật trên cả 9 bảng (kiểm tra ngày 13/11) |
| AI | `gemini-3.5-flash-lite` (cấu hình của nhóm trong `.env.example`), trả câu hỏi dạng stream (SSE) |
| Tài khoản | Hai tài khoản seed A và B (đã xác nhận email) |
| Cách chạy | Gọi qua đúng các API mà trang web gọi, kèm token đăng nhập của user. Các lượt AI cách nhau ít nhất 8 giây, không tự động thử lại. |
| Thời gian | 15:50–15:54 ngày 13/11/2026 (giờ Việt Nam) |

## 3. Kết quả từng việc

### 3.1 SCRUM-107 – test case được giao

| Case | Kết quả chính | Status |
| --- | --- | --- |
| UC02-03 – Tách dữ liệu giữa hai user | B mở URL phiên của A → 404 `NOT_FOUND`. Danh sách phiên và phân tích của B có 0 dòng của A. Chưa đăng nhập → 401. | Pass |
| UC06-02 – Follow-up và giới hạn | Mức Medium, tiếng Việt: trả lời "Có." → follow-up cùng chủ đề; nhắc thuật ngữ mà không giải thích → follow-up sâu hơn, câu khác. Đủ 2 follow-up → sang câu chính mới; trả lời "Em không biết." → đổi chủ đề. | Pass |
| UC06-04 – Hết giờ | Lùi `started_at` 16 phút. Câu trả lời gửi sau đó vẫn được lưu; lượt tiếp theo trả `end` mà không gọi Gemini. Phiên chuyển `completed`. Tải lại trang vẫn giữ nguyên `startedAt`. | Pass |
| UC06-06 – Mở lại phiên, gửi lại khi mất kết nối | Mở lại thấy đúng câu cũ, không tốn lượt AI. Gửi lại cùng nội dung → chỉ lưu 1 lần, không gọi AI thêm. User B bị 404. Bước 2 N/A. | Pass |

Diễn biến UC06-02 (chủ đề, hành động):

| Lượt | Hành động | Chủ đề |
| --- | --- | --- |
| 1 | `next_topic` (câu chính) | React Performance |
| 2 | `follow_up` | React Performance |
| 3 | `follow_up` | React Performance |
| 4 | `next_topic` (đã đủ 2 follow-up) | API Handling |
| 5 | `next_topic` | API Error Handling |

### 3.2 SCRUM-108 – Luồng đầy đủ

| Bước | Lần 1 | Lần 2 |
| --- | --- | --- |
| Đăng nhập (email/password) | Đạt | Đạt |
| Phân tích CV/JD → điểm phù hợp | Đạt (lỗi Gemini quá tải một lần, thử lại thì được) | Đạt |
| Lưu phân tích như trang Analysis | Đạt | Đạt |
| Setup tạo phiên, tự liên kết phân tích mới nhất | Đạt | Đạt |
| Phỏng vấn đến khi engine kết thúc | **Không đạt**: lượt 4 trả `INVALID_OUTPUT` 3/3 lần | Đạt: 5 câu chính rồi `end`, phiên chuyển `completed` |
| Dữ liệu Dashboard có phiên vừa xong | – | Đạt |

### 3.3 SCRUM-109 – Tốc độ câu hỏi tiếp theo (20 lượt sinh mới)

"Hoàn tất" là thời gian từ lúc gửi `POST /api/interview/next` đến khi nhận event `complete`: câu hỏi đã được kiểm tra hợp lệ và đã lưu vào database. "Chữ đầu" là thời gian đến event `delta` đầu tiên.

| Chỉ số | Kết quả | Mốc |
| --- | --- | --- |
| Hoàn tất hợp lệ và lưu ≤ 5 s | **19/20 (95%)** | ≥ 95% → **đạt** |
| Hoàn tất p50 / p95 | 2,91 s / 4,13 s | – |
| Chữ đầu p50 / p95 | 2,48 s / 3,18 s | – |
| Chữ đầu ≤ 2 s | 0/20 | Chỉ là mốc làm việc tham khảo của SCRUM-94, không phải tiêu chí của SCRUM-109 |
| Lỗi | 1 `AI_UNAVAILABLE` (Gemini báo 503 "high demand") | Tính là lượt không đạt, không thay bằng lượt khác |

Mẫu gồm cả câu mở đầu và câu hỏi tiếp theo; tiếng Việt và tiếng Anh; ba mức Easy, Medium, Hard; ba loại Technical, Behavioral, HR. Thời gian từng lượt có trong file JSON.

## 4. Lỗi tìm thấy

| # | Lỗi | Mức độ | Xử lý |
| --- | --- | --- | --- |
| B1 | Câu trả lời đã lưu nhưng phản hồi bị mất; người dùng sửa nội dung rồi gửi lại → API vẫn trả 200 và giữ bản cũ. Trang Chat hiện bản mới, còn database và AI dùng bản cũ. | Cao | **Đã sửa** ở PR #25: gửi lại với nội dung khác → `409 ANSWER_CONFLICT`, trang tải lại phiên. |
| B2 | Lưu câu trả lời gặp `STALE_TURN` hoặc `SESSION_CLOSED` (ví dụ hết giờ khi đang gõ) → trang Chat hiện "Thử lại" mãi mà không thể thành công. | Trung bình | **Đã sửa** ở PR #25: trang tự tải lại phiên, xóa bản nháp cũ và báo lý do. |
| B3 | Với JD ngắn, engine xoay quanh 2 chủ đề và hỏi lại gần như cùng một câu (câu 1, 3, 5 cùng hỏi khai báo kiểu props; câu 2, 4 cùng hỏi xử lý merge conflict). Engine chỉ chặn câu trùng **nguyên văn**, nên có lúc Gemini sinh đúng một câu đã hỏi và lượt đó bị từ chối liên tục; người dùng bấm "Thử lại" cũng không qua được (lần 1, lượt 4). | Cao | **Giao Hưng** (engine `/next`). Gợi ý: cho model biết danh sách câu đã hỏi, tránh chủ đề đã dùng khi JD còn chủ đề khác, ghi lý do `INVALID_OUTPUT` vào log timing. |
| B4 | `.env.local` trên máy Nhân dùng `gemini-3.1-flash-lite`: `/next` timeout sau 30 s. Model của nhóm (`gemini-3.5-flash-lite`) chạy bình thường. | Thấp (cấu hình) | Khi deploy, đặt `GEMINI_MODEL=gemini-3.5-flash-lite` như `.env.example`. |
| B5 | Các route `/api/settings*` trả lỗi dạng `{ error: { message } }`, không có `code` như các API khác. | Thấp | Ghi vào bảng API (PR #24). Sửa sau Build 1 nếu cần. |
| B6 | File test case có hai phần "Function 06" trùng nhau (dòng 23–33 và 34–43) với mã và người test khác nhau. | Thấp (tài liệu) | Báo Nguyên đánh số lại. Lần này điền theo 4 dòng trong Jira (9, 25, 27, 29). |
| B7 | Kết quả nằm rải rác ở ba file (file chính, bản của Hưng, bản của Khang); bản của Hưng không mở được bằng Excel. | Thấp (tài liệu) | **14/11:** gộp hết vào `InterviewBuddy_Test_Cases_Build1_v1.0.xlsx` = bản trên Drive (Hưng test lại 13/11 + Nhân) + 5 dòng của Khang (Pass theo PR #34, Khang chưa điền cột Status/ngày). Đã bỏ hai bản sao. |

Gemini có lúc trả `503 UNAVAILABLE – high demand` trong buổi chiều 13/11. App đã chuyển lỗi này thành `AI_UNAVAILABLE` hoặc thông báo phân tích thất bại kèm nút thử lại, đúng như thiết kế.

## 5. Dữ liệu và hạn mức

- Tất cả phiên test do lần chạy này tạo ra đã được xóa; dữ liệu seed giữ nguyên.
- Tài khoản A đã dùng khoảng 38/100 lượt AI hôm nay. B không dùng lượt nào.
- Chưa chạy lại trên staging; cần làm khi Nguyên deploy xong (SCRUM-108, SCRUM-109).
