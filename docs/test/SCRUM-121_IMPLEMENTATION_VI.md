# SCRUM-121 — Rà soát 10 phiên và điều chỉnh follow-up

Ngày thực hiện: 12/11/2026. Base `origin/main` = `0668228`; nhánh `feat/scrum-121-followup-hung`. Phần ứng dụng được chọn là prompt **0.13**, từ baseline **0.10**. Không đổi Gemini model, API key, schema response, quota, timeout, frontend, database hoặc migration.

## Công việc đã thực hiện

Tôi đọc đầy đủ 10 phiên đã hoàn tất của tài khoản thử trên Supabase: 5 Việt, 5 Anh, mỗi phiên 5 câu hỏi/4 câu trả lời, tổng 50 câu hỏi và 40 câu trả lời. Đây là dữ liệu tổng hợp từ các lần test trước, các phiên được đóng sớm và câu cuối chưa trả lời; không phải 10 cuộc phỏng vấn người dùng thật hoặc 10 phiên đã dùng hết ngân sách câu hỏi. Chỉ đọc database và bỏ ID khi xuất fixture.

[Đánh giá từng phiên](SCRUM-121_SESSION_REVIEW_VI.md) ghi rõ vấn đề và tiêu chí trước khi chốt candidate. Mẫu đều technical Frontend, nhiều câu trả lời mẫu lặp để kiểm tra tốc độ trước đây; không suy rộng thành chất lượng HR/behavioral hay người dùng thực.

Những vấn đề thấy được: follow-up lặp toàn câu chính; câu hỏi hỏi nhiều chi tiết cùng lúc; chuyển chủ đề khi câu trả lời dài nhưng không giải quyết câu vừa hỏi; gán trải nghiệm thực tế trong khi câu trước chỉ hỏi giả định.

Tôi bổ sung chỉ dẫn phân biệt **độ dài câu trả lời** với **mức độ trả lời đúng ý**, yêu cầu hỏi một phần còn thiếu, và sửa điều kiện next_topic để không xem câu trả lời lệch ý như một câu đã hoàn thành. Các giới hạn follow-up vẫn do server quyết định. Các chỉ dẫn khác được rút gọn để giữ kiểm tra ngân sách 7.000 ký tự cho request ngắn, không tăng ngưỡng test để làm kết quả qua.

Tôi giữ JSON schema và bước validate đầu ra, phù hợp với cách dùng [structured outputs của Gemini](https://ai.google.dev/gemini-api/docs/structured-output): đầu ra có cấu trúc không tự chứng minh chất lượng ngữ nghĩa của follow-up.

## Kết quả replay Gemini thật

Chọn cố định hai thời điểm sau câu trả lời thứ 1 và thứ 3 của mỗi phiên: 20 input. Baseline và từng candidate dùng cùng settings, JD/CV, history, model và temperature. Không dùng retry tự động để thay lượt lỗi. Đây là **provider-only replay**; không phải chạy lại 10 phiên mới trên UI/Chat/Supabase và không dùng để nghiệm thu tốc độ sản phẩm.

| Bản | Đầu ra hợp lệ | Sai kỳ vọng action trong số hợp lệ | Hợp lệ và khớp kỳ vọng / mọi lượt |
|---|---|---|---|
| Baseline 0.10 | 19/20 | 5 | 14/20 |
| Bản chọn 0.13 | 20/20 | 3 | 17/20 |

Baseline có một lỗi HTTP 503, giữ nguyên trong mẫu. Bản chọn không có lỗi provider/validation trong 20 lượt này. Số 17/20 là kết quả so với kỳ vọng của nhóm ca phát triển, **không phải 85% chất lượng AI được chuyên gia xác nhận**. Cổng đánh giá vẫn trả exit 1 vì còn 3 action khác kỳ vọng; không đổi kỳ vọng để làm test xanh.

Ba ca còn lại là **S04-after-3, S07-after-3, S09-after-3**: vẫn dùng next_topic thay vì khai thác phần chưa trả lời của câu trước. Một số câu trả lời Yes/Dạ có vẫn dẫn đến câu hỏi nhiều ý hoặc diễn đạt gần câu chính. Không kết luận đã giải quyết hoàn toàn hiện tượng follow-up.

## Đọc nội dung trước/sau

| Ca | Trước | Bản chọn | Đánh giá |
|---|---|---|---|
| S03-after-1 | Hỏi lại bao quát routing/redirection. | Hỏi cơ chế kiểm tra authentication trước khi render protected route. | Thu hẹp vào một quyết định cụ thể hơn. |
| S08-after-3 | Chuyển sang testing dù câu routing chưa được trả lời đúng ý. | follow_up hỏi cấu trúc component và logic kiểm tra quyền trong protected route. | Bám lại câu hỏi trước, action phù hợp hơn; câu hỏi vẫn còn hai khía cạnh. |
| S10-after-3 | Chuyển sang routing. | follow_up hỏi unit test cho timeout/lỗi mạng và thông báo lỗi. | Giữ đúng năng lực testing đang chưa được giải thích. |
| S02-after-1 | Yêu cầu trình bày cả bốn trạng thái. | Vẫn yêu cầu ví dụ cho cả bốn trạng thái. | Chưa cải thiện đủ dù action follow_up hợp lệ. |
| S01-after-3 | follow_up về focus trapping và khôi phục focus. | follow_up về focus khi mở/đóng modal. | Đúng chủ đề nhưng vẫn nhiều ý; không tính là thắng ngữ nghĩa rõ ràng. |
| S04/S07/S09-after-3 | Chuyển chủ đề sớm. | Vẫn chuyển chủ đề. | Chưa đạt kỳ vọng hành vi. |

Các nhận xét do Codex đọc lại nội dung, chưa có reviewer độc lập. Dùng cùng bộ mẫu để chỉnh prompt và đo lại nên có rủi ro overfit; thứ tự chạy không đảo ngẫu nhiên nên biến động provider có thể ảnh hưởng. Không khẳng định cải thiện có ý nghĩa thống kê hoặc ổn định mọi lần gọi.

## Thử nghiệm không đưa vào ứng dụng

- 0.11: hướng dẫn dài, bị test ngân sách request phát hiện; replay dừng giữa chừng. Giữ `candidate-0.11-incomplete.json`, không coi các lượt chưa chạy là thành công. Có thể có một request đang bay khi dừng chưa ghi được kết quả; không dùng tổng số record để khẳng định tổng lượt tính phí.
- 0.12: rút gọn nhưng còn chỉ dẫn dễ hiểu nhầm về câu trả lời không có chi tiết hữu ích; kết quả giữ riêng.
- 0.14: thử thêm followUpFocus trong payload. Hai test offline mới ban đầu thất bại khi chưa có trường, sau đó đạt; nhưng replay xuất hiện quyết định vượt cap bị validator chặn và lỗi provider. Vì vậy bỏ cả thay đổi payload và hai test của phương án này khỏi nhánh giao, quay về 0.13. Không nới validator/cap để nhận đầu ra lỗi.
- Toàn bộ kết quả thử ở [results/scrum121](results/scrum121/). `candidate.json` là bản sao nguyên kết quả của **0.13 được chọn**; các file có số phiên bản là lịch sử thử, không phải nhiều lượt retry của cùng một request.

## Cách chạy lại

Từ thư mục `src`, cấu hình model/key trong `.env.local` bị Git bỏ qua. Các lệnh live dùng quota Gemini:

```powershell
npm test
npm run lint
npm run build
node --env-file=.env.local scripts/evaluate-scrum121.mjs candidate --live
node scripts/check-scrum121-results.mjs candidate
```

Script baseline/candidate dùng **prompt hiện được import**, không tự dựng lại phiên bản cũ từ Git. Muốn đo baseline mới phải checkout đúng bản baseline riêng trước khi chạy. Giữ bản kết quả đã công bố trước khi chạy lại vì script ghi file cùng tên. Không chạy script baseline trên prompt mới rồi gọi đó là baseline 0.10.

Kiểm tra kỹ thuật được chạy lại trên bản chọn: bộ 255 test, lint và production build/TypeScript. Kết quả cuối được ghi ở `verification.json`; các lượt test của phiên bản đã bỏ không thay cho kết quả cuối.

## Bàn giao và giới hạn

Phần code thay đổi là `src/lib/interview/interviewer-prompt.mjs`; bổ sung hai script replay/check và bộ dữ liệu/báo cáo. Không sửa các lỗi report, khóa ô nhập khi AI từ chối hay điều hướng cuối phiên của SCRUM-120. API fields và giao diện Chat giữ nguyên.

Đã thực hiện phần đọc 10 phiên, điều chỉnh và đo lại; chưa đủ bằng chứng để tuyên bố mọi follow-up đều đúng hoặc tự đánh task Done. Cần thành viên review nội dung và bộ holdout đa dạng hơn (HR, behavioral, câu trả lời tự nhiên) trước nghiệm thu. Không commit/push hoặc đổi Jira trong lượt này.
