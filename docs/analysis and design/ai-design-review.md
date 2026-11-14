# SCRUM-125 — Checklist review và bàn giao AI cho Nhân

Ngày soạn: 13/11/2026. Tài liệu cần review: [AI design v1.0](ai-design.md). Mã nguồn nền: `469bfbf`, chuỗi PR SCRUM-121 → 122 → 123 → 124. Người review theo Jira: Nhân, vai trò AI backup.

**Trạng thái: chưa có review của Nhân.** Các ô dưới đây để reviewer tự đánh dấu và ghi bằng chứng; không phải xác nhận rằng các bước đã được người dùng hoặc Nhân thực hiện. Các kiểm tra Codex có kết quả riêng ở cuối checklist.

## 1. Đối chiếu source và nhánh

- [ ] Fetch GitHub, ghi main và commit thực tế sẽ review; xác định chuỗi PR đã/chưa merge.
- [ ] Đọc `source-manifest.json`, so version/hash với code được checkout; không dùng bản main cũ để xác nhận prose của PR #31.
- [ ] Xác nhận các sơ đồ phân biệt việc lưu Analysis từ UI với claim/finish Interview phía server.
- [ ] Kiểm tra đủ migrations của project Supabase được nhóm chọn; không tự áp migration chỉ để đọc tài liệu.

## 2. Prompt và schema

- [ ] Tìm được 4 file JSON, hiểu system/languageRules/roundPolicies/difficultyPolicies và thời điểm cấu hình có hiệu lực.
- [ ] Chỉ ra được cách tăng version, rebuild/restart và quay lại cấu hình đã biết đúng.
- [ ] Đối chiếu hai schema snapshot với exports trong code; JSON example không được thêm score/feedback vào quyết định Interview.
- [ ] Giải thích được vì sao structured JSON không chứng minh một câu hỏi bám JD hoặc nhận xét đã đúng chuyên môn.
- [ ] Kiểm tra hướng dẫn Việt/Anh, câu trả lời mơ hồ/lệch ý, phủ định trong CV và giả định trải nghiệm không có bằng chứng.

## 3. Logic và dữ liệu

- [ ] Tự tính ví dụ React required/matched + Git preferred/missing: core 66,67%; UI/cột score làm tròn 67.
- [ ] Chỉ ra counters/cap/time do server kiểm soát và model chỉ chọn action trong allowedActions.
- [ ] Giải thích history đầy đủ khác completedTurns và summary; dữ liệu bị lược không có nghĩa ứng viên thiếu kỹ năng.
- [ ] Theo dõi một lượt từ saveAnswer → afterAnswerId → claim → Gemini → validate → finish → complete.
- [ ] Kiểm tra retry cùng anchor/replay không tạo trùng, không gọi model thêm khi đã có kết quả; không sửa session của người khác để test.

## 4. Lỗi, streaming và vận hành

- [ ] Phân biệt draft delta với complete; xử lý error trong SSE HTTP 200, timeout và hủy đúng lượt.
- [ ] Phân biệt quota nhà cung cấp với hạn mức ứng dụng; không hứa reset Google lúc 0 giờ Việt Nam.
- [ ] Tìm được model/key/timeout/mock flag cần cấu hình mà không đưa giá trị secret vào báo cáo hoặc chat.
- [ ] Hiểu standalone Analysis không thay lớp Auth/daily limit của Next.js; không dùng nó để tuyên bố ownership đã đạt.
- [ ] Kiểm tra trường hợp PDF scan/cắt text và sự khác nhau giữa giới hạn PDF extraction, Analysis UI và core API.
- [ ] Chạy các kiểm tra offline được chọn; ghi lệnh, commit, số pass/fail/skip và ranh giới môi trường.

## 5. Điểm chưa nghiệm thu cần quyết định

- [ ] Đọc 3 ca semantic action còn sai của SCRUM-121; lên bộ holdout có câu trả lời tự nhiên, HR/behavioral và Việt/Anh.
- [ ] Xác định có cần replay Gemini cho prompt kết hợp; ghi kế hoạch và mọi lỗi, không thay lượt lỗi bằng retry để nâng tỷ lệ.
- [ ] Phối hợp người phụ trách Chat/feedback để chốt UC-06/UC-08: feedback rồi Continue Interview hay cập nhật use case được nhóm thống nhất.
- [ ] Retest việc sửa answer sau từ chối, kết thúc/report và điều hướng trên đúng bản tích hợp; không suy ra đã fix từ prompt/config.
- [ ] Không đánh dấu tốc độ 2 giây hoặc universal safety là đạt chỉ dựa trên test cấu trúc.

## 6. Ghi nhận review thực tế

| Nội dung | Reviewer điền |
|---|---|
| Người review / ngày | Chưa ghi nhận |
| Commit, nhánh, môi trường | Chưa ghi nhận |
| Nội dung đã đọc/chạy lại | Chưa ghi nhận |
| Kết luận: chấp thuận / cần chỉnh / chặn | Chưa ghi nhận |
| Finding và bằng chứng | Chưa ghi nhận |
| Điều kiện bàn giao còn thiếu | Chưa ghi nhận |

Mẫu finding: `Mã → mục tài liệu / file → expected → observed → bằng chứng → việc cần sửa → kết quả retest`. Không cần gửi mật khẩu, key hoặc raw CV khi phản hồi review.

## 7. Kiểm tra do công cụ thực hiện

Xem [document-verification.json](../test/results/scrum125/document-verification.json) để biết kết quả link, schema snapshot, ví dụ JSON, manifest/hash, quét bí mật và test offline. Những kiểm tra này được Codex chạy; không đánh dấu thay các ô review của Nhân và không thay nghiệm thu model/UI/Supabase thật.
