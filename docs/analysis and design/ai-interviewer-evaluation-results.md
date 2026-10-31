# Phụ lục kết quả kiểm thử AI interviewer

Ngày: 31/10/2026. Task: SCRUM-68. Prompt: 0.2. Contract: 0.1. Model: `gemini-3.5-flash-lite`.

Jira được đọc trực tiếp ngày 31/10: yêu cầu thử prompt trên ba JD mẫu Việt/Anh và viết khoảng nửa trang findings. Hướng dẫn tuần 4 mục 2.5 bổ sung ba loại câu trả lời và yêu cầu Nhân review. Phạm vi thực hiện là kiểm thử module độc lập; không có kết quả thử endpoint chat, giao diện hay phiên phỏng vấn thật.

## 1. Bằng chứng

| Hồ sơ | Vai trò |
| --- | --- |
| [Báo cáo ma trận gốc](../test/results/SCRUM-68-evaluation-live-2026-10-31T01-52-09-037Z.json) | 16 đầu ra hợp lệ, một lỗi AI_RATE_LIMITED, một ca skipped; có input đầy đủ và hash nguồn |
| [Bổ sung behavioral mơ hồ](../test/results/ai-interviewer-spike-behavioral-vi-vague-v0.2.json) | Thử lại ca lỗi ở lượt 2 bằng công cụ spike, cùng prompt/model/context |
| [Bổ sung behavioral lạc đề](../test/results/ai-interviewer-spike-behavioral-vi-off_topic-v0.2.json) | Chạy ca bị skipped ở lượt 2 |
| [Bản tổng hợp](../test/results/SCRUM-68-evaluation-summary.json) | Ghép bằng chứng, xác minh SHA-256, đủ hai kết quả cho từng fixture |
| [Quy trình và cách tái lập](../test/AI_INTERVIEWER_EVALUATION.md) | Dataset, kỳ vọng, tiêu chí kỹ thuật và tiêu chí đọc nội dung |
| [Kiểm thử hồi quy](../test/results/SCRUM-68-regression.tap) và [hồ sơ xác minh](../test/results/SCRUM-68-verification.json) | 116/116 test đạt; kiểm tra ESLint, liên kết và khóa API trong file bàn giao |

Hai hồ sơ bổ sung mang nhãn `task: SCRUM-67` do dùng nguyên công cụ spike của task trước; chúng được dùng làm bằng chứng chạy bổ sung cho SCRUM-68, không đổi nhãn hoặc sửa nội dung gốc. Script tổng hợp kiểm tra cùng model, prompt, contract, hash request và nguồn hiện tại, rồi gắn chúng vào đúng hai ô còn thiếu của lượt 2. Bản ma trận gốc vẫn có trạng thái `incomplete`; bản tổng hợp ghi rõ hoàn thành sau khắc phục lỗi giới hạn.

## 2. Kết quả kỹ thuật

| Chỉ số | Kết quả | Cách diễn giải |
| --- | --- | --- |
| JD / tình huống / lần lặp | 3 / 9 / 2 | Hai JD tiếng Việt, một JD tiếng Anh; technical và behavioral |
| Request Gemini | 19 | 17 ở ma trận gốc, 2 lượt bổ sung |
| Kết quả đã lên kế hoạch | 18/18 có đầu ra hợp lệ sau bổ sung | Không tính request 429 là thành công |
| Kết quả ngay ma trận gốc | 16 hợp lệ, 1 lỗi, 1 skipped | Không gọi 18/18 là tỷ lệ thành công lần đầu |
| Action thuộc kỳ vọng fixture | 18/18 | Nhãn thử nghiệm; lạc đề chấp nhận hai action nên chỉ số này chưa đo độ sâu |
| Câu tốt / mơ hồ | 6/6 next_topic; 6/6 follow_up | Đây là hành vi quan sát được trên bộ dữ liệu này |
| Lạc đề | 4 follow_up, 2 next_topic | Cả hai hợp lệ theo prompt 0.2; chính sách chưa quyết định duy nhất |
| Cặp có action giống nhau | 7/9 | Hai cặp khác action đều là lạc đề; không yêu cầu câu chữ giống hệt |
| Thời gian request thành công | Min 1.001; median 1.597,5; max 2.616 ms | Không bao gồm request lỗi, thời gian nghỉ hoặc luồng giao diện/âm thanh |

Không xác định được 429 là RPM, TPM hay RPD từ mã lỗi an toàn mà provider trả ra. Hai request bổ sung thành công sau khoảng nghỉ cho thấy dịch vụ đã nhận lại request trong lần thử này; không đủ căn cứ suy ra con số quota hoặc billing tier của project. Runner không retry ngầm.

## 3. Kết quả theo từng tình huống

Quy ước: **N** = `next_topic`, **F** = `follow_up`. Lượt 2 của hai dòng behavioral cuối sử dụng bằng chứng bổ sung. Nhận xét là **tự đánh giá nội dung bằng AI**, không phải đánh giá đã được Nhân xác nhận.

| Fixture | Lượt 1 | Lượt 2 | Nhận xét dựa vào input/output |
| --- | --- | --- | --- |
| frontend-vi-good | N | N | Lượt 1 quay lại loading/error dù answer đã nêu trạng thái này; lượt 2 hỏi kiểm thử lỗi HTTP 500 cụ thể hơn |
| frontend-vi-vague | F | F | Bám useEffect và request đồng thời; lượt 2 hỏi có hủy request không nên còn dẫn hướng, chưa yêu cầu giải thích cách làm |
| frontend-vi-off_topic | N | F | Lượt 1 chuyển sang loading/error; lượt 2 kéo về câu hỏi đổi bộ lọc; hai cách đều đúng policy nhưng chưa thống nhất cách xử lý lạc đề |
| backend-en-good | N | N | Lượt 1 hỏi dọn database khi integration test, là góc mới; lượt 2 quay lại idempotency, trong khi answer đã nêu unique idempotency key |
| backend-en-vague | F | F | Cả hai yêu cầu cơ chế đồng thời cụ thể; cách nêu isolation level/locking có thể khiến người trả lời nghĩ chỉ có hai nhóm giải pháp đó |
| backend-en-off_topic | F | N | Lượt 1 nhắc quay lại tồn kho/transaction; lượt 2 hỏi idempotency; khác action nhưng cùng bám JD |
| behavioral-vi-good | N | N | Chuyển sang xử lý bất đồng trong nhóm dưới dạng giả định, không khẳng định ứng viên đã có sự kiện bất đồng thật |
| behavioral-vi-vague | F | F bổ sung | Đào sâu vai trò cá nhân, phân công và hành động cụ thể; phù hợp thiếu sót của câu trả lời chung chung theo STAR |
| behavioral-vi-off_topic | F | F bổ sung | Đưa hội thoại về tình huống xử lý lỗi; câu hỏi còn gần câu gốc, độ chẩn đoán hạn chế khi chưa có dữ liệu liên quan |

Ở 18 kết quả đọc được, chưa thấy question/reason sai ngôn ngữ cấu hình hoặc thông tin cá nhân/thành tích mới bị gán cho ứng viên. Đây là nhận xét trên mẫu nhỏ. Kiểm tra chống prompt injection và giới hạn phiên đã có ở SCRUM-67 nhưng không được tính vào 18 kết quả ba JD của SCRUM-68.

## 4. Ví dụ và vấn đề ghi nhận

**Q1 — Câu hỏi mới còn trùng nội dung đã trả lời.** Ở `frontend-vi-good`, answer đã nêu tách loading, error, dữ liệu và kiểm thử request sai thứ tự. Lượt 1 vẫn hỏi cách quản lý trạng thái tải và lỗi. Ở `backend-en-good`, answer đã nêu unique idempotency key nhưng lượt 2 hỏi lại endpoint chống tạo đơn trùng và reason gọi đó là năng lực chưa hỏi. Khác chuỗi question/topic không đồng nghĩa khác nội dung. Validator trùng chuỗi hiện tại không chặn hai trường hợp này.

**Q2 — Chưa có một quy tắc duy nhất cho lạc đề.** Frontend và Backend thay đổi giữa F và N. Đây không phải lỗi enum/schema; chính prompt cho phép cả hai. Người review cần chọn giữa hỏi lại một lần trước khi chuyển hoặc cho phép AI quyết định theo ngữ cảnh. Chúng tôi chưa tự thay đổi policy trong đợt kiểm thử để giữ cùng một phiên bản prompt.

**Q3 — Hỏi sâu có thể còn dẫn hướng.** Ví dụ Frontend lượt 2 hỏi useEffect có hủy request cũ hay không; Backend nhắc sẵn isolation level hoặc locking. Câu hỏi có liên quan nhưng chưa luôn tạo cơ hội giải thích cơ chế độc lập. Đây là điểm cần xem xét về chiều sâu và lượng gợi ý trong câu hỏi, không phải kết quả chấm năng lực ứng viên.

**O1 — Giới hạn dịch vụ xuất hiện trong chạy lặp.** Request thứ 17 lỗi 429 và ca kế tiếp được bỏ qua đúng chủ ý. Sau khoảng nghỉ, chúng tôi chủ động chạy hai ca bổ sung. Bằng chứng ban đầu không bị xóa; triển khai engine sau này cần hiển thị lỗi để người dùng chủ động thử lại, không sinh câu hỏi mẫu và báo thành công giả.

## 5. Giới hạn và bàn giao review

Chúng tôi sử dụng lại fixture từng dùng khi chỉnh prompt, chỉ có ba JD, mỗi JD hai lần thử, không có người dùng hoặc người chấm độc lập. Nghiên cứu này chỉ kiểm tra lặp lại với context một lượt cố định; chưa đánh giá độ chính xác tổng quát, hội thoại dài, điểm số ứng viên hoặc khả năng cải thiện kết quả tuyển dụng. Các tiêu chí chất lượng chưa được hiệu chuẩn với chuyên gia. Không so sánh hai prompt từ dữ liệu khác nhau rồi kết luận prompt mới tốt hơn.

Nhân review: **đang chờ**. Các điểm bàn giao là tính phù hợp của câu hỏi, mức gợi ý, trùng nội dung và chính sách lạc đề. Hợp đồng bốn trường vẫn giữ nguyên. Luồng ứng dụng, model, prompt và API key được giữ nguyên trong đợt SCRUM-68; chỉ thêm công cụ đánh giá, lệnh chạy và báo cáo. Chưa gửi Slack hoặc thay đổi Jira trong task này.

## Lịch sử thay đổi

| Ngày | Phiên bản | Nội dung |
| --- | --- | --- |
| 31/10/2026 | 1.0 | Ma trận thử lại, xử lý thiếu kết quả do 429, tự đánh giá nội dung và bàn giao review |
