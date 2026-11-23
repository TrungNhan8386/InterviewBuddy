# SCRUM-133 — Chống lặp câu hỏi và phục hồi lượt sinh

Ngày kiểm tra: 18/11/2026. Nhánh: `fix/scrum-133-question-repetition-hung`. Main đã fetch: `2947292b22632d44c54a83f1ee03019ab6da9d9d`. Đây là kết quả local production API, chưa phải review của Nhân hoặc nghiệm thu staging.

## Thay đổi

- [Planner](../../src/lib/interview/question-plan.mjs) ưu tiên đoạn JD chưa khai thác, dùng CV chưa phủ khi JD đã hết và cung cấp góc hỏi theo loại vòng. Giữ nguyên đoạn nguồn, gồm phủ định; không suy ra thành tích hoặc yêu cầu mới.
- [Diversity guard](../../src/lib/interview/question-diversity.mjs) chuẩn hóa một số cách diễn đạt Việt/Anh, phát hiện mẫu lặp ý và mục tiêu Git workflow/conflict, phân biệt câu chính với follow-up có chi tiết kỹ thuật mới. Đây là heuristic, không phải bộ phân loại ngữ nghĩa toàn diện.
- [Validator](../../src/lib/interview/interviewer-contract.mjs) phân biệt trùng nguyên văn, lặp ý, action sai, câu kết thúc giả làm câu hỏi, schema, nội dung không an toàn và topic follow-up.
- [Prompt builder](../../src/lib/interview/interviewer-prompt.mjs) gửi inventory câu hỏi toàn phiên (mỗi câu tối đa 220 Unicode code points), số câu chính còn lại và action enum do server tính. Model không được chọn end sớm; validator vẫn kiểm tra riêng.
- [Service](../../src/lib/interview/next-service.mjs) chỉ cho một repair khi gặp EXACT_DUPLICATE, NEAR_DUPLICATE, INVALID_ACTION hoặc NON_QUESTION. Repair chỉ rõ quyết định bị từ chối, dùng cùng reservation/anchor, tiêu quota riêng và chia sẻ deadline sinh ban đầu (mặc định 30 giây). Không tự retry lỗi mạng, quota, safety hoặc schema tùy ý.
- SSE không nối thêm preview của repair vào câu bị từ chối; complete thay bản nháp bằng câu đã validate/lưu. Error vẫn xóa bản nháp. Replay không gọi model thêm. Xem [API streaming](../api/INTERVIEW_STREAM_API_v1.md).
- Timing trace chỉ nhận reason code allowlist, không ghi CV/JD, answer, rejectedQuestion, key hoặc body provider. Public error vẫn chỉ có code/message.

Prompt: `0.14-diversity-1`. Question-plan: `jd-cv-coverage-v4`. Không có migration/database schema mới.

## Kiểm chứng cuối

Regression test được chạy đỏ trước sửa, gồm các mẫu paraphrase và lỗi mới phát hiện trong các lần dùng Gemini thật. Test cũ về không retry duplicate được cập nhật thành tối đa một repair, vẫn kiểm tra không lưu output sai.

| Kiểm tra | Kết quả |
|---|---|
| Toàn bộ npm test | 316 pass, 0 fail, 0 skip |
| Lint | Pass, không warning |
| Production build, gồm TypeScript | Pass |
| PGlite/SQL reservation và replay | JSON/SSE chỉ lưu một câu mới, không lưu câu bị từ chối |
| Quota, cancellation, deadline | Repair không vượt quota; không bắt đầu lại một timeout 30 giây; không lưu sau hủy |
| Request nhỏ | Giữ giới hạn 7.000 ký tự, không nâng ngưỡng test |

Build có lần phát thông báo SecurityFatalError khuyến nghị nâng cấp bảo mật Next.js; chạy lại lệnh build tiêu chuẩn đã thành công. Dependencies không đổi. Build đạt không thay thế việc đánh giá/nâng cấp bảo mật framework.

## Gemini và Supabase thật

Dùng tài khoản test đã cung cấp, không dùng service-role. Seed Analysis tổng hợp hợp lệ từ fixture CVJD-01 để Setup snapshot đúng JD/CV. Không chạy lại model Analysis vì lỗi thuộc Interview engine. Tạo session, lưu answer và sinh câu qua API thật với Auth/RLS/RPC. Chỉ dùng dữ liệu tổng hợp thuộc tài khoản test; đóng các phiên sau test. Browser UI và staging không thuộc lần chạy này.

| Lượt cuối | Câu hỏi / câu trả lời đã lưu | Trạng thái | Lỗi API được giữ lại |
|---|---|---|---|
| English JSON | 5 / 5 | completed | 0 |
| English SSE | 5 / 5 | completed | 0 |
| Vietnamese SSE | 5 / 5 | completed sau Retry | 1 INVALID_OUTPUT; 1 AI_UNAVAILABLE |

Replay câu đầu trả cùng question ID. Không lưu câu kết thúc giả trong lượt cuối. Codex đọc lại nội dung; không phải đánh giá chuyên môn độc lập hoặc review của Nhân.

- English JSON: kiểu props → merge conflict → state khi fetch bất đồng bộ → test callback → chiến lược branch.
- English SSE: kiểu props → merge conflict → cập nhật feature branch → rebase → test component.
- Vietnamese SSE: custom hook/form state → merge conflict → unit test → push bị từ chối → hoàn tác commit nhầm.

INVALID_OUTPUT vẫn có thể xuất hiện nếu cả output ban đầu và repair không đạt. Bản sửa dừng sau một repair, giữ câu trả lời và cho Retry chủ động; không bảo đảm mọi output model đều hợp lệ. Lượt tiếng Việt đã phục hồi và hoàn tất phiên. AI_UNAVAILABLE được giữ nguyên là lỗi dịch vụ, không đổi thành câu hỏi mẫu.

## Bảo toàn bằng chứng

- [Attempt 1](results/scrum133/attempt1.json): dừng vì model chọn end sớm; diagnostic INVALID_ACTION dẫn đến schema action theo policy.
- [Attempt 2](results/scrum133/attempt2.json): API hoàn tất nhưng đọc nội dung phát hiện câu kết thúc giả và lặp mục tiêu branch workflow; chưa đạt chất lượng.
- [Attempt 3](results/scrum133/attempt3.json): mục tiêu Git conflict được đổi thành câu hỏi kể chuyện quá khứ; thêm regression phân biệt câu chính với follow-up.
- [Lượt cuối](results/scrum133/live-results.json) giữ mọi lỗi, Retry và câu hỏi của ba phiên cuối.
- [Tổng hợp](results/scrum133/verification.json) ghi phạm vi, số test và fingerprint source.

Không dùng số phiên hoàn tất để tuyên bố mọi request thành công. Các snapshot SCRUM-125 giữ nguyên commit lịch sử, không tự cập nhật manifest cũ để che source drift.

## Review của nhóm

Nhân có thể retest fixture Easy/15 phút/English trên nhánh này, rồi dùng câu trả lời tự nhiên, Việt/Anh, HR/Behavioral và JD dài. Phân biệt follow-up đào sâu với câu chính đổi nhãn; ghi tất cả lỗi và Retry. Heuristic có thể bỏ sót hoặc chặn nhầm cách diễn đạt mới, cần bổ sung mẫu đã review. Task chưa được tự chuyển trạng thái hoặc xác nhận thay Nhân trên Jira.
