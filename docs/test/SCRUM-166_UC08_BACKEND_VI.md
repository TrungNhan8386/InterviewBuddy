# Kết quả triển khai và kiểm tra backend UC 08

Ngày thực hiện: 22/11/2026. Phạm vi Jira đã đọc trực tiếp: SCRUM-166 Scoring and Feedback Backend, gồm SCRUM-167–171; cả năm task con được giao cho Lâm Gia Hưng và không có mô tả bổ sung ngoài tiêu đề. Hạn ghi trên Jira đã qua; báo cáo ghi ngày thực tế, không ghi lùi ngày.

Đã chạy `git fetch origin --prune` và tạo worktree riêng từ `origin/main` tại `2947292b22632d44c54a83f1ee03019ab6da9d9d`. Không gộp các nhánh chưa merge; không sửa hoặc stash công việc đang có trong các checkout khác. Nhánh bàn giao: `feat/scrum-166-answer-feedback-hung`.

## Kết quả theo task

| Task | Nội dung đã đưa vào thay đổi | Ranh giới bàn giao |
| --- | --- | --- |
| SCRUM-167 | Bản Use-case Specification v1.4 DRAFT cập nhật riêng UC-08; giữ v1.3; bổ sung review record. | Chờ nhóm review và chọn làm baseline. Không giả lập phê duyệt. |
| SCRUM-168 | API contract, JSON request/response behavioral và technical, TypeScript types, file HTTP cho VS Code, hướng dẫn Chat → Feedback → Continue. | Các mẫu được bàn giao trong PR; chưa gửi tin nhắn riêng cho Khang. |
| SCRUM-169 | Rubric cấu hình có version, thang 0–10, trọng số bằng nhau, STAR chỉ behavioral, Confidence ghi rõ ước lượng từ văn bản; điểm tổng do server tính. | Trọng số và làm tròn là mặc định triển khai để review, chưa có biên bản chốt của nhóm. |
| SCRUM-170 | Prompt tiếng Việt/Anh, JSON Schema, kiểm tra score/field/quotation, một retry cho output sai hoặc lỗi tạm thời trong cùng budget, quota mỗi attempt, thông báo lỗi và timing an toàn. | Chất lượng ngữ nghĩa, độ ổn định và an toàn đầy đủ vẫn cần bộ nghiệm thu NFR. |
| SCRUM-171 | API POST/GET, lưu feedback theo answer; migration và RPC claim/read/finish/release, RLS ownership, nullable STAR, replay và bảo vệ reservation hết hạn. | Đã chạy SQL trên PostgreSQL cục bộ PGlite; chưa áp migration lên Supabase dùng chung. |

Mã hiện tại của Chat trên main vẫn xin câu tiếp theo ngay sau khi lưu answer. PR này làm backend của Hưng và tài liệu kết nối; không tự nhận đã hoàn tất phần Feedback UI của Khang. Hướng dẫn tích hợp yêu cầu dừng ở feedback và chỉ xin câu tiếp theo sau khi người dùng bấm Continue, hoặc chọn tiếp tục không có feedback khi lỗi.

## Kiểm tra tự động

| Kiểm tra | Kết quả thực tế |
| --- | --- |
| TDD cho contract, provider/service, HTTP, SQL | Đã thấy test thất bại khi tính năng/migration chưa có, sau đó chạy đạt. Các ca sửa phát sinh có RED/GREEN riêng cho reservation hết hạn và đọc lại feedback khi cấu hình AI lỗi. |
| `npm test` | **312/312 đạt**, không skip. Gồm 18 test mới cho UC-08. |
| `npm run lint` | Đạt. |
| `npm run typecheck` | Đạt. |
| `npm run build` | Đạt, có route `/api/evaluate-answer`. Có cảnh báo Next.js 16.4.2 hiện tại có lỗ hổng đã biết; chưa nâng cấp trong phạm vi này. |
| `npm run verify:secrets` | Không phát hiện credential; `.env.local` bị ignore và không được track. |
| JSON mẫu và link tài liệu mới | Đọc được các file liên kết; điểm mẫu behavioral 6.5, technical 6.7. |

Lần chạy suite trong sandbox ban đầu có hai lỗi `EACCES` tại test HTTP localhost cũ: `Khang endpoint works through the standalone HTTP server` và `standalone server and browser client work over actual local HTTP`. Chạy lại với quyền localhost phù hợp thì toàn bộ suite đạt; không đổi code để bỏ hai test. Suite còn cảnh báo Node `MODULE_TYPELESS_PACKAGE_JSON` từ file `interview-chat/text.ts` có sẵn.

Build đầu thiếu biến Supabase; cấu hình công khai cục bộ đã được bổ sung từ tệp riêng có sẵn và không in giá trị. Một lần build bị quyền tạo junction của Windows chặn, một lần bị lời nhắc phiên bản Next.js dừng; lần build cuối chạy với quyền phù hợp đã exit 0. Không nâng cấp framework ngoài phạm vi task.

Các kiểm tra SQL thực thi migration/RPC thật trong PGlite: lưu đúng score/quote, STAR technical là NULL, replay đúng cùng ID, reservation đang chạy không claim trùng, token cũ hoặc hết hạn không lưu được, người khác không đọc/claim/finish được, RLS che feedback của người khác, release không xóa answer, và xóa session cascade reservation. Đây không phải bằng chứng đã áp migration trên Supabase dùng chung.

## Gemini thật và lưu PostgreSQL cục bộ

Chạy `verify-feedback.mjs --live` với sáu câu trả lời tổng hợp, model `gemini-3.5-flash-lite`. Không dùng CV, email, mật khẩu hoặc hồ sơ cá nhân. Provider, validation, quota RPC và lưu/đọc/replay đều chạy; PostgreSQL là PGlite, phần Supabase HTTP/Auth và Chat UI không nằm trong lần chạy này.

| Ca | Độ dài answer | Kết quả | Thời gian toàn ca | Ghi nhận |
| --- | ---: | --- | ---: | --- |
| EN behavioral | 100 ký tự | Đạt | 5.764 ms | Lần đầu `AI_UNAVAILABLE`; lần hai thành công trong cùng budget. |
| VI “Dạ có.” | 6 ký tự | Đạt | 2.899 ms | Feedback ghi thiếu thông tin và dùng đúng lời gốc; không bịa kinh nghiệm. |
| EN technical “yes” | 3 ký tự | Đạt | 2.045 ms | STAR N/A; phản hồi về việc thiếu giải thích cụ thể. |
| VI HR | 152 ký tự | Đạt | 2.252 ms | STAR N/A; nhận xét tiếng Việt. |
| EN answer dài | 11.750 ký tự | Đạt | 3.613 ms | Nội dung lặp được chấm là thiếu triển khai chi tiết, không lỗi kích thước. |
| EN prompt injection/refusal | 108 ký tự | Đạt | 2.049 ms | Không làm theo yêu cầu tự nâng điểm hay tiết lộ khóa; điểm tổng 0. |

Mọi ca thành công đều đọc lại từ DB và POST replay ra cùng feedback ID. Một lỗi dịch vụ được giữ trong bằng chứng; không bỏ lượt lỗi để làm đẹp số liệu. Chi tiết output và trace an toàn: [kết quả Gemini và PostgreSQL cục bộ](results/scrum166/live-gemini-local-postgres.json).

Khoảng 2–5,8 giây chỉ mô tả sáu ca smoke này. Không coi đó là p95 staging, kiểm chứng rubric ổn định hoặc đánh giá độc lập của con người. Hai ngôn ngữ đã được kiểm tra thủ công trên các output smoke; không có bộ phát hiện ngôn ngữ hoặc bộ đánh giá ngữ nghĩa đầy đủ trong validator.

## Kiểm tra tài liệu Word

Đã dùng skill documents với Python đi kèm runtime và `render_docx.py`; LibreOffice 26.8.3.1 được tải từ nguồn chính thức, kiểm SHA256 và giải nén riêng trong thư mục tạm ngoài Git. Không đưa bộ kết xuất, PDF hay PNG QA vào PR.

Bản draft có **35 trang**, đã xem từng trang PNG. Không thấy mất chữ, chồng chữ hoặc tràn viền. Giữ bảng, highlight và cách nối bảng nhiều trang của mẫu. Đã sửa header/version/date, thêm một dòng revision history, kiểm mục lục với đủ 17 heading thực tế; UC-08 ở trang 20–22. Nội dung các UC khác được giữ nguyên; các trang ngắn và ngắt dòng của mẫu không được thiết kế lại trong task này.

So sánh toàn bộ paragraph gốc xác nhận chỉ UC-08, version và cache số trang mục lục thay đổi, cộng một dòng lịch sử. SHA256 v1.3 vẫn là `948b84a469a761292b85a5caee1ab50eb676df64062ce7ff7f401f3a16b06428`; SHA256 bản draft là `8336921166003601022781d967fb93c150007f0d429890d05dbafd67ddf30aef`.

## Điều kiện tích hợp và nghiệm thu còn lại

1. Review rồi áp `20261122000000_answer_feedback.sql` lên Supabase của môi trường thử; chưa thay đổi database dùng chung trong lần thực hiện này.
2. Khang nối các trạng thái waiting/feedback/error/Continue và đường resume theo [API contract](../api/ANSWER_FEEDBACK_API_v1.md). Bản hiện tại chưa thay giao diện Chat.
3. Nhan dùng score/quote đã lưu cho Report; không tính feedback thiếu thành 0, không đưa STAR N/A vào trung bình.
4. Nhóm review bản UC-08 draft và chính sách chấm điểm/retry; sau khi chốt mới thay baseline requirements.
5. Chạy nghiệm thu NFR trên staging: 20 request để đo p95; 10 answer × 3 lần để đo ổn định; 20 feedback với hai người review độc lập; 30 ca an toàn. Không đánh dấu các bước này đã đạt từ smoke test.

Các kỹ năng đã áp dụng: Gemini API Development, Test Driven Development, Systematic Debugging, Supabase Postgres Best Practices, Verification Before Completion, Documents; tài liệu Markdown giữ theo cấu trúc repo. Không ghi nhận người review hoặc phê duyệt khi chưa xảy ra.
