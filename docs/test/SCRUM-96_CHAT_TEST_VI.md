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
| 1 | Đầy đủ | Em là sinh viên năm 3 ngành Kỹ thuật phần mềm. Trong đồ án gần nhất em làm frontend bằng React và TypeScript, phụ trách trang phân tích CV, xử lý tải PDF và hiển thị kết quả. Em ứng tuyển vì muốn làm sản phẩm thật có người dùng. | Câu trả lời giới thiệu bản thân không khớp câu hỏi (tối ưu danh sách lớn) → AI hỏi đào sâu cùng chủ đề (có nhãn), kéo lại về hiệu năng | 2–3 | Đạt |  |
| 2 | Mơ hồ | Em biết React khá tốt. | Hỏi tiếp cùng chủ đề Responsive Design (xin ví dụ cụ thể) nhưng **không có nhãn "Câu hỏi đào sâu"** (AI trả về `next_topic` thay vì `follow_up`) | 2–3 | Một phần | Báo Hưng: câu mơ hồ nên là follow_up |
| 3 | Đầy đủ | Em dùng useState cho state đơn giản như mở hoặc đóng menu. Khi một form có nhiều trường và nhiều hành động thay đổi chúng, em chuyển sang useReducer để gom logic vào một chỗ và dễ test hơn. | AI chuyển sang chủ đề mới "Quản lý State trong React", câu hỏi bám vào chính câu trả lời (useState vs useReducer) | 2–3 | Đạt | Dấu backtick trong câu hỏi hiện nguyên dạng chữ (không render markdown), chấp nhận được |
| 4 | Lạc đề | Hôm nay trời mưa nên em đến muộn một chút. | Chuyển chủ đề mới (Responsive Design), không bình luận về câu lạc đề | 2–3 | Đạt |  |
| 5 | Từ chối | Em chưa làm phần này, mình chuyển câu khác được không ạ? | Buổi phỏng vấn kết thúc (đủ số câu chính của session 15 phút = 5 câu) | 2–3 | Chưa kết luận | Hết ngân sách câu hỏi trước khi kiểm tra được hành vi khi từ chối; test lại ở session 45 phút |
| 6 | Đầy đủ (STAR) | Trong đồ án, bạn cùng nhóm muốn dùng Redux còn em nghĩ chưa cần. Em đề xuất làm thử một trang bằng state cục bộ trong 1 ngày rồi so sánh. Kết quả code ngắn hơn 30% nên nhóm thống nhất chưa dùng Redux. | Trả lời câu hỏi REST API bằng câu chuyện Redux (không khớp câu hỏi); AI chuyển sang chủ đề mới TypeScript | 2–3 | Đạt | AI không chỉ ra câu trả lời lệch câu hỏi |
| 7 | Rất ngắn | Dạ có. | Lại hỏi cùng chủ đề Responsive Design, cụ thể hơn (Tailwind, breakpoint), **không có nhãn đào sâu** | 2–3 | Một phần | Cùng chủ đề hỏi 3 lần dưới dạng câu chính |
| 8 | Có chi tiết hay | Em từng giảm thời gian tải trang từ 6 giây xuống 2 giây bằng cách lazy-load ảnh và tách bundle. | AI chuyển chủ đề mới (Làm việc nhóm với Git), **không hỏi đào sâu** chi tiết 6 s → 2 s | 2–3 | Một phần | Lúc test lỡ dán kèm chữ "Có chi tiết hay \|"; chi tiết đáng hỏi nhưng AI bỏ qua |
| 9 | Dài, nhiều đoạn | Dự án gần nhất của em là web quản lý thư viện cho câu lạc bộ sách của khoa, nhóm 4 người làm trong 8 tuần. Em phụ trách phần frontend bằng React và TypeScript, gồm trang danh sách sách, trang chi tiết và form mượn sách. Lúc đầu nhóm chưa thống nhất cách gọi API nên mỗi trang viết fetch một kiểu, lỗi hiển thị rất khó đoán.<br><br>Em đề xuất gom việc gọi API vào một file client chung, có kiểu dữ liệu TypeScript cho từng response, và một hook useBooks trả về data, loading, error. Khi loading em hiện skeleton, khi lỗi hiện thông báo và nút Thử lại, khi danh sách rỗng thì hiện hướng dẫn thêm sách. Em cũng thêm debounce 300 ms cho ô tìm kiếm và dùng AbortController để hủy request cũ khi người dùng gõ tiếp.<br><br>Kết quả là số lỗi giao diện báo trong buổi demo giảm từ 7 xuống 2, thời gian hiển thị kết quả tìm kiếm còn khoảng 0,5 giây. Bài học lớn nhất của em là nên thống nhất quy ước từ tuần đầu và viết lại tài liệu ngắn cho cả nhóm. Nếu làm lại, em sẽ viết unit test cho hook useBooks sớm hơn, vì lúc đó em chưa có kinh nghiệm test nên phải kiểm tra thủ công khá lâu. | Bong bóng giữ đúng 3 đoạn, có dòng trống, không tràn khung; lưu và gửi bình thường | 2–3 | Đạt (giao diện) | Phản ứng của AI sau câu này: ____ |
| 10 | Ký tự đặc biệt | Em dùng `fetch()` với `AbortController`; nếu lỗi 4xx thì <hiện thông báo>, còn 5xx thì thử lại. | Ký tự đặc biệt hiện đúng dạng chữ (backtick, `<hiện thông báo>` không bị hiểu là HTML); AI hỏi đào sâu về AbortController (có nhãn) | 2–3 | Đạt |  |

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
| 9 | Long | My latest project was a library management web app for our faculty's book club, built by a team of four over eight weeks. I owned the React and TypeScript front end: the book list, the book detail page and the borrowing form. At first every page called the API in its own way, so error handling was inconsistent and hard to predict.<br><br>I proposed one shared API client with TypeScript types for each response and a useBooks hook that returns data, loading and error. While loading, the page shows a skeleton; on error it shows a message with a Retry button; when the list is empty it explains how to add a book. I also added a 300 ms debounce to the search box and used AbortController to cancel old requests while the user keeps typing.<br><br>As a result, UI bugs reported at the demo dropped from seven to two, and search results appeared in about half a second. My main lesson was to agree on conventions in the first week and write a short guide for the team. If I did it again, I would write unit tests for the useBooks hook earlier, because I had no testing experience then and spent a long time checking things by hand. | | | | |
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
