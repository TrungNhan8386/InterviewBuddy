# AI interviewer — findings kiểm thử ba JD

| Ngày | Phiên bản | Phụ trách | Review |
| --- | --- | --- | --- |
| 31/10/2026 | 1.0 | Lâm Gia Hưng | Chờ Nhân review; nhận xét nội dung hiện do AI hỗ trợ |

Chúng tôi kiểm thử prompt 0.2, contract 0.1 bằng Gemini `gemini-3.5-flash-lite` trên ba JD giả lập: Frontend tiếng Việt, Backend tiếng Anh và Software Engineer Intern vòng behavioral tiếng Việt. Mỗi JD có câu trả lời tốt, mơ hồ và lạc đề; chín tình huống được thử hai lần với cùng đầu vào.

Chúng tôi thu đủ 18 đầu ra hợp lệ sau 19 request: một request lỗi 429 và một ca bị dừng đã được chạy bổ sung sau khoảng nghỉ, giữ nguyên bằng chứng ban đầu. Hành động thuộc kỳ vọng fixture ở cả 18 kết quả; câu tốt chuyển chủ đề, câu mơ hồ được hỏi sâu. Có 7/9 cặp giữ cùng hành động; hai cặp lạc đề thay đổi giữa hỏi lại và chuyển chủ đề. Thời gian request thành công là 1.001–2.616 ms, trung vị 1.597,5 ms, chưa gồm giao diện hoặc âm thanh.

Tự kiểm tra nội dung bằng AI ghi nhận đúng ngôn ngữ cấu hình, nhưng câu hỏi mới đôi lúc hỏi lại phần loading/error hoặc idempotency đã xuất hiện trong câu trả lời. Một số câu hỏi sâu còn dẫn hướng hoặc chỉ hỏi có/không. Vì vậy JSON hợp lệ và action đúng kỳ vọng chưa chứng minh chất lượng chuyên môn. Bộ thử đã được dùng phát triển prompt, quy mô nhỏ và chưa phải hội thoại nhiều lượt; chúng tôi chưa kết luận độ chính xác tổng quát. Báo cáo đã sẵn sàng để Nhân review, tập trung vào quy tắc xử lý lạc đề và tránh hỏi lại ý đã trả lời.

Bằng chứng: [phụ lục kết quả](ai-interviewer-evaluation-results.md), [quy trình kiểm thử](../test/AI_INTERVIEWER_EVALUATION.md), [JSON tổng hợp có liên kết nguồn](../test/results/SCRUM-68-evaluation-summary.json).

| Ngày | Phiên bản | Thay đổi |
| --- | --- | --- |
| 31/10/2026 | 1.0 | Hoàn thành thử ba JD và findings; chờ review của Nhân |
