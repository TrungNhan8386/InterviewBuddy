# SCRUM-96: Kiểm thử trang chat phỏng vấn `/interview/[id]`

Người làm: Khang · Ngày test: 05/11/2026 · Môi trường: localhost (`npm run dev`), Supabase chung, Gemini `gemini-3.1-flash-lite`
Nhánh: `feat/interview-chat-khang` · API `/api/interview/next`: `main` sau PR #17, #18 (`366cbd3`)

Mục đích: gửi 10 câu trả lời mẫu cho mỗi ngôn ngữ, ghi lại hành vi của trang chat và của AI.
Không dùng CV hay dữ liệu thật của ai. Không chụp khóa API hay email người khác.

## Cách chạy

1. Tạo 1 session **tiếng Việt** (technical, medium, 30 phút) và 1 session **tiếng Anh** (behavioral, medium, 30 phút).
2. Mở `/interview/<sessionId>`, trả lời lần lượt các câu dưới đây (dán nguyên văn).
3. Ghi vào bảng: hành động AI trả về (đào sâu / chủ đề mới / kết thúc), thời gian chờ (giây, đo bằng F12 → Network → `next` → Time), lỗi nếu có.

Kỳ vọng chung: câu trả lời mơ hồ → thường có "Câu hỏi đào sâu"; câu trả lời đầy đủ hoặc "bỏ qua" → chủ đề mới; không lặp câu hỏi; tải lại trang (F5) giữa chừng vẫn ở đúng câu.

## Tiếng Việt

| # | Loại | Câu trả lời mẫu | AI làm gì | Thời gian (s) | Đạt? | Ghi chú |
|---|---|---|---|---|---|---|
| 1 | Đầy đủ | Em là sinh viên năm 3 ngành Kỹ thuật phần mềm. Trong đồ án gần nhất em làm frontend bằng React và TypeScript, phụ trách trang phân tích CV, xử lý tải PDF và hiển thị kết quả. Em ứng tuyển vì muốn làm sản phẩm thật có người dùng. | | | | |
| 2 | Mơ hồ | Em biết React khá tốt. | | | | |
| 3 | Đầy đủ | Em dùng useState cho state đơn giản như mở hoặc đóng menu. Khi một form có nhiều trường và nhiều hành động thay đổi chúng, em chuyển sang useReducer để gom logic vào một chỗ và dễ test hơn. | | | | |
| 4 | Lạc đề | Hôm nay trời mưa nên em đến muộn một chút. | | | | |
| 5 | Từ chối | Em chưa làm phần này, mình chuyển câu khác được không ạ? | | | | |
| 6 | Đầy đủ (STAR) | Trong đồ án, bạn cùng nhóm muốn dùng Redux còn em nghĩ chưa cần. Em đề xuất làm thử một trang bằng state cục bộ trong 1 ngày rồi so sánh. Kết quả code ngắn hơn 30% nên nhóm thống nhất chưa dùng Redux. | | | | |
| 7 | Rất ngắn | Dạ có. | | | | |
| 8 | Có chi tiết hay | Em từng giảm thời gian tải trang từ 6 giây xuống 2 giây bằng cách lazy-load ảnh và tách bundle. | | | | |
| 9 | Dài, nhiều đoạn | (Dán 3 đoạn, khoảng 250 chữ, kể một dự án) | | | | |
| 10 | Ký tự đặc biệt | Em dùng `fetch()` với `AbortController`; nếu lỗi 4xx thì <hiện thông báo>, còn 5xx thì thử lại. | | | | |

## English

| # | Type | Sample answer | AI action | Time (s) | Pass? | Notes |
|---|---|---|---|---|---|---|
| 1 | Complete | I am a third-year software engineering student. In my latest project I built the React front end for a CV analysis page, handling PDF upload and showing results. I applied because I want to work on a real product with users. | | | | |
| 2 | Vague | I am good at teamwork. | | | | |
| 3 | Complete (STAR) | Our team missed a sprint goal because tasks were unclear. I proposed writing acceptance criteria for each task on Monday. In the next sprint we finished all tasks and the reviewer had fewer questions. | | | | |
| 4 | Off-topic | My favourite food is pho. | | | | |
| 5 | Refusal | I don't have experience with that, can we move on? | | | | |
| 6 | Interesting detail | I once had to calm down an angry client during a live demo when the server crashed. | | | | |
| 7 | Very short | Yes. | | | | |
| 8 | Complete | When two teammates disagreed about the database design, I set up a 15-minute call, listed the pros and cons of both options, and we picked one based on the queries we needed most. | | | | |
| 9 | Long | (Paste 3 paragraphs, about 250 words, about a project) | | | | |
| 10 | Special characters | I'd use `try/catch` around `await fetch()`, and show "<Retry>" when status >= 500. | | | | |

## Ca kiểm tra giao diện

| Ca | Cách làm | Kỳ vọng | Đạt? |
|---|---|---|---|
| Tải lại giữa chừng | F5 khi đang chờ trả lời câu 2 | Vẫn thấy các câu và câu trả lời cũ, ô trả lời mở | Đạt (05/11) |
| Mất mạng khi gửi | F12 → Network → Offline → Gửi | Khung đỏ, nội dung vẫn còn trong ô, bấm Thử lại sau khi bật mạng thì gửi được | Đạt (05/11) |
| Kết thúc sớm | Bấm Kết thúc phỏng vấn → Tiếp tục, rồi bấm lại → Kết thúc | Lần 1 không kết thúc; lần 2 hiện "đã kết thúc", F5 vẫn là đã kết thúc | Đạt (05/11) |
| Session của người khác | Đăng nhập user B, mở id session của user A | "Không tìm thấy buổi phỏng vấn…" | |
| 360 px | F12 → điện thoại → width 360 | Không có thanh cuộn ngang, nút bấm được | |
| Console | F12 → Console | Không có lỗi đỏ | |
| AI chậm | Lượt đầu tiên của session thật | Quá 30 s thì hiện "AI phản hồi quá lâu" + Thử lại; Thử lại thành công | Đạt (05/11): 1 lần `AI_TIMEOUT` (> 30 s), các lượt khác khoảng 2–3 s |

## Kết luận

- Số ca đạt: __ / 26
- Lỗi đã báo (mã Jira): ____
- Ghi nhận 05/11: thời gian trả câu hỏi thường 2–3 s; có 1 lần Gemini quá 30 s (`AI_TIMEOUT`). Báo Hưng (SCRUM-94) để theo dõi.
