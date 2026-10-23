# SCRUM-39 — Báo cáo triển khai và kiểm thử

Ngày: 23/10/2026. Kiểm thử do Codex thực hiện; không phải đánh giá của giảng viên hoặc xác nhận review của thành viên nhóm.

## 1. Truy vết nhiệm vụ

| Jira | Yêu cầu | Phần triển khai | Ranh giới xác minh |
|---|---|---|---|
| SCRUM-40 | Gọi Gemini xử lý CV/JD text | `src/lib/analysis/gemini.mjs`, `service.mjs`, `http.mjs`; adapter Next.js và server Node | Đã kiểm thử cấu trúc lời gọi và lỗi với transport giả lập; chưa gọi Gemini thật. |
| SCRUM-41 | Fit Score, matched/missing skills | `scoring.mjs`, kiểm tra trích dẫn và gộp alias | Đã kiểm tra cách tính điểm với kết quả kỳ vọng cho 5 cặp dữ liệu. |
| SCRUM-42 | API contract cho Khang | `docs/api/CV_JD_ANALYSIS_API_v1.md`, `HANDOFF_TO_KHANG.md`, client helper, ví dụ JSON | Sẵn nội dung bàn giao qua repo; chưa có xác nhận của Khang. |
| SCRUM-43 | Xác minh ít nhất 5 cặp CV/JD | Fixtures, unit tests, script offline và script live | Offline có thể tái chạy; kiểm thử AI thật đang chờ API key. |

## 2. Dữ liệu kiểm thử

Toàn bộ CV/JD là **dữ liệu giả lập do AI soạn**, không phải khảo sát, hồ sơ cá nhân hay kết quả phỏng vấn thật.
Kết quả Gemini giả lập được chỉ định trong fixture để kiểm tra đường đi dữ liệu và số học.

| Mã | Tình huống | Trọng số khớp / tổng | Điểm kỳ vọng |
|---|---|---|---|
| CVJD-01 | Frontend khớp đầy đủ React, TypeScript, Git | 5/5 | 100 |
| CVJD-02 | Backend có Node.js và Docker, thiếu PostgreSQL | 3/5 | 60 |
| CVJD-03 | Data analyst không khớp; CV có phủ định rõ kỹ năng | 0/5 | 0 |
| CVJD-04 | CV/JD tiếng Việt cho QA; thiếu Selenium | 4/5 | 80 |
| CVJD-05 | Java internship; thiếu Spring Boot; kiểm tra làm tròn | 4/6 | 66,67 |

Nguồn: [fixtures/cv-jd-pairs.json](fixtures/cv-jd-pairs.json).
Chạy offline không xác nhận rằng Gemini thật sẽ nhận diện đúng phủ định hay ý nghĩa kỹ năng; việc đó thuộc lần kiểm thử live.

## 3. Các lớp kiểm tra

- Input: kiểu dữ liệu, trim, độ dài, ngôn ngữ, trường lạ và giới hạn body.
- Gemini adapter: JSON schema, tách instruction khỏi tài liệu, key trong header, timeout, hủy request, quota, lỗi cấu hình, lỗi mạng, phản hồi bị chặn hoặc bị cắt.
- Kết quả: trích dẫn CV/JD, thiếu bằng chứng, alias trùng, phân biệt C/C++/C#, kỹ năng rỗng, điểm do backend tính.
- HTTP/client: mã lỗi, CORS, không cache, không lộ nội dung lỗi nội bộ, helper cho Khang và adapter Next.js.
- Local HTTP: browser client helper → server Node → Gemini adapter giả lập → kiểm tra kết quả → JSON trả về.

## 4. Lệnh tái chạy và chứng cứ

Kết quả đã chạy: **61/61 kiểm thử tự động đạt**, **5/5 cặp qua HTTP nội bộ đạt** với Gemini transport giả lập.
Kiểm thử Gemini thật: **blocked**, chưa có key, **0** lời gọi ngoài đã gửi.

Từ thư mục `src`:

```powershell
npm test
npm run verify:offline
npm run verify:live
```

- [Kết quả HTTP offline cho 5 cặp](results/SCRUM-39-offline.json).
- [Nhật ký bộ kiểm thử tự động](results/SCRUM-39-unit.tap).
- [Trạng thái kiểm thử Gemini thật](results/SCRUM-39-live.json).
- `verify:live` thiếu key: ghi `blocked`, không gửi request ngoài, exit code **2**. Có key: gửi đúng 5 cặp giả lập và so sánh với kết quả kỳ vọng.
- Nếu có khác biệt về điểm/kỹ năng trong lần chạy thật, báo cáo ghi `needs-review`; không tự đánh dấu đạt.

## 5. Công việc còn chờ

1. Nhóm tạo/cấu hình `GEMINI_API_KEY`, chọn model khả dụng, rồi chạy `npm run verify:live`.
2. Xem xét từng phân tích thật, nhất là bằng chứng phủ định và các trường hợp kỹ năng tương đương.
3. Khang ghép mã frontend và xác minh luồng sử dụng hoàn chỉnh của SCRUM-46.
4. Review nhánh/PR trước khi merge vào `main` theo quy định repository.

Chưa xác nhận build trong app Next.js hoàn chỉnh, kết nối database/auth, hay triển khai Vercel vì repo hiện chưa có các phần đó.
