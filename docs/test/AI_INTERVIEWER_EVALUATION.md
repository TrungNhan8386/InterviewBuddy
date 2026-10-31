# Kiểm thử prompt AI phỏng vấn

| Thuộc tính | Nội dung |
| --- | --- |
| Task | SCRUM-68 |
| Ngày | 31/10/2026, giờ Việt Nam |
| Mục tiêu Jira đã đọc trực tiếp | Test prompt trên 3 JD mẫu Việt/Anh và viết nửa trang findings trong `docs/analysis and design` |
| Hướng dẫn bổ sung | Mục 2.5: câu trả lời tốt, mơ hồ và lạc đề; dữ liệu ẩn danh; Nhân review |
| Phiên bản đóng băng | Prompt 0.2, contract 0.1 |
| Dữ liệu | Do AI tạo, không có ứng viên thật hoặc thông tin liên hệ |
| Review nội dung | Tự kiểm tra bằng AI; chưa có đánh giá độc lập của Nhân |

## 1. Bộ dữ liệu và kỳ vọng

Chúng tôi sử dụng các fixture đã có trong `src/lib/interview/interviewer-fixtures.mjs` để kiểm tra lặp lại. Bộ này đã được dùng khi phát triển prompt ở SCRUM-67, nên đây là kiểm thử hồi quy/thử nghiệm lặp, **không phải tập kiểm tra độc lập chưa từng thấy**. Nhãn “tốt” hoặc “mơ hồ” là nhãn thiết kế do AI đặt, chưa phải nhãn được chuyên gia xác nhận.

| JD | Ngôn ngữ | Vòng | Nội dung câu hỏi gốc |
| --- | --- | --- | --- |
| Frontend Intern | Việt | Technical | React, gọi REST API khi đổi bộ lọc liên tục |
| Backend Junior | Anh | Technical | PostgreSQL, transaction và cập nhật tồn kho đồng thời |
| Software Engineer Intern | Việt | Behavioral | Phối hợp xử lý lỗi trước hạn bàn giao |

Mỗi JD có ba câu trả lời:

- **Tốt:** có cách làm, lý do và kiểm chứng hoặc bối cảnh–hành động–kết quả. Trong bộ thử này chúng tôi kỳ vọng `next_topic`; ở tình huống thực tế câu trả lời tốt vẫn có thể cần khai thác sâu hơn.
- **Mơ hồ:** liên quan nhưng thiếu cơ chế hoặc vai trò cá nhân, kỳ vọng `follow_up`.
- **Lạc đề:** nói về thể thao/du lịch, chấp nhận hỏi lại đúng trọng tâm hoặc chuyển chủ đề. Việc chấp nhận hai hành động đồng nghĩa phép kiểm tra action khá rộng, không đủ kết luận chất lượng xử lý lạc đề.

Đầu vào đầy đủ của cả chín trường hợp nằm trong `dataset` của từng báo cáo JSON; có SHA-256 của prompt, provider, contract, fixture, session contract và request để đối chiếu. Khóa API và cấu hình bí mật không được ghi vào báo cáo.

## 2. Quy trình

Chúng tôi chạy chín tình huống theo cùng thứ tự, hai lần với cùng context đã trả lời. Mỗi request độc lập, không dùng đầu ra của lượt trước làm câu trả lời tiếp theo. Vì vậy phép thử này chưa kiểm tra hội thoại nhiều lượt, lưu phiên, giao diện, âm thanh hoặc endpoint `/api/interview/next`.

Runner ghi kết quả ngay sau mỗi request và giữ file riêng cho từng lần chạy. Khi Gemini trả 429, lỗi cấu hình hoặc lỗi kết nối, runner dừng gọi thêm; lỗi và các ca skipped vẫn được giữ. Nếu chạy bổ sung thủ công sau thời gian nghỉ, bằng chứng bổ sung phải tách riêng và liên kết với đúng ca còn thiếu; không xóa lỗi ban đầu hoặc gọi đó là thành công lần đầu.

## 3. Tiêu chí kiểm tra

| Tầng | Tiêu chí | Cách xác nhận |
| --- | --- | --- |
| Tự động | Đúng JSON và bốn trường bắt buộc | Provider và validator từ SCRUM-67 |
| Tự động | Hành động trong policy; không lặp nguyên câu hỏi | Validator kiểm tra context và chuẩn hóa câu hỏi |
| Tự động | Hành động thuộc kỳ vọng fixture | So sánh với `expectedActions`, không dùng làm điểm chính xác tổng quát |
| Tự động | Hành động có thay đổi giữa hai lần không | Chỉ tính cặp đủ hai đầu ra hợp lệ; không gán skipped là thành công |
| Nội dung | Câu hỏi bám JD và câu trả lời trước | Đọc đối chiếu input/output; đánh dấu rõ chi tiết còn thiếu |
| Nội dung | Câu hỏi mới không khai thác lại ý đã trả lời | Xem cả nội dung answer, không chỉ topic hoặc chuỗi question |
| Nội dung | Không gán kinh nghiệm chưa được cung cấp | Đối chiếu CV giả lập và câu trả lời |
| Nội dung | Ngôn ngữ và độ tập trung | Kiểm tra question/reason và tránh gom nhiều chủ đề |

Các nhận xét nội dung trong phụ lục là tự đánh giá bằng AI, không phải điểm của giảng viên, chuyên gia hoặc kết quả user testing. Chúng tôi không tạo một “accuracy” chung từ các tiêu chí khác loại.

## 4. Chạy lại và thay dữ liệu

Trong terminal ở thư mục `src`:

```powershell
npm run interview:evaluate
npm run interview:evaluate:live
```

Lệnh đầu kiểm tra dataset và chuẩn bị hồ sơ, không gọi Gemini. Lệnh thứ hai đọc khóa từ `.env.local`, thực hiện tối đa 18 request và ghi file `docs/test/results/SCRUM-68-evaluation-live-<UTC-timestamp>.json`. Timestamp UTC có thể khác ngày local; trường `dateLocal` dùng Asia/Bangkok.

Để chạy bổ sung riêng một ca bằng công cụ spike đã có:

```powershell
npm run interview:spike:live -- --case behavioral-vi-vague
npm run interview:spike:live -- --case behavioral-vi-off_topic
```

Lệnh chạy riêng ghi file `ai-interviewer-spike-<fixture-id>-v0.2.json`; không ghi đè báo cáo ma trận. Hãy lưu bằng chứng đó trước khi chạy lại cùng một fixture/version vì công cụ spike dùng tên cố định.

Để tái lập bản tổng hợp của đợt thử này mà không gọi Gemini:

```powershell
node scripts/summarize-interviewer-evaluation.mjs SCRUM-68-evaluation-live-2026-10-31T01-52-09-037Z.json ai-interviewer-spike-behavioral-vi-vague-v0.2.json ai-interviewer-spike-behavioral-vi-off_topic-v0.2.json
```

Script kiểm tra nguồn và hash request còn khớp, đúng model/prompt/contract, đúng hai ô thiếu và không trùng fixture/lần lặp. Kết quả là `SCRUM-68-evaluation-summary.json`; các báo cáo thô không bị sửa. Khi dùng cho đợt khác, truyền đúng tên ba hồ sơ tương ứng, không dùng kết quả bổ sung cũ với context đã thay đổi.

Muốn thay JD/CV/câu trả lời: sửa `src/lib/interview/interviewer-fixtures.mjs`. Muốn sửa cách hỏi: sửa `src/lib/interview/interviewer-prompt.mjs`, tăng `PROMPT_VERSION` và đánh giá thành một phiên bản mới; không gộp kết quả nhiều prompt thành cùng một ma trận. Muốn đổi số lần lặp: sửa `repetitions` trong `src/scripts/evaluate-interviewer.mjs` và ghi rõ trong báo cáo.

## 5. Kết quả và bàn giao

- [Findings khoảng nửa trang](../analysis%20and%20design/ai-interviewer-evaluation.md).
- [Phụ lục kết quả và tự đánh giá nội dung](../analysis%20and%20design/ai-interviewer-evaluation-results.md).
- [Hợp đồng đầu vào/đầu ra](../api/AI_INTERVIEWER_CONTRACT_v0.1.md).

Nhân review: đang chờ. Chưa gửi Slack, chưa thay đổi assignee hoặc trạng thái Jira.

## Lịch sử

| Ngày | Phiên bản | Thay đổi |
| --- | --- | --- |
| 31/10/2026 | 1.0 | Thực hiện ma trận ba JD, kiểm tra lặp và tách chỉ số kỹ thuật với nhận xét nội dung |
