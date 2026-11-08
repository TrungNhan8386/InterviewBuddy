# Tối ưu luồng sinh câu hỏi AI — 08/11/2026

Đã áp dụng trên nhánh `feat/scrum-94-chat-streaming-hung`, từ bản ghép `53a955c`, prompt **0.10**. Thay đổi nằm ở backend gọi Gemini và bộ kiểm thử. Các trường `committed`/`pushed` trong JSON là snapshot lúc kiểm thử, không phản ánh trạng thái PR sau khi công bố.

Luồng Analysis → Setup → Chat production đã chạy bằng Gemini và Supabase thật: **20/20 lượt sinh mới hợp lệ và lưu được**, chữ đầu p50 **1.571 giây**, hoàn tất p50 **1.912 giây**. **17/20** lượt hiện chữ trong hai giây, nên chưa đạt mốc làm việc 90%. Không dùng retry để thay lượt chậm/lỗi.

Phép A/B cùng đợt chưa chứng minh prompt mới làm provider nhanh hơn ổn định: trung vị chữ đầu bản cũ **1125.5 ms**, bản mới **1239.5 ms**. Dung lượng request giảm rõ ràng; thời gian thực tế còn phụ thuộc provider và luồng ứng dụng.

## 1. Những gì đã thay đổi

1. `document-context.mjs` chiếu CV/JD dài thành các đoạn nguồn nguyên văn. Ưu tiên đoạn liên quan JD/vị trí, giữ các dòng lân cận để không tách tên kỹ năng khỏi câu phủ định. Mục tiêu CV 4000/JD 6000 ký tự UTF-16; giữ nguyên nguồn ngắn, đoạn không thể chia an toàn hoặc không có kết quả phù hợp. Đây không phải giới hạn upload mới.
2. `documentCoverage` báo rõ phần bị lược. `turnEvidence` lấy thêm đoạn liên quan câu hỏi/câu trả lời hiện tại, mục tiêu 2200 ký tự mỗi tài liệu. Cách chọn là heuristic từ vựng, không bảo đảm bao phủ mọi chi tiết. CV/JD gốc và lịch sử vẫn nằm nguyên trong session/server; không có lời gọi AI tóm tắt hay bảng dữ liệu mới.
3. Đặt documents/coverage/settings cố định trước policy, questionPlan và hội thoại thay đổi. Prefix thuận lợi cho implicit cache nhưng không tạo explicit cache, không đo được cache hit và không cam kết cache luôn hoạt động.
4. Rút gọn chỉ dẫn lặp; schema trả `question` trước `action/topic/reason`. AI vẫn phải quyết định đúng hành động trước khi viết câu hỏi. Chỉ stream bản xem trước; backend vẫn kiểm tra toàn bộ quyết định và lưu thành công trước `complete`.
5. Rà soát nội dung Gemini thật và siết lại hai điểm phát hiện ở prompt 0.9: nhãn next_topic tiếng Anh phải dịch từ JD tiếng Việt; câu behavioral tiếp theo phải kiểm tra một năng lực chưa hỏi, không đổi câu chuyện để hỏi lại teamwork.

Không đổi API key/model, timeout 30 giây, maxOutputTokens 2048, quota, request/response fields, chính sách ownership hoặc database. Luồng feedback UC-08 chưa được tích hợp trong thay đổi này.

## 2. Kiểm thử cuối

| Kiểm tra | Kết quả |
| --- | --- |
| Unit/integration suite | 255/255 qua |
| ESLint | Qua |
| TypeScript | Qua |
| Production build | Qua |
| Analysis CV/JD thật | 4/4 lưu qua UI, vi/en, ngắn/dài |
| Chat sinh mới thật | 20/20 hợp lệ/lưu, không retry |
| Hiện chữ ≤2 s và cuối cùng hợp lệ/lưu | 17/20 = 85%; mốc ≥90% chưa đạt |
| Hoàn tất hợp lệ/lưu ≤5 s | 20/20; mốc ≥95% đạt trong mẫu |
| UI phản hồi busy ≤200 ms | 20/20 quan sát đạt |
| Kiểm tra chức năng | 13/13 qua |
| Chữ đầu p50 / p95 | 1.571 / 2.624 s |
| Hoàn tất p50 / p95 | 1.912 / 2.952 s |

13 check gồm đăng nhập, bốn câu “Dạ có.”/“Yes.” đều nhận follow_up, bốn lần reload giữ câu hỏi và không gọi AI thêm, bốn phiên kết thúc lưu được. Cuối mỗi phiên có 5 câu hỏi và 4 câu trả lời: tổng **20 question, 16 answer**, 4 phiên completed. Chất lượng nội dung do agent đọc lại trên mẫu tổng hợp, chưa có đánh giá độc lập của thành viên/chuyên gia.

Ba lượt vượt hai giây:

| Ca | Lượt | Hiện chữ |
| --- | --- | --- |
| vi-short | 1 | 2.624 s |
| vi-long | 2 | 2.879 s |
| en-long | 1 | 2.070 s |

Backend có 20 trace. Trung vị chờ provider đến chữ đầu 1061.6 ms; context ready 127.7 ms; lưu 101.6 ms. Các trung vị không được cộng trực tiếp thành một tổng thời gian.

## 3. A/B provider trên cùng bộ đầu vào

10 cặp baseline 0.8/candidate 0.10, đảo thứ tự AB/BA giữa các ca, giãn tối thiểu 8 giây giữa lần bắt đầu gọi. Cả hai đều 10/10 đúng schema và hành động kỳ vọng. Đây là gọi provider trực tiếp, không gồm UI/Auth/Supabase; không dùng làm mẫu nghiệm thu Chat. Bản ghép cũ được đóng băng ngoài checkout; không thay input để làm đẹp kết quả.

| Chỉ số | Baseline 0.8 | Candidate 0.10 |
| --- | --- | --- |
| Chữ đầu p50 | 1125.5 ms | 1239.5 ms |
| Hoàn tất p50 | 1300 ms | 1382.5 ms |
| Hợp lệ / đúng hành động | 10/10 | 10/10 |

**Không kết luận prompt mới nhanh hơn từ A/B này.** Hai lần A/B nhỏ dao động: lần 0.9 chữ đầu 1176 → 1134,5 ms; lần cuối 1125,5 → 1239,5 ms. Bản 0.9 được giữ làm lịch sử vì đọc nội dung phát hiện hai điểm chất lượng đã nêu; không gộp nó vào mẫu nghiệm thu 0.10.

Dung lượng JSON request của cùng input (ký tự, không phải token hoặc phần trăm tốc độ):

| Ca | Cũ | Mới | Giảm |
| --- | --- | --- | --- |
| opening-vi-short | 8987 | 6463 | 28.1% |
| opening-en-short | 8943 | 6511 | 27.2% |
| vague-technical-en | 9227 | 6795 | 26.4% |
| interesting-detail-en | 9721 | 7289 | 25.0% |
| developed-behavioral-vi | 9658 | 7134 | 26.1% |
| declines-answer-vi | 9103 | 6579 | 27.7% |
| follow-up-cap-en | 9379 | 6947 | 25.9% |
| long-memory-en | 12672 | 10240 | 19.2% |
| opening-vi-long | 21301 | 6951 | 67.4% |
| opening-en-long | 21257 | 6999 | 67.1% |

Mẫu dài 12.214 ký tự ở A/B có nhiều đoạn hoạt động không liên quan để kiểm tra chọn ngữ cảnh. Bộ UI dùng CV tổng hợp 685/12.526 ký tự như lần trước. Tỷ lệ giảm dung lượng phụ thuộc tài liệu; không áp tỷ lệ mẫu A/B cho mọi CV.

## 4. So với lần 07/11

[Báo cáo 07/11](SCRUM-94_LIVE_RECHECK_20261107_VI.md) ghi chữ đầu p50 3,882 s, hoàn tất 4,182 s, 18/20 hợp lệ, 1/20 nhanh/hợp lệ và 13/20 hoàn tất trong 5 s. Lần đó dùng dev server và chạy ngày khác; lần này production. Provider cũng thay đổi theo thời điểm. Không được quy toàn bộ chênh lệch cho thay đổi prompt.

**Chưa nghiệm thu đầy đủ SCRUM-94**: mốc hiện chữ 90% chưa đạt và các giới hạn nghiệp vụ/feedback đã ghi ở các tài liệu trước vẫn cần nhóm xử lý. Không áp migration Settings, không xóa dữ liệu hoặc đổi cấu hình bảo vệ.

## 5. Handoff và chạy lại

Để tắt chọn đoạn mà vẫn giữ tài liệu gốc, đặt `GEMINI_INTERVIEW_CONTEXT_MODE=full` trong tệp env local được Git bỏ qua rồi khởi động lại server. Đây chỉ rollback phần chiếu tài liệu, không khôi phục prompt 0.8 hoặc thứ tự schema cũ. Mặc định là `compact`. Không cần migration.

Script `src/scripts/benchmark-interview-latency.mjs` nhận `--baseline <đường dẫn lib của checkout cũ>` và `--out <json>`. Không có `--live` thì chỉ chuẩn bị số đo dung lượng. Thêm `--live` mới dùng quota Gemini; script không tự retry và trả exit code lỗi nếu có lượt không hợp lệ/sai hành động. Chỉ dùng bộ fixtures tổng hợp. Kết quả hành động đúng vẫn cần đọc nội dung để kiểm tra ngôn ngữ và câu gần trùng.

Validation cuối: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`. Các test mới bảo vệ giới hạn payload ngắn, phủ định cạnh kỹ năng, bằng chứng cuối CV, truy hồi ngữ cảnh bị lược, prefix ổn định, rollback full và chữ đầu trước khi JSON hoàn tất. Test đủ 18 cấu hình kiểm tra đoạn CV được giữ nguyên thay vì so một câu chữ cố định trong system prompt.

Lần kiểm tra thật không mock response/request; dùng tài khoản test đã được cung cấp, chỉ tạo dữ liệu tổng hợp. JSON công khai đã thay session/question IDs bằng alias và quét key/mật khẩu/token. Ảnh và log gốc giữ ngoài checkout, không đưa vào Git.

[Bằng chứng JSON](results/scrum94-latency-20261108.json).

## 6. Tài liệu kỹ thuật đã đối chiếu

- [Google structured output](https://aistudio.google.com/docs/structured-output.md?generate-content=true): hỗ trợ streaming và thứ tự trường theo schema.
- [Google context caching](https://aistudio.google.com/docs/caching.md?generate-content=true): đặt phần chung lớn ở đầu, duy trì prefix tương tự.
- [Google thinking](https://aistudio.google.com/docs/thinking.md?generate-content=true): minimal phụ thuộc model và không bảo đảm tắt suy luận. Không thay mức suy luận/model hoặc hạ output token để tránh cắt JSON.
