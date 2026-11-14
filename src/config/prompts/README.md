# Cấu hình prompt AI — SCRUM-124

Các file JSON trong thư mục này chứa lời hướng dẫn AI. Nhóm chỉnh nội dung tại đây để đổi cách AI nhận xét/hỏi, không phải sửa logic gọi Gemini.

| File | Nội dung cần chỉnh |
|---|---|
| `analysis.json` | Trích xuất yêu cầu JD, so khớp CV, summary và lời khuyên chuẩn bị phỏng vấn. |
| `interviewer.json` | Hỏi một câu, follow_up/next_topic, tránh lặp, bám CV/JD, ngôn ngữ và phòng chống prompt injection. |
| `question-plan.json` | Lời hướng dẫn cho technical/behavioral/hr và easy/medium/hard. |
| `health.json` | Câu lệnh kiểm tra một từ ở `/api/health?ai=1`; phép kiểm tra thật dùng quota. |

## Cách sửa

Ví dụ đường dẫn tính từ thư mục `src`: `config/prompts/interviewer.json`.

1. Sửa từng phần tử của `system` để thay hướng dẫn chung cho cả hai ngôn ngữ. Thứ tự mảng là thứ tự các dòng gửi cho model.
2. Sửa `languageRules.vi` hoặc `languageRules.en` để thay hướng dẫn riêng từng ngôn ngữ. Các dòng này được nối sau `system`. Trong Analysis, dòng yêu cầu viết bằng Vietnamese/English cũng nằm tại đây.
3. Nếu sửa chính sách vòng/độ khó, vào `question-plan.json`: `roundPolicies.technical`, `roundPolicies.behavioral`, `roundPolicies.hr` hoặc `difficultyPolicies.<type>.<difficulty>`. Giữ nguyên các khóa để code chọn đúng cấu hình.
4. Tăng `version` của file vừa sửa, ví dụ từ `0.10` thành `0.10.1`. Dùng chữ, số, dấu chấm, gạch ngang hoặc gạch dưới; tối đa 100 ký tự. Version của Interview và question-plan được dùng cho metadata lượt hỏi như trước.
5. Lưu JSON UTF-8 hợp lệ: dùng dấu nháy kép, không comment, không dấu phẩy ở cuối. Dấu nháy kép trong câu cần viết `\"`; xuống dòng trong chuỗi dùng `\n`, hoặc tách thành phần tử mảng.

Ví dụ một dòng có thể thêm vào `interviewer.json` → `system` khi nhóm muốn thử điều chỉnh câu hỏi:

```json
"For a vague answer, ask about one specific missing implementation detail."
```

Đây chỉ là ví dụ chỉnh prompt; tránh thêm hướng dẫn trùng hoặc mâu thuẫn với các dòng hiện có. JSON là dữ liệu văn bản, không chạy JavaScript và không tự thay `${variable}`. Không đưa CV/JD, API key hoặc tài khoản test vào cấu hình.

## Khi nào thay đổi có hiệu lực?

- Node standalone: dừng rồi chạy lại `npm run api:standalone`.
- Next.js development: có thể nhận thay đổi qua dev watcher; để kiểm tra chắc chắn, khởi động lại `npm run dev`.
- Next.js production: JSON được đóng gói trong server bundle. Chạy lại `npm run build`, sau đó restart/deploy bản build mới. Chỉ sửa JSON bên cạnh một build cũ đang chạy sẽ không thay prompt trong build đó.

SCRUM-124 không bổ sung màn hình quản trị prompt hoặc cập nhật nóng trên production. Không đặt các file này trong `public` hoặc import chúng từ Client Components.

## Kiểm tra sau khi sửa

Chạy từ thư mục `src`:

```powershell
npm run verify:prompts
npm test
npm run lint
npm run build
```

`verify:prompts` kiểm tra các builder thực sự đọc cấu hình đã chỉnh trong bản sao tạm, cả Việt/Anh và mọi vòng/độ khó; không gọi Gemini. Những câu trong test là dữ liệu kiểm thử, không phải prompt dự phòng của ứng dụng. Cấu hình thiếu version, dòng rỗng, sai kiểu hoặc thiếu ngôn ngữ/chính sách bị từ chối lúc nạp module; JSON sai cú pháp bị Node/Next.js báo lỗi. Sửa hoặc khôi phục config hợp lệ trước khi triển khai.

Test offline xác minh cấu trúc request và các giới hạn. Nếu đổi ý nghĩa prompt, cần đánh giá chất lượng riêng với Gemini thật trên dữ liệu tổng hợp/đã được phép, ghi lại version và mọi lỗi. Test cấu hình không chứng minh AI luôn tuân thủ lời hướng dẫn mới.

## Phần vẫn thuộc logic chương trình

JSON output schemas, validation đầu vào/đầu ra, tính fit score, giới hạn số câu/follow-up/thời gian, lựa chọn đoạn CV/JD, persistence, quota, safetySettings và bộ lọc đầu ra nằm trong code. Sửa prose không thay các ràng buộc này. CV/JD/lịch sử vẫn được ghép vào trường dữ liệu riêng; không có template nhúng dữ liệu vào system instruction.

## Tích hợp với các task khác

Khi chuẩn bị PR, nhánh SCRUM-124 đã được đặt sau SCRUM-123 và kế thừa SCRUM-121/122. Prompt kết hợp `0.13-guardrails-1` cùng hướng dẫn Analysis có guardrails đã được chuyển nguyên văn sang JSON; quota helper, safetySettings và validator vẫn ở code. Bằng chứng request equality: `docs/test/results/scrum124/stack-request-preservation.json`.

Thứ tự PR: SCRUM-121 → SCRUM-122 → SCRUM-123 → SCRUM-124. Sau khi PR trước được merge, đổi base PR tiếp theo về main nếu GitHub chưa tự cập nhật và kiểm tra lại diff. Với squash merge, có thể cần rebase nhánh tiếp theo. Không merge ngoài thứ tự hoặc chép đè toàn bộ file builder cũ.

Khi sửa prompt sau này, giữ các chỉ dẫn tuning/guardrails trong JSON, tăng version, chạy lại test và đánh giá model khi thay ý nghĩa. Kết quả Gemini từ các task trước mô tả phiên bản đã chạy ở từng đợt; bản prompt kết hợp chưa replay live riêng. Ba ca sai action của SCRUM-121 vẫn cần review; việc tách config không sửa các ca đó.
